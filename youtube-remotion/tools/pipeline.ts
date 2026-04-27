#!/usr/bin/env tsx
/**
 * Single CLI for the YouTube Remotion pipeline.
 *
 *   tsx tools/pipeline.ts build  --episode YT-S01-E01
 *   tsx tools/pipeline.ts qa     --episode YT-S01-E01
 *   tsx tools/pipeline.ts render --episode YT-S01-E01
 *
 * Resolves script JSON + phrase timestamps into a TimelineEvent[],
 * validates it, and drives the Remotion render.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, lstatSync, unlinkSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CardType,
  EpisodeTimeline,
  SubtitleEntry,
  SubtitleLang,
  TimelineEvent,
} from "../src/data/types.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const REMOTION_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(REMOTION_ROOT, "..");
const YOUTUBE_DIR = resolve(REPO_ROOT, "youtube");
const PUBLIC_DIR = resolve(REMOTION_ROOT, "public");

const FPS = 30;

// ---------------------------------------------------------------------------
// Source data shapes (match youtube/examples and youtube/phrases)
// ---------------------------------------------------------------------------

interface ScriptVocab {
  id: string;
  thai: string;
  translit: string;
  english: string;
  imageRef?: string;
}

interface ScriptLine {
  id: string;
  lang: string;
  thai?: string;
  thaiSplit?: string;
  translit?: string;
  english?: string;
  display?: string;
  spoken?: boolean;
  highlight?: boolean;
}

interface ScriptBlock {
  id: string;
  mode: string;
  imageRef?: string;
  vocabRefs?: string[];
  lines: ScriptLine[];
}

interface Script {
  episodeId: string;
  title?: string;
  vocab: ScriptVocab[];
  blocks: ScriptBlock[];
  imagePrompts: { id: string; prompt: string }[];
}

interface PhraseChunk {
  chunkId: string;
  blockRef: string;
  sectionName?: string;
  lang: string;
  text: string;
  translit: string | null;
  triggerCard: { type: string; vocabId?: string } | null;
  displayStart: number;
}

interface PhraseFile {
  episodeId: string;
  totalChunks: number;
  chunks: PhraseChunk[];
}

interface ImageManifest {
  episodeId: string;
  images: { imageId: string; localPath: string }[];
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function imagePathFor(imageRef: string | undefined, manifest: ImageManifest): string | null {
  if (!imageRef) return null;
  const entry = manifest.images.find((i) => i.imageId === imageRef);
  if (!entry) return null;
  return `images/${entry.localPath.replace(/^images\//, "")}`;
}

interface ResolvedCard {
  cardType: CardType;
  cardKey: string;
  props: Record<string, unknown>;
}

interface StickyState {
  vocabId: string | null;
  breakdownIndex: number;
}

/**
 * Card rule per block mode. Returns a ResolvedCard for "meaningful" moments
 * (vocab / breakdown / drill / Thai line / recap grid) and `null` for English
 * narration inside section-type blocks, which means "persist the current card"
 * — the buildTimeline loop falls back to stickyCard, or BrandCard if no sticky
 * has been set yet.
 */
function resolveCard(
  chunk: PhraseChunk,
  block: ScriptBlock,
  script: Script,
  manifest: ImageManifest,
  sticky: StickyState,
): ResolvedCard | null {
  const blockMode = block.mode;
  const blockImage = imagePathFor(block.imageRef, manifest);

  const vocabCardFor = (vocabId: string | undefined): ResolvedCard => {
    const vocab = vocabId ? script.vocab.find((v) => v.id === vocabId) : undefined;
    const vocabImage = vocab ? imagePathFor(vocab.imageRef, manifest) : null;
    return {
      cardType: "text",
      cardKey: `vocab:${vocabId ?? "unknown"}`,
      props: {
        thai: vocab?.thai ?? "",
        translit: vocab?.translit ?? "",
        english: vocab?.english ?? "",
        imageSrc: vocabImage ?? blockImage,
      },
    };
  };

  // vocab-card: trigger selects vocab; otherwise last-triggered; otherwise pre-seed first.
  if (blockMode === "vocab-card") {
    if (chunk.triggerCard?.type === "vocab-card" && chunk.triggerCard.vocabId) {
      return vocabCardFor(chunk.triggerCard.vocabId);
    }
    return vocabCardFor(sticky.vocabId ?? block.vocabRefs?.[0]);
  }

  // breakdown: cycle triplets per Thai sentence.
  if (blockMode === "breakdown") {
    const thLines = block.lines.filter((l) => l.lang === "th");
    const idx = Math.max(0, Math.min(thLines.length - 1, sticky.breakdownIndex));
    const thLine = thLines[idx];
    return {
      cardType: "breakdown",
      cardKey: `breakdown:${block.id}:${idx}`,
      props: {
        thai: thLine?.thai ?? "",
        translit: thLine?.translit ?? "",
        english: thLine?.english ?? "",
        imageSrc: blockImage,
      },
    };
  }

  // drill-prompt: English question + delayed hint, one card for the block.
  if (blockMode === "drill-prompt") {
    const enLines = block.lines.filter((l) => l.lang === "en");
    const question = enLines[0]?.english ?? "";
    const hint = enLines[1]?.english;
    return {
      cardType: "drillPrompt",
      cardKey: `drill-prompt:${block.id}`,
      props: {
        english: question,
        hint,
        imageSrc: blockImage,
      },
    };
  }

  // drill-answer: expected-answer triplet, one card for the block.
  if (blockMode === "drill-answer") {
    const thLine = block.lines.find((l) => l.lang === "th" || l.lang === "th-split");
    return {
      cardType: "text",
      cardKey: `drill-answer:${block.id}`,
      props: {
        thai: thLine?.thai ?? "",
        translit: thLine?.translit ?? "",
        english: thLine?.english ?? "",
        imageSrc: blockImage,
      },
    };
  }

  // recap: all 8 target phrases as a grid, for the whole block.
  if (blockMode === "recap") {
    const items = script.vocab.map((v) => ({
      thai: v.thai,
      translit: v.translit,
      english: v.english,
    }));
    return {
      cardType: "recapGrid",
      cardKey: `recap:${block.id}`,
      props: {
        items,
        imageSrc: blockImage,
      },
    };
  }

  // Section-type blocks (hook / intro / explain / outro / natural-listen /
  // shadowing / teaser): Thai chunk → TextCard triplet (becomes new sticky).
  // English chunk → null (persist the current card, which will be stickyCard
  // or BrandCard).
  if (chunk.lang === "th" || chunk.lang === "th-split") {
    const matchingLine = block.lines.find(
      (l) => l.thai === chunk.text || l.thaiSplit === chunk.text,
    );
    return {
      cardType: "text",
      cardKey: `th-line:${matchingLine?.id ?? chunk.chunkId}`,
      props: {
        thai: chunk.text,
        translit: chunk.translit ?? matchingLine?.translit ?? "",
        english: matchingLine?.english ?? "",
        imageSrc: blockImage,
      },
    };
  }

  return null;
}

function buildTimeline(episodeId: string): EpisodeTimeline {
  const scriptPath = resolve(YOUTUBE_DIR, "examples", `${episodeId}.json`);
  const phrasesPath = resolve(YOUTUBE_DIR, "phrases", `${episodeId}.phrases.timed.json`);
  const manifestPath = resolve(YOUTUBE_DIR, "images", episodeId, "image-manifest.json");

  const script: Script = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const phrases: PhraseFile = JSON.parse(readFileSync(phrasesPath, "utf-8"));
  const manifest: ImageManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf-8"))
    : { episodeId, images: [] };

  const episodeTitle = script.title ?? "";
  const blockById = new Map(script.blocks.map((b) => [b.id, b]));

  const timed = phrases.chunks.filter(
    (c) => typeof c.displayStart === "number" && Number.isFinite(c.displayStart),
  );
  const sorted = [...timed].sort((a, b) => a.displayStart - b.displayStart);

  const audioPath = resolve(YOUTUBE_DIR, "recordings", `${episodeId}.m4a`);
  const audioDurationSec = probeAudioDuration(audioPath);
  const totalFrames = Math.ceil(audioDurationSec * FPS);

  const brandCardFor = (blockId: string, imageSrc: string | null = null): ResolvedCard => ({
    cardType: "brand",
    cardKey: `brand:${blockId}`,
    props: { episodeTitle, imageSrc },
  });

  const events: TimelineEvent[] = [];
  const subtitles: SubtitleEntry[] = [];
  let lastCardKey: string | null = null;
  let sticky: StickyState = { vocabId: null, breakdownIndex: 0 };
  let stickyBlockId: string | null = null;
  let stickyCard: ResolvedCard | null = null;

  for (const chunk of sorted) {
    const startFrame = Math.round(chunk.displayStart * FPS);

    if (chunk.text && chunk.text.trim()) {
      subtitles.push({
        text: chunk.text,
        translit: chunk.translit ?? null,
        lang: (chunk.lang as SubtitleLang) ?? "en",
        startFrame,
      });
    }

    const block = blockById.get(chunk.blockRef);
    if (!block) continue;

    // Block boundary: reset per-block sticky. Teaser additionally clears the
    // cross-block stickyCard — its previews belong to a different episode.
    if (stickyBlockId !== block.id) {
      sticky = { vocabId: null, breakdownIndex: 0 };
      stickyBlockId = block.id;
      if (block.mode === "teaser") {
        stickyCard = null;
      }
    }
    if (chunk.triggerCard?.type === "vocab-card" && chunk.triggerCard.vocabId) {
      sticky.vocabId = chunk.triggerCard.vocabId;
    }

    if (block.mode === "breakdown" && (chunk.lang === "th" || chunk.lang === "th-split")) {
      const thLines = block.lines.filter((l) => l.lang === "th");
      const nextIdx = sticky.breakdownIndex + 1;
      if (nextIdx < thLines.length && thLines[nextIdx]!.thai === chunk.text) {
        sticky.breakdownIndex = nextIdx;
      }
    }

    const resolved = resolveCard(chunk, block, script, manifest, sticky);

    let cardToUse: ResolvedCard;
    if (resolved === null) {
      cardToUse = stickyCard ?? brandCardFor(block.id, imagePathFor(block.imageRef, manifest));
    } else {
      cardToUse = resolved;
      stickyCard = resolved;
    }

    if (cardToUse.cardKey === lastCardKey) continue;

    events.push({
      cardKey: cardToUse.cardKey,
      cardType: cardToUse.cardType,
      startFrame,
      durationInFrames: 0,
      props: cardToUse.props as TimelineEvent["props"],
    });
    lastCardKey = cardToUse.cardKey;
  }

  // Pre-roll: leading silence before first phrase → BrandCard.
  if (events[0] && events[0].startFrame > 0) {
    events.unshift({
      cardKey: "brand:preroll",
      cardType: "brand",
      startFrame: 0,
      durationInFrames: 0,
      props: { episodeTitle, imageSrc: null } as TimelineEvent["props"],
    });
  }

  for (let i = 0; i < events.length; i++) {
    const endFrame =
      i + 1 < events.length ? events[i + 1]!.startFrame : totalFrames;
    events[i]!.durationInFrames = Math.max(1, endFrame - events[i]!.startFrame);
  }

  return {
    episodeId,
    episodeTitle,
    fps: FPS,
    totalDurationInFrames: totalFrames,
    audioSrc: `audio/${episodeId}.m4a`,
    pipSrc: null,
    events,
    subtitles,
  };
}

function probeAudioDuration(audioPath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: "utf-8" },
    );
    const seconds = parseFloat(out.trim());
    if (Number.isFinite(seconds)) return seconds;
  } catch {
    // fall through
  }
  console.warn(`ffprobe failed for ${audioPath}; defaulting to 720s`);
  return 720;
}

// ---------------------------------------------------------------------------
// Symlink staticFile inputs
// ---------------------------------------------------------------------------

function ensureSymlink(target: string, linkPath: string) {
  if (existsSync(linkPath) || lstatExists(linkPath)) {
    try {
      unlinkSync(linkPath);
    } catch {
      // continue
    }
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  const rel = relative(dirname(linkPath), target);
  symlinkSync(rel, linkPath, "dir");
}

function lstatExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function syncStaticFiles(_episodeId: string) {
  ensureSymlink(resolve(YOUTUBE_DIR, "recordings"), resolve(PUBLIC_DIR, "audio"));
  ensureSymlink(resolve(YOUTUBE_DIR, "images"), resolve(PUBLIC_DIR, "images"));
  console.log(`Symlinked public/audio → youtube/recordings`);
  console.log(`Symlinked public/images → youtube/images`);
}

// ---------------------------------------------------------------------------
// QA gates
// ---------------------------------------------------------------------------

interface QAReport {
  passed: boolean;
  issues: string[];
}

const FORBIDDEN_TITLES = new Set([
  "Hook",
  "Intro",
  "Recap",
  "Coming next",
  "Outro",
  "Now you try",
  "Natural speed",
  "What you'll learn",
]);

function runQA(timeline: EpisodeTimeline): QAReport {
  const issues: string[] = [];

  for (const ev of timeline.events) {
    if (ev.durationInFrames <= 0) {
      issues.push(`event ${ev.cardKey}: non-positive duration`);
    }
    if (ev.startFrame < 0) {
      issues.push(`event ${ev.cardKey}: negative startFrame`);
    }
  }

  for (let i = 1; i < timeline.events.length; i++) {
    const prev = timeline.events[i - 1]!;
    const curr = timeline.events[i]!;
    const expected = prev.startFrame + prev.durationInFrames;
    if (Math.abs(curr.startFrame - expected) > 1) {
      issues.push(
        `gap or overlap between ${prev.cardKey} and ${curr.cardKey} (expected ${expected}, got ${curr.startFrame})`,
      );
    }
  }

  for (const ev of timeline.events) {
    const props = ev.props as Record<string, unknown>;
    const thai = typeof props.thai === "string" ? props.thai : "";
    const translit = typeof props.translit === "string" ? props.translit : "";
    if (thai && !translit) {
      issues.push(`event ${ev.cardKey}: Thai without translit`);
    }
  }

  for (const ev of timeline.events) {
    const props = ev.props as Record<string, unknown>;
    const imageSrc = typeof props.imageSrc === "string" ? props.imageSrc : null;
    if (!imageSrc) continue;
    const fullPath = resolve(PUBLIC_DIR, imageSrc);
    if (!existsSync(fullPath)) {
      issues.push(`event ${ev.cardKey}: imageSrc not found (${imageSrc})`);
    }
  }

  for (const ev of timeline.events) {
    if (ev.cardType === "brand") {
      const props = ev.props as { episodeTitle?: string };
      if (!props.episodeTitle || !props.episodeTitle.trim()) {
        issues.push(`event ${ev.cardKey}: brand card has empty episodeTitle`);
      }
    }
    if (ev.cardType === "recapGrid") {
      const props = ev.props as { items?: unknown[] };
      if (!Array.isArray(props.items) || props.items.length === 0) {
        issues.push(`event ${ev.cardKey}: recapGrid card has no items`);
      }
    }
    const props = ev.props as Record<string, unknown>;
    if (typeof props.title === "string" && FORBIDDEN_TITLES.has(props.title)) {
      issues.push(`event ${ev.cardKey}: forbidden section title "${props.title}"`);
    }
  }

  for (let i = 0; i < timeline.subtitles.length; i++) {
    const s = timeline.subtitles[i]!;
    if (!s.text || !s.text.trim()) {
      issues.push(`subtitle[${i}]: empty text`);
    }
    if (s.startFrame < 0) {
      issues.push(`subtitle[${i}]: negative startFrame`);
    }
    if (i > 0 && s.startFrame < timeline.subtitles[i - 1]!.startFrame) {
      issues.push(`subtitle[${i}]: out of order (frame ${s.startFrame} < prev ${timeline.subtitles[i - 1]!.startFrame})`);
    }
  }

  if (!timeline.episodeTitle || !timeline.episodeTitle.trim()) {
    issues.push(`timeline.episodeTitle is empty`);
  }

  return { passed: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function writeTimeline(timeline: EpisodeTimeline) {
  const outDir = resolve(PUBLIC_DIR, "episodes");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${timeline.episodeId}.timeline.json`);
  writeFileSync(outPath, JSON.stringify(timeline, null, 2), "utf-8");
  console.log(`Wrote timeline → ${relative(REMOTION_ROOT, outPath)}`);
  console.log(`  events: ${timeline.events.length}`);
  console.log(`  subtitles: ${timeline.subtitles.length}`);
  console.log(`  duration: ${(timeline.totalDurationInFrames / timeline.fps).toFixed(1)}s`);
  console.log(`  episodeTitle: ${timeline.episodeTitle}`);
}

function cmdBuild(episodeId: string) {
  syncStaticFiles(episodeId);
  const timeline = buildTimeline(episodeId);
  writeTimeline(timeline);
  const report = runQA(timeline);
  if (!report.passed) {
    console.warn(`\nQA: ${report.issues.length} issues (run \`pipeline qa\` for detail)`);
  } else {
    console.log("QA: clean");
  }
}

function cmdQA(episodeId: string) {
  const timeline = readTimeline(episodeId);
  const report = runQA(timeline);
  if (!report.passed) {
    console.error(`QA failed: ${report.issues.length} issues`);
    for (const issue of report.issues) console.error(`  - ${issue}`);
    process.exit(1);
  }
  console.log(`QA passed: ${timeline.events.length} events, ${timeline.subtitles.length} subtitles`);
}

function cmdRender(episodeId: string) {
  const timeline = readTimeline(episodeId);
  const report = runQA(timeline);
  if (!report.passed) {
    console.error(`QA failed: refusing to render. Run \`pipeline qa --episode ${episodeId}\``);
    process.exit(1);
  }
  const outPath = resolve(REMOTION_ROOT, "out", `${episodeId}.mp4`);
  mkdirSync(dirname(outPath), { recursive: true });
  const cmd = `npx remotion render Episode "${outPath}" --props='${JSON.stringify({ episodeId })}'`;
  console.log(cmd);
  execSync(cmd, { stdio: "inherit", cwd: REMOTION_ROOT });
}

function readTimeline(episodeId: string): EpisodeTimeline {
  const path = resolve(PUBLIC_DIR, "episodes", `${episodeId}.timeline.json`);
  if (!existsSync(path)) {
    console.error(`Timeline not found: ${path}\nRun \`pipeline build --episode ${episodeId}\` first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { cmd: string; episode: string } {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const epIdx = args.indexOf("--episode");
  const episode = epIdx >= 0 ? args[epIdx + 1] : undefined;
  if (!cmd || !episode) {
    console.error("Usage: tsx tools/pipeline.ts <build|qa|render> --episode <id>");
    process.exit(1);
  }
  return { cmd, episode };
}

const { cmd, episode } = parseArgs();
switch (cmd) {
  case "build":
    cmdBuild(episode);
    break;
  case "qa":
    cmdQA(episode);
    break;
  case "render":
    cmdRender(episode);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
