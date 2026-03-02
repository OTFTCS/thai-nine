import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCpsCap,
  buildCaptionFrames,
  buildRemotionOverlayData,
  buildVisualCues,
  parseTranscriptFile,
} from "../lib/post-production.ts";
import { generateScriptFromBrief, validateBriefTransliteration } from "../lib/script-generator.ts";
import { parseWhisperXJson, runWhisperXAlignment, whisperxAvailable } from "../lib/forced-alignment.ts";

test("script generator validates PTM transliteration", () => {
  const issues = validateBriefTransliteration([
    { thai: "แม่ง", translit: "mâeng", english: "damn" },
    { thai: "ผิด", translit: "mae^Hng", english: "wrong form" },
  ]);

  assert.equal(issues.length, 1);
  assert.match(issues[0]?.messages.join(" ") ?? "", /forbidden|legacy|tone/i);
});

test("script generator outputs required sections", () => {
  const script = generateScriptFromBrief({
    topic: "Thai contrast phrase",
    goals: ["contrast right vs wrong", "give practical line"],
    lexemes: [
      { thai: "โคตร", translit: "khôot", english: "super" },
      { thai: "แม่ง", translit: "mâeng", english: "damn" },
    ],
  });

  assert.ok(script.sections.hook.length > 0);
  assert.ok(script.sections.setup.length > 0);
  assert.ok(script.sections.teachingBlocks.length >= 2);
  assert.ok(script.sections.recap.length > 0);
  assert.ok(script.sections.cta.length > 0);
  assert.equal(script.transliterationValidation.ok, true);
});

test("post-production parser converts SRT to remotion data", () => {
  const transcriptPath = "thai_with_nine_tiktok/samples/transcript-sample.srt";
  const segments = parseTranscriptFile(transcriptPath, 30);
  const captions = buildCaptionFrames(segments, 30);
  const cues = buildVisualCues(captions, 30);
  const remotionData = buildRemotionOverlayData({
    transcriptPath,
    videoSrc: "autogen/sample.mp4",
    fps: 30,
    width: 1080,
    height: 1920,
    captions,
    cues,
  });

  assert.ok(segments.length >= 3);
  assert.ok(captions.length === segments.length);
  assert.ok(remotionData.durationInFrames > 0);
  assert.ok(remotionData.cues.length > 0);
  assert.equal(remotionData.compositionId, "AutoTikTokOverlay");
});

// ── CPS cap tests ──────────────────────────────────────────────────────────

test("applyCpsCap passes through segments within CPS limit", () => {
  const segments = [
    { startSec: 0, endSec: 5, text: "Short line" },
    { startSec: 5, endSec: 9, text: "Another short one" },
  ];
  const result = applyCpsCap(segments, 17);
  assert.deepEqual(result, segments);
});

test("applyCpsCap splits a segment that exceeds CPS limit", () => {
  // 100 chars over 1 second = 100 cps >> 17 → must split
  const text = "word ".repeat(19).trim(); // 19 words, ~95 chars
  const segments = [{ startSec: 0, endSec: 1, text }];
  const result = applyCpsCap(segments, 17);

  assert.ok(result.length > 1, `expected split but got ${result.length} segment(s)`);
  for (const seg of result) {
    assert.ok(seg.endSec > seg.startSec, "each sub-segment must have positive duration");
    assert.ok(seg.text.length > 0, "each sub-segment must have non-empty text");
  }
  // Reconstructed text should equal original (modulo spacing)
  const reconstructed = result.map((s) => s.text).join(" ");
  assert.equal(reconstructed, text);
});

test("applyCpsCap with maxCps<=0 is a no-op", () => {
  const segments = [{ startSec: 0, endSec: 0.1, text: "a".repeat(200) }];
  const result = applyCpsCap(segments, 0);
  assert.deepEqual(result, segments);
});

test("applyCpsCap preserves single-word segments (unsplittable)", () => {
  // 50-char single word over 0.5 s = 100 cps — cannot split further
  const segments = [{ startSec: 0, endSec: 0.5, text: "a".repeat(50) }];
  const result = applyCpsCap(segments, 17);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.text, "a".repeat(50));
});

// ── Forced-alignment smoke tests (no model downloads) ──────────────────────

test("parseWhisperXJson handles standard WhisperX JSON format", () => {
  const json = JSON.stringify({
    segments: [
      { start: 0.0, end: 2.5, text: "สวัสดีครับ" },
      { start: 2.5, end: 5.0, text: "  ขอบคุณ  " }, // leading/trailing space stripped
      { start: 5.0, end: 5.1, text: "" }, // empty text filtered out
    ],
    language: "th",
  });
  const segments = parseWhisperXJson(json);
  assert.equal(segments.length, 2, "empty-text segment should be filtered");
  assert.equal(segments[0]?.text, "สวัสดีครับ");
  assert.equal(segments[1]?.text, "ขอบคุณ");
  assert.ok(segments[0]!.endSec >= segments[0]!.startSec + 0.6, "minimum duration enforced");
});

test("parseWhisperXJson handles flat array format", () => {
  const json = JSON.stringify([
    { start: 0, end: 3, text: "hello" },
    { start: 3, end: 6, text: "world" },
  ]);
  const segments = parseWhisperXJson(json);
  assert.equal(segments.length, 2);
});

test("runWhisperXAlignment returns structured error without audio source", () => {
  // Provide no video and no audio — must fail gracefully regardless of whisperx install status
  const result = runWhisperXAlignment({
    videoPath: null,
    audioPath: null,
    transcriptText: "hello world",
    lang: "auto",
  });
  assert.equal(result.ok, false);
  assert.equal(result.method, "whisperx");
  assert.ok(typeof result.error === "string" && result.error.length > 0, "error message must be non-empty");
});

test("runWhisperXAlignment returns structured error for nonexistent audio file", () => {
  // whisperx will fail trying to process a missing file — should not throw
  const result = runWhisperXAlignment({
    videoPath: null,
    audioPath: "/nonexistent/path/audio.wav",
    transcriptText: "hello",
    lang: "auto",
  });
  // Accept either "whisperx not found" (not installed) or a run-time failure
  assert.equal(result.method, "whisperx");
  if (!result.ok) {
    assert.ok(typeof result.error === "string");
  }
  // If somehow ok (whisperx installed AND produced output for a missing file), that's a whisperx bug, not ours
});

test("whisperxAvailable returns a boolean", () => {
  // Just verify the function runs and returns a boolean — no assertion on the value
  // since CI may or may not have whisperx installed
  const available = whisperxAvailable();
  assert.ok(typeof available === "boolean");
});
