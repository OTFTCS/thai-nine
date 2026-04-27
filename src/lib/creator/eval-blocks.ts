import { promises as fs } from "node:fs";
import path from "node:path";
import type { EvalReviewBlock, EvalScriptType } from "@/types/creator-eval";

const REPO_ROOT = path.resolve(process.cwd());

const EXPERIMENTS_DIR: Record<EvalScriptType, string> = {
  youtube: path.join(REPO_ROOT, "youtube", "experiments"),
  course: path.join(REPO_ROOT, "course", "experiments"),
};

const SCRIPT_FILE_SUFFIX: Record<EvalScriptType, string> = {
  youtube: ".json",
  course: ".script.md",
};

export function evalScriptFilePath(
  scriptType: EvalScriptType,
  evalRunId: string,
  scriptId: string,
): string {
  return path.join(
    EXPERIMENTS_DIR[scriptType],
    evalRunId,
    `${scriptId}${SCRIPT_FILE_SUFFIX[scriptType]}`,
  );
}

export async function readEvalScriptFile(
  scriptType: EvalScriptType,
  evalRunId: string,
  scriptId: string,
): Promise<{ raw: string; bytes: number; isStub: boolean } | null> {
  const filePath = evalScriptFilePath(scriptType, evalRunId, scriptId);
  try {
    const buf = await fs.readFile(filePath);
    const raw = buf.toString("utf8");
    return { raw, bytes: buf.byteLength, isStub: buf.byteLength < 200 };
  } catch {
    return null;
  }
}

interface YoutubeBlock {
  id?: unknown;
  mode?: unknown;
  speakerNote?: unknown;
  lines?: unknown;
}

interface CourseSection {
  id?: unknown;
  heading?: unknown;
  purpose?: unknown;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function shortPreview(s: string, max = 240): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}...`;
}

export function parseYoutubeBlocks(raw: string): EvalReviewBlock[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const blocks = (parsed as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];
  const out: EvalReviewBlock[] = [];
  for (const b of blocks as YoutubeBlock[]) {
    const id = asString(b.id);
    if (!id) continue;
    const mode = asString(b.mode, "block");
    const note = asString(b.speakerNote);
    const linesPreview =
      Array.isArray(b.lines) && b.lines.length > 0
        ? (b.lines as Array<Record<string, unknown>>)
            .slice(0, 3)
            .map((l) => asString(l.thai) || asString(l.display) || asString(l.spoken))
            .filter((s) => s.length > 0)
            .join("  ")
        : "";
    out.push({
      id,
      label: mode,
      preview: shortPreview([note, linesPreview].filter(Boolean).join(" - ")),
    });
  }
  return out;
}

const COURSE_JSON_HEADING = /^##\s+script-master\.json\s*$/m;
const COURSE_JSON_FENCE = /```json\s*\n([\s\S]*?)\n```/;

export function parseCourseSections(raw: string): EvalReviewBlock[] {
  const headingMatch = COURSE_JSON_HEADING.exec(raw);
  if (!headingMatch) return [];
  const after = raw.slice(headingMatch.index);
  const fenceMatch = COURSE_JSON_FENCE.exec(after);
  if (!fenceMatch) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenceMatch[1]);
  } catch {
    return [];
  }
  const sections = (parsed as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];
  const out: EvalReviewBlock[] = [];
  for (const s of sections as CourseSection[]) {
    const id = asString(s.id);
    if (!id) continue;
    out.push({
      id,
      label: asString(s.heading, id),
      preview: shortPreview(asString(s.purpose)),
    });
  }
  return out;
}

export function parseReviewBlocks(scriptType: EvalScriptType, raw: string): EvalReviewBlock[] {
  return scriptType === "youtube" ? parseYoutubeBlocks(raw) : parseCourseSections(raw);
}
