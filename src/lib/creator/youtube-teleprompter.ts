// Teleprompter formatter. Walks a script's blocks in order, emitting a markdown
// document Nine can scroll on screen during recording. Transliteration is
// deliberately stripped (it is for the on-screen card, not the prompter).

import type { Block } from "@/lib/creator/youtube-script-parts";
import type { ScriptFile } from "@/lib/creator/youtube-script";

interface ScriptLineLike {
  lang?: string;
  thai?: string;
  english?: string;
  spoken?: boolean;
  speaker?: string;
  [key: string]: unknown;
}

function asLine(value: unknown): ScriptLineLike | null {
  if (!value || typeof value !== "object") return null;
  return value as ScriptLineLike;
}

function speakerPrefix(line: ScriptLineLike): string {
  const speaker = line.speaker;
  if (speaker === "A") return "**[A]** ";
  if (speaker === "B") return "**[B]** ";
  return "";
}

function lineText(line: ScriptLineLike): string | null {
  // Silent placeholders are not for the talent's mouth; skip them.
  if (line.spoken === false) return null;

  const lang = line.lang;
  // Transliteration belongs on the on-screen card, not the prompter.
  if (lang === "translit") return null;

  if (lang === "th" || lang === "th-split") {
    const text = typeof line.thai === "string" ? line.thai.trim() : "";
    if (text.length === 0) return null;
    return `${speakerPrefix(line)}${text}`;
  }

  if (lang === "en") {
    const text = typeof line.english === "string" ? line.english.trim() : "";
    if (text.length === 0) return null;
    return `${speakerPrefix(line)}${text}`;
  }

  // Unknown lang values are tolerated by skipping.
  return null;
}

function blockHeading(block: Block): string {
  const mode = (block.mode ?? "block").toString().toLowerCase();
  return `## ${mode}`;
}

function blockSpeakerNote(block: Block): string | null {
  const note = (block as { speakerNote?: unknown }).speakerNote;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  return `> _Speaker note: ${trimmed}_`;
}

function blockBody(block: Block): string[] {
  const out: string[] = [];
  out.push(blockHeading(block));

  const note = blockSpeakerNote(block);
  if (note) {
    out.push("");
    out.push(note);
  }

  const lines = Array.isArray(block.lines) ? block.lines : [];
  let appendedAnyLine = false;
  for (const raw of lines) {
    const line = asLine(raw);
    if (!line) continue;
    const rendered = lineText(line);
    if (rendered === null) continue;
    if (!appendedAnyLine) out.push("");
    appendedAnyLine = true;
    out.push(rendered);
  }

  return out;
}

function scriptTitle(script: ScriptFile): string {
  const titleRaw = (script as { title?: unknown }).title;
  const topicRaw = (script as { topic?: unknown }).topic;
  const trailing =
    (typeof titleRaw === "string" && titleRaw.trim().length > 0
      ? titleRaw.trim()
      : null) ??
    (typeof topicRaw === "string" && topicRaw.trim().length > 0
      ? topicRaw.trim()
      : null) ??
    "(untitled)";
  // Title format mirrors the writer-memory heading convention. Both use the
  // " - " (space-hyphen-space) separator per the project no-em-dashes rule.
  return `# ${script.episodeId} - ${trailing}`;
}

export function formatTeleprompter(script: ScriptFile): string {
  const lines: string[] = [];
  lines.push(scriptTitle(script));

  const blocks = Array.isArray(script.blocks) ? script.blocks : [];
  for (const block of blocks) {
    lines.push("");
    const body = blockBody(block);
    for (const entry of body) lines.push(entry);
  }

  return `${lines.join("\n")}\n`;
}

export function formatPartPreview(blocks: Block[]): string {
  const lines: string[] = [];
  let first = true;
  for (const block of blocks) {
    if (!first) lines.push("");
    first = false;
    const body = blockBody(block);
    for (const entry of body) lines.push(entry);
  }
  return `${lines.join("\n")}\n`;
}
