#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import {
  applyCpsCap,
  buildCaptionFrames,
  buildRemotionOverlayData,
  buildVisualCues,
  captionsToSrt,
  getVideoDurationSec,
  parseTranscriptFile,
} from "./lib/post-production.ts";
import { type AlignerName, runWhisperXAlignment } from "./lib/forced-alignment.ts";
import {
  generateScriptFromBrief,
  renderScriptMarkdown,
  type GeneratedScript,
  type ScriptBrief,
  validateBriefTransliteration,
} from "./lib/script-generator.ts";

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function usage(): void {
  console.log(`Thai With Nine TikTok CLI

Commands:
  generate-script --brief <path> [--out-dir <path>] [--name <slug>]
  validate-script --script <path>
  build-post --video <path> --transcript <path> [--fps 30] [--width 1080] [--height 1920]
             [--no-render] [--dry-run] [--output <name>]
             [--aligner none|whisperx] [--audio <path>] [--lang <code>] [--max-cps <number>]

build-post alignment flags:
  --aligner  whisperx | none (default: none)
             whisperx: run WhisperX locally for forced alignment; falls back to
             parseTranscriptFile on any failure.
  --audio    Pre-extracted audio file (wav/mp3). If omitted and --aligner whisperx,
             audio is extracted from --video using ffmpeg.
  --lang     Language code passed to WhisperX (default: auto).
             Examples: th, en, ja
  --max-cps  Max characters-per-second per caption. Segments exceeding this are
             split at word boundaries. Default: 17.

Examples:
  node --experimental-strip-types thai_with_nine_tiktok/tools/tiktok-cli.ts generate-script --brief thai_with_nine_tiktok/samples/brief-one-word-many-uses.json
  node --experimental-strip-types thai_with_nine_tiktok/tools/tiktok-cli.ts build-post --video ~/Desktop/raw.mp4 --transcript notes/transcript.srt
  node --experimental-strip-types thai_with_nine_tiktok/tools/tiktok-cli.ts build-post --video ~/Desktop/raw.mp4 --transcript notes/transcript.srt --aligner whisperx --lang th
  node --experimental-strip-types thai_with_nine_tiktok/tools/tiktok-cli.ts build-post --video ~/Desktop/raw.mp4 --transcript notes/transcript.srt --aligner whisperx --audio ~/Desktop/raw-audio.wav --max-cps 14
`);
}

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function loadBrief(path: string): ScriptBrief {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ScriptBrief;
}

function writeScriptArtifacts(script: GeneratedScript, outDir: string, baseName: string): { jsonPath: string; markdownPath: string } {
  ensureDir(outDir);
  const jsonPath = join(outDir, `${baseName}.json`);
  const markdownPath = join(outDir, `${baseName}.md`);

  writeFileSync(jsonPath, `${JSON.stringify(script, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderScriptMarkdown(script), "utf8");

  return { jsonPath, markdownPath };
}

function runGenerateScript(): number {
  const briefPath = getArg("--brief");
  if (!briefPath) {
    console.error("Missing --brief <path>");
    return 1;
  }

  const absoluteBriefPath = resolve(process.cwd(), briefPath);
  const brief = loadBrief(absoluteBriefPath);
  const script = generateScriptFromBrief(brief);

  const generatedSlug = brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const slug = getArg("--name") ?? (generatedSlug || `script-${nowStamp()}`);
  const outDir = resolve(process.cwd(), getArg("--out-dir") ?? "thai_with_nine_tiktok/out/scripts");
  const paths = writeScriptArtifacts(script, outDir, slug);

  if (!script.transliterationValidation.ok) {
    console.error("Script generated with transliteration policy violations:");
    for (const issue of script.transliterationValidation.issues) {
      console.error(`- ${issue.lexemeThai} (${issue.translit})`);
      for (const message of issue.messages) {
        console.error(`  - ${message}`);
      }
    }
    console.log(`Saved draft anyway: ${paths.jsonPath}`);
    return 2;
  }

  console.log(`Script generated: ${paths.jsonPath}`);
  console.log(`Readable markdown: ${paths.markdownPath}`);
  return 0;
}

function validateScriptFile(scriptPath: string): number {
  const raw = readFileSync(scriptPath, "utf8");
  const script = JSON.parse(raw) as GeneratedScript;

  const lexemes = script.sections.teachingBlocks.flatMap((block) =>
    block.examples.map((example) => ({ thai: example.thai, translit: example.translit, english: example.english })),
  );

  const issues = validateBriefTransliteration(lexemes);

  if (issues.length === 0) {
    console.log("Transliteration validation PASS");
    return 0;
  }

  console.error("Transliteration validation FAIL");
  for (const issue of issues) {
    console.error(`- ${issue.lexemeThai} (${issue.translit})`);
    for (const message of issue.messages) {
      console.error(`  - ${message}`);
    }
  }

  return 2;
}

function runValidateScript(): number {
  const scriptPath = getArg("--script");
  if (!scriptPath) {
    console.error("Missing --script <path>");
    return 1;
  }
  return validateScriptFile(resolve(process.cwd(), scriptPath));
}

function runBuildPost(): number {
  const transcriptArg = getArg("--transcript");
  if (!transcriptArg) {
    console.error("Missing --transcript <path>");
    return 1;
  }

  const dryRun = hasFlag("--dry-run");
  const shouldRender = !hasFlag("--no-render") && !dryRun;
  const videoArg = getArg("--video");

  if (!videoArg && !dryRun) {
    console.error("Missing --video <path>. Use --dry-run for timeline-only generation.");
    return 1;
  }

  const fps = Number(getArg("--fps") ?? "30");
  const width = Number(getArg("--width") ?? "1080");
  const height = Number(getArg("--height") ?? "1920");
  const maxCps = Number(getArg("--max-cps") ?? "17");
  const aligner = (getArg("--aligner") ?? "none") as AlignerName;
  const audioArg = getArg("--audio");
  const lang = getArg("--lang") ?? "auto";

  const transcriptPath = resolve(process.cwd(), transcriptArg);
  const videoPath = videoArg ? resolve(process.cwd(), videoArg) : null;
  const audioPath = audioArg ? resolve(process.cwd(), audioArg) : null;
  const videoDuration = videoPath && existsSync(videoPath) ? getVideoDurationSec(videoPath) : null;

  let segments = parseTranscriptFile(transcriptPath, videoDuration);
  let alignerUsed = "none";

  if (aligner === "whisperx") {
    const transcriptText = readFileSync(transcriptPath, "utf8");
    const alignResult = runWhisperXAlignment({
      videoPath,
      audioPath,
      transcriptText,
      lang,
    });

    if (alignResult.ok) {
      segments = alignResult.segments;
      alignerUsed = "whisperx";
      console.log(`Alignment: whisperx succeeded (${segments.length} segments)`);
    } else {
      console.warn(`[alignment] WhisperX failed: ${alignResult.error}`);
      console.warn("[alignment] Falling back to parseTranscriptFile.");
    }
  }

  // Apply CPS readability cap (split segments that scroll too fast to read)
  const cappedSegments = applyCpsCap(segments, maxCps);
  if (cappedSegments.length !== segments.length) {
    console.log(`CPS cap (${maxCps} cps): ${segments.length} → ${cappedSegments.length} segments after splitting`);
  }
  segments = cappedSegments;

  const captions = buildCaptionFrames(segments, fps);
  const cues = buildVisualCues(captions, fps);

  const stamp = nowStamp();
  const artifactDir = resolve(process.cwd(), "thai_with_nine_tiktok/out/post", stamp);
  ensureDir(artifactDir);

  const remotionRoot = resolve(process.cwd(), "thaiwith-nine-remotion");
  const remotionDataPath = join(remotionRoot, "src", "data", "auto-generated.json");
  const publicAutogenDir = join(remotionRoot, "public", "autogen");
  ensureDir(publicAutogenDir);

  const videoFilename = videoPath ? basename(videoPath) : "placeholder.mp4";
  const remotionVideoSrc = `autogen/${videoFilename}`;

  const remotionData = buildRemotionOverlayData({
    transcriptPath,
    videoSrc: remotionVideoSrc,
    fps,
    width,
    height,
    captions,
    cues,
  });

  writeFileSync(join(artifactDir, "subtitles.srt"), captionsToSrt(captions, fps), "utf8");
  writeFileSync(join(artifactDir, "overlay-cues.json"), `${JSON.stringify(cues, null, 2)}\n`, "utf8");
  writeFileSync(join(artifactDir, "remotion-data.json"), `${JSON.stringify(remotionData, null, 2)}\n`, "utf8");
  writeFileSync(remotionDataPath, `${JSON.stringify(remotionData, null, 2)}\n`, "utf8");

  if (!dryRun && videoPath) {
    cpSync(videoPath, join(publicAutogenDir, videoFilename));
  }

  const outputName = getArg("--output") ?? `auto-${stamp}.mp4`;
  const outputPath = join(remotionRoot, "out", outputName);

  if (shouldRender) {
    execSync(`./node_modules/.bin/remotion render src/index.ts AutoTikTokOverlay "${outputPath}"`, {
      cwd: remotionRoot,
      stdio: "inherit",
    });
  }

  console.log(`Aligner: ${alignerUsed}`);
  console.log(`Transcript segments: ${segments.length}`);
  console.log(`Captions generated: ${captions.length}`);
  console.log(`Visual cues generated: ${cues.length}`);
  console.log(`Artifacts: ${artifactDir}`);
  console.log(`Remotion data: ${remotionDataPath}`);
  if (!dryRun) {
    console.log(`Video copied to: ${join(publicAutogenDir, videoFilename)}`);
  }
  if (shouldRender) {
    console.log(`Rendered video: ${outputPath}`);
  } else {
    console.log("Render skipped (--no-render or --dry-run).");
  }

  return 0;
}

function main(): number {
  const cmd = process.argv[2];
  if (!cmd) {
    usage();
    return 1;
  }

  switch (cmd) {
    case "generate-script":
      return runGenerateScript();
    case "validate-script":
      return runValidateScript();
    case "build-post":
      return runBuildPost();
    default:
      usage();
      return 1;
  }
}

process.exit(main());
