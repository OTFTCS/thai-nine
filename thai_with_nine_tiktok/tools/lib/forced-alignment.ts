import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { TranscriptSegment } from "./post-production.ts";

export type AlignerName = "none" | "whisperx";

export type AlignmentResult =
  | { ok: true; segments: TranscriptSegment[]; method: "whisperx" }
  | { ok: false; error: string; method: "whisperx" };

/**
 * Check if `whisperx` is available in PATH without downloading any model.
 * Returns false if the command is not found or spawn fails.
 */
export function whisperxAvailable(): boolean {
  const result = spawnSync("whisperx", ["--help"], {
    stdio: "ignore",
    shell: false,
    timeout: 5_000,
  });
  // status === null means spawn failed (command not found / ENOENT)
  // status === 127 is shell "command not found"
  return result.status !== null && result.status !== 127 && !result.error;
}

/**
 * Extract a 16 kHz mono WAV from a video file using ffmpeg.
 * Returns true if the output file was successfully created.
 */
export function extractWavFromVideo(videoPath: string, outWavPath: string): boolean {
  try {
    execSync(
      `ffmpeg -y -i "${videoPath.replace(/"/g, '\\"')}" -ar 16000 -ac 1 -vn "${outWavPath.replace(/"/g, '\\"')}"`,
      { stdio: ["ignore", "ignore", "ignore"], timeout: 120_000 },
    );
    return existsSync(outWavPath);
  } catch {
    return false;
  }
}

/**
 * Parse raw WhisperX JSON output (--output_format json) into TranscriptSegments.
 * WhisperX produces { segments: [{start, end, text, words?}], language? }.
 * Exported for unit testing without running the CLI.
 */
export function parseWhisperXJson(raw: string): TranscriptSegment[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return [];

  const obj = parsed as Record<string, unknown>;
  const segs: unknown[] = Array.isArray(obj["segments"])
    ? (obj["segments"] as unknown[])
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];

  return segs
    .map((s) => {
      const seg = (s ?? {}) as Record<string, unknown>;
      return {
        startSec: Number(seg["start"] ?? 0),
        endSec: Number(seg["end"] ?? 0),
        text: String(seg["text"] ?? "").trim(),
      };
    })
    .filter((seg) => seg.text.length > 0)
    .map((seg) => ({
      ...seg,
      endSec: Math.max(seg.startSec + 0.6, seg.endSec),
    }));
}

/**
 * Run WhisperX forced alignment on an audio/video source.
 *
 * Behaviour:
 * - If `audioPath` is not provided and `videoPath` is, extracts WAV with ffmpeg.
 * - Runs `whisperx <audio> --output_format json --output_dir <tmp>`.
 * - Returns structured segments on success, or a { ok: false } error on any failure.
 *
 * All temp files are cleaned up regardless of outcome.
 */
export function runWhisperXAlignment(opts: {
  videoPath: string | null;
  audioPath: string | null;
  transcriptText: string;
  lang: string;
}): AlignmentResult {
  if (!whisperxAvailable()) {
    return {
      ok: false,
      error: "whisperx not found in PATH — install it (see README) or use --aligner none",
      method: "whisperx",
    };
  }

  const tmpDir = join(tmpdir(), `tiktok-align-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    let audioSrc = opts.audioPath;

    if (!audioSrc && opts.videoPath) {
      const wavPath = join(tmpDir, "audio.wav");
      console.warn("[alignment] Extracting audio from video with ffmpeg...");
      const ok = extractWavFromVideo(opts.videoPath, wavPath);
      if (!ok) {
        return {
          ok: false,
          error: "ffmpeg audio extraction failed — check ffmpeg is installed and the video path is valid",
          method: "whisperx",
        };
      }
      audioSrc = wavPath;
    }

    if (!audioSrc) {
      return {
        ok: false,
        error: "no audio source: provide --audio <path> or --video <path>",
        method: "whisperx",
      };
    }

    const outDir = join(tmpDir, "wx-out");
    mkdirSync(outDir, { recursive: true });

    const args: string[] = [audioSrc, "--output_format", "json", "--output_dir", outDir];
    if (opts.lang !== "auto") {
      args.push("--language", opts.lang);
    }

    console.warn(`[alignment] Running whisperx on ${audioSrc}...`);
    const result = spawnSync("whisperx", args, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 300_000,
    });

    if (result.error) {
      return { ok: false, error: `whisperx spawn error: ${result.error.message}`, method: "whisperx" };
    }

    if (result.status !== 0) {
      const stderr = String(result.stderr ?? "").slice(0, 600);
      return {
        ok: false,
        error: `whisperx exited ${result.status ?? "null"}: ${stderr}`,
        method: "whisperx",
      };
    }

    const jsonFiles = readdirSync(outDir).filter((f) => f.endsWith(".json"));
    if (jsonFiles.length === 0) {
      return { ok: false, error: "whisperx produced no JSON output file", method: "whisperx" };
    }

    const jsonPath = join(outDir, jsonFiles[0]!);
    const raw = readFileSync(jsonPath, "utf8");

    let segments: TranscriptSegment[];
    try {
      segments = parseWhisperXJson(raw);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return { ok: false, error: `whisperx JSON parse error: ${msg}`, method: "whisperx" };
    }

    if (segments.length === 0) {
      return { ok: false, error: "whisperx output contained 0 usable segments", method: "whisperx" };
    }

    return { ok: true, segments, method: "whisperx" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `whisperx unexpected error: ${message}`, method: "whisperx" };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup failure is non-fatal
    }
  }
}
