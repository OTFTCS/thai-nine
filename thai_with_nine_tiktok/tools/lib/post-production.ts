import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface CaptionFrame {
  startFrame: number;
  endFrame: number;
  text: string;
}

export interface VisualCue {
  startFrame: number;
  endFrame: number;
  label: string;
  searchQuery: string;
  emoji: string;
}

export interface RemotionOverlayData {
  schemaVersion: 1;
  compositionId: "AutoTikTokOverlay";
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  videoSrc: string;
  captions: CaptionFrame[];
  cues: VisualCue[];
  source: {
    transcriptPath: string;
    generatedAt: string;
  };
}

interface JsonTranscriptSegment {
  start?: number;
  end?: number;
  startSec?: number;
  endSec?: number;
  text?: string;
}

function parseTimestamp(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  const [h = "0", m = "0", s = "0"] = normalized.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function splitPlainTextIntoSegments(text: string, fallbackDurationSec: number | null): TranscriptSegment[] {
  const chunks = text
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [{ startSec: 0, endSec: fallbackDurationSec ?? 4, text: text.trim() || "(no transcript text)" }];
  }

  const words = chunks.map((chunk) => chunk.split(/\s+/).filter(Boolean).length);
  const totalWords = words.reduce((sum, count) => sum + count, 0);
  const totalDuration = fallbackDurationSec ?? Math.max(8, Math.round((totalWords / 140) * 60));

  let cursor = 0;
  return chunks.map((chunk, index) => {
    const ratio = words[index] / Math.max(1, totalWords);
    const duration = Math.max(1.25, ratio * totalDuration);
    const startSec = cursor;
    const endSec = index === chunks.length - 1 ? totalDuration : cursor + duration;
    cursor = endSec;
    return { startSec, endSec, text: chunk };
  });
}

function parseSrtLike(raw: string): TranscriptSegment[] {
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;

    const [rawStart, rawEnd] = timeLine.split("-->").map((part) => part.trim());
    const text = lines.filter((line) => line !== timeLine && !/^\d+$/.test(line)).join(" ").trim();

    if (!text) continue;
    const startSec = parseTimestamp(rawStart ?? "0");
    const endSec = parseTimestamp(rawEnd ?? rawStart ?? "0") || startSec + 2;

    segments.push({
      startSec,
      endSec: Math.max(startSec + 0.6, endSec),
      text,
    });
  }

  return segments;
}

function parseJsonTranscript(raw: string): TranscriptSegment[] {
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        const segment = item as JsonTranscriptSegment;
        return {
          startSec: segment.startSec ?? segment.start ?? 0,
          endSec: segment.endSec ?? segment.end ?? (segment.startSec ?? segment.start ?? 0) + 2,
          text: segment.text?.trim() ?? "",
        };
      })
      .filter((segment) => segment.text.length > 0)
      .map((segment) => ({
        ...segment,
        endSec: Math.max(segment.startSec + 0.6, segment.endSec),
      }));
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { segments?: unknown[] }).segments)) {
    return parseJsonTranscript(JSON.stringify((parsed as { segments: unknown[] }).segments));
  }

  return [];
}

export function parseTranscriptFile(path: string, fallbackDurationSec: number | null): TranscriptSegment[] {
  const raw = readFileSync(path, "utf8").trim();

  if (!raw) {
    return [{ startSec: 0, endSec: fallbackDurationSec ?? 4, text: "(empty transcript)" }];
  }

  if (path.endsWith(".json")) {
    const jsonSegments = parseJsonTranscript(raw);
    if (jsonSegments.length > 0) return jsonSegments;
  }

  if (path.endsWith(".srt") || path.endsWith(".vtt")) {
    const srtSegments = parseSrtLike(raw);
    if (srtSegments.length > 0) return srtSegments;
  }

  if (raw.includes("-->") && /\d{2}:\d{2}:\d{2}/.test(raw)) {
    const srtSegments = parseSrtLike(raw);
    if (srtSegments.length > 0) return srtSegments;
  }

  return splitPlainTextIntoSegments(raw, fallbackDurationSec);
}

export function getVideoDurationSec(videoPath: string): number | null {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath.replace(/"/g, '\\"')}"`,
      {
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .toString("utf8")
      .trim();

    const parsed = Number(output);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function buildCaptionFrames(segments: TranscriptSegment[], fps: number): CaptionFrame[] {
  return segments.map((segment) => {
    const startFrame = Math.max(0, Math.floor(segment.startSec * fps));
    const endFrame = Math.max(startFrame + Math.max(12, Math.round(0.45 * fps)), Math.floor(segment.endSec * fps));
    return {
      startFrame,
      endFrame,
      text: segment.text,
    };
  });
}

function cueFromText(text: string): { label: string; emoji: string; query: string } {
  const lower = text.toLowerCase();

  if (/wrong|fix|mistake|error/.test(lower)) return { label: "Contrast Fix", emoji: "⚖️", query: "thai language correction teaching" };
  if (/example|use|sentence/.test(lower)) return { label: "Real-life Example", emoji: "🧩", query: "thailand street conversation" };
  if (/comment|save|follow|duet/.test(lower)) return { label: "Engagement CTA", emoji: "📲", query: "social media engagement icon" };
  if (/tone|pronunciation|sound/.test(lower)) return { label: "Pronunciation Focus", emoji: "🎧", query: "audio waveform thai language" };

  return { label: "Visual Support", emoji: "🖼️", query: "thai culture lifestyle visual" };
}

export function buildVisualCues(captions: CaptionFrame[], fps: number): VisualCue[] {
  if (captions.length === 0) return [];

  const cueStride = Math.max(1, Math.floor(captions.length / 6));
  const cues: VisualCue[] = [];

  for (let index = 0; index < captions.length; index += cueStride) {
    const caption = captions[index];
    if (!caption) continue;

    const cue = cueFromText(caption.text);
    cues.push({
      startFrame: caption.startFrame,
      endFrame: Math.min(caption.endFrame + Math.round(0.4 * fps), caption.startFrame + Math.round(2.5 * fps)),
      label: cue.label,
      emoji: cue.emoji,
      searchQuery: cue.query,
    });
  }

  return cues;
}

export function buildRemotionOverlayData(input: {
  transcriptPath: string;
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  captions: CaptionFrame[];
  cues: VisualCue[];
}): RemotionOverlayData {
  const lastCaption = input.captions[input.captions.length - 1];
  const durationInFrames = Math.max(lastCaption?.endFrame ?? 0, 1);

  return {
    schemaVersion: 1,
    compositionId: "AutoTikTokOverlay",
    fps: input.fps,
    width: input.width,
    height: input.height,
    durationInFrames,
    videoSrc: input.videoSrc,
    captions: input.captions,
    cues: input.cues,
    source: {
      transcriptPath: input.transcriptPath,
      generatedAt: new Date().toISOString(),
    },
  };
}

function formatSrtTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe - Math.floor(safe)) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Split segments that exceed `maxCps` characters-per-second into smaller chunks
 * at word boundaries, distributing time proportionally by character count.
 * Segments already within the limit pass through unchanged.
 * Pass maxCps <= 0 to disable splitting.
 */
export function applyCpsCap(segments: TranscriptSegment[], maxCps: number): TranscriptSegment[] {
  if (maxCps <= 0) return segments;

  const result: TranscriptSegment[] = [];

  for (const seg of segments) {
    const duration = seg.endSec - seg.startSec;
    if (duration <= 0 || seg.text.length === 0) {
      result.push(seg);
      continue;
    }

    const cps = seg.text.length / duration;
    if (cps <= maxCps) {
      result.push(seg);
      continue;
    }

    const words = seg.text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      // Cannot split a single word — emit as-is
      result.push(seg);
      continue;
    }

    const chunksNeeded = Math.ceil(cps / maxCps);
    const wordsPerChunk = Math.ceil(words.length / chunksNeeded);

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
    }

    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
    let cursor = seg.startSec;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]!;
      const isLast = ci === chunks.length - 1;
      const ratio = chunk.length / Math.max(1, totalChars);
      const chunkDuration = ratio * duration;
      const endSec = isLast ? seg.endSec : cursor + chunkDuration;
      result.push({
        startSec: cursor,
        endSec: Math.max(cursor + 0.6, endSec),
        text: chunk,
      });
      cursor = isLast ? seg.endSec : endSec;
    }
  }

  return result;
}

export function captionsToSrt(captions: CaptionFrame[], fps: number): string {
  return captions
    .map((caption, index) => {
      const start = caption.startFrame / fps;
      const end = caption.endFrame / fps;
      return [
        String(index + 1),
        `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
        caption.text,
        "",
      ].join("\n");
    })
    .join("\n");
}
