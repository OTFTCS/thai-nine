import fs from "node:fs";
import path from "node:path";
import { spawnSync as defaultSpawnSync } from "node:child_process";

import {
  PART_LABELS,
  splitBlocksToParts,
  type Block,
  type PartKey,
  type SplitResult,
} from "@/lib/creator/youtube-script-parts";
import {
  findCatalogueEntry,
  type CatalogueEntry,
} from "@/lib/creator/youtube-catalogue";
import {
  appendMemoryEntry,
  selectMemoryForPrompt,
} from "@/lib/creator/writer-memory";
import {
  writeEpisodeStatus,
  type EpisodeStatus,
} from "@/lib/creator/episode-status";
import { runClaude as defaultRunClaude } from "@/lib/creator/run-claude";

// ---------- Types ----------

export interface ScriptFile {
  schemaVersion: number;
  episodeId: string;
  blocks: Block[];
  [key: string]: unknown;
}

export interface BlockDiff {
  kept: string[];
  added: string[];
  removed: string[];
}

export interface ValidationResult {
  ok: boolean;
  output: string;
}

export interface BuildGeneratePromptInput {
  catalogue: CatalogueEntry;
  memoryForPrompt: string;
}

export interface BuildRegeneratePromptInput {
  script: ScriptFile;
  parts: SplitResult;
  partKey: PartKey;
  instruction: string;
  reason: string;
  memoryForPrompt: string;
}

export interface GenerateScriptOptions {
  episodeId: string;
  repoRoot?: string;
  systemPromptFile?: string;
  runClaudeImpl?: typeof defaultRunClaude;
  validateImpl?: typeof validateScriptFile;
}

export type GenerateOutcome =
  | { ok: true; scriptPath: string; status: EpisodeStatus }
  | {
      ok: false;
      reason:
        | "no-catalogue-entry"
        | "claude-failure"
        | "json-parse"
        | "validation"
        | "claude-cli-missing"
        | "unsupported-platform"
        | "timeout"
        | "non-zero"
        | "in-flight";
      details?: unknown;
      message: string;
    };

export interface RegeneratePartOptions {
  episodeId: string;
  partKey: PartKey;
  instruction: string;
  reason: string;
  repoRoot?: string;
  systemPromptFile?: string;
  runClaudeImpl?: typeof defaultRunClaude;
  validateImpl?: typeof validateScriptFile;
}

export type RegenerateOutcome =
  | {
      ok: true;
      scriptPath: string;
      snapshotPath: string;
      diff: BlockDiff;
    }
  | {
      ok: false;
      reason:
        | "no-script"
        | "claude-failure"
        | "json-parse"
        | "validation"
        | "splice-failure"
        | "claude-cli-missing"
        | "unsupported-platform"
        | "timeout"
        | "non-zero"
        | "in-flight";
      details?: unknown;
      message: string;
    };

// ---------- Path helpers ----------

export function scriptPath(episodeId: string, repoRoot?: string): string {
  return path.join(
    repoRoot ?? process.cwd(),
    "youtube",
    "examples",
    `${episodeId}.json`
  );
}

export function snapshotDir(episodeId: string, repoRoot?: string): string {
  return path.join(
    repoRoot ?? process.cwd(),
    "youtube",
    "episodes",
    episodeId,
    "history"
  );
}

function defaultSystemPromptFile(repoRoot: string): string {
  return path.join(repoRoot, "youtube", "prompts", "script-writing.prompt.md");
}

// ---------- File I/O helpers ----------

function atomicWrite(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, filePath);
}

function isoForFilename(): string {
  // Replace colons so it is safe on macOS / cross-fs.
  return new Date().toISOString().replace(/:/g, "-");
}

// ---------- Read / split ----------

export function readScript(
  episodeId: string,
  repoRoot?: string
): ScriptFile | null {
  const filePath = scriptPath(episodeId, repoRoot);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const parsed = JSON.parse(raw) as ScriptFile;
  return parsed;
}

export function readScriptParts(
  episodeId: string,
  repoRoot?: string
): { script: ScriptFile; parts: SplitResult } | null {
  const script = readScript(episodeId, repoRoot);
  if (!script) return null;
  const parts = splitBlocksToParts(script.blocks ?? []);
  return { script, parts };
}

// ---------- Diff ----------

export function diffBlocksById(prev: Block[], next: Block[]): BlockDiff {
  const prevIds = new Set(prev.map((b) => b.id));
  const nextIds = new Set(next.map((b) => b.id));

  const kept: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const id of prevIds) {
    if (nextIds.has(id)) kept.push(id);
    else removed.push(id);
  }
  for (const id of nextIds) {
    if (!prevIds.has(id)) added.push(id);
  }

  return { kept, added, removed };
}

function truncateIdList(ids: string[], limit: number): string {
  if (ids.length <= limit) return ids.join(", ");
  const head = ids.slice(0, limit).join(", ");
  return `${head}, ...`;
}

export function formatDiffSummary(
  diff: BlockDiff,
  prevTotalInPart: number
): string {
  const addedStr =
    diff.added.length > 0
      ? ` (${truncateIdList(diff.added, 5)})`
      : "";
  const removedStr =
    diff.removed.length > 0
      ? ` (${truncateIdList(diff.removed, 5)})`
      : "";
  return [
    `kept ${diff.kept.length} of ${prevTotalInPart} blocks`,
    `added ${diff.added.length}${addedStr}`,
    `removed ${diff.removed.length}${removedStr}`,
  ].join("; ");
}

// ---------- Snapshot ----------

export function snapshotScript(
  episodeId: string,
  repoRoot?: string
): string {
  const src = scriptPath(episodeId, repoRoot);
  let body: string;
  try {
    body = fs.readFileSync(src, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("no current script to snapshot");
    }
    throw err;
  }
  const dir = snapshotDir(episodeId, repoRoot);
  const dest = path.join(dir, `${isoForFilename()}.json`);
  atomicWrite(dest, body);
  return dest;
}

// ---------- Validation ----------

export function validateScriptFile(
  filePath: string,
  opts?: { python?: string; repoRoot?: string }
): ValidationResult {
  const python = opts?.python ?? "python3";
  const repoRoot = opts?.repoRoot ?? process.cwd();
  const validatorPath = path.join(
    repoRoot,
    "youtube",
    "tools",
    "validate_script.py"
  );

  const result = defaultSpawnSync(
    python,
    [validatorPath, "--script", filePath],
    {
      encoding: "utf8",
      env: process.env,
    }
  );

  const stdout = String(result.stdout ?? "");
  const stderr = String(result.stderr ?? "");
  const output = [stdout, stderr].filter((s) => s.length > 0).join("\n");
  const ok = result.status === 0;

  return { ok, output };
}

// ---------- Splice ----------

export function spliceBlocks(
  originalBlocks: Block[],
  partRange: { start: string | null; end: string | null },
  replacementBlocks: Block[]
): Block[] {
  const { start, end } = partRange;

  if (start === null && end === null) {
    return [...originalBlocks, ...replacementBlocks];
  }

  if (start === null || end === null) {
    throw new Error(
      `spliceBlocks requires both start and end ids, got start=${String(start)} end=${String(end)}`
    );
  }

  const startIdx = originalBlocks.findIndex((b) => b.id === start);
  if (startIdx === -1) {
    throw new Error(`spliceBlocks: start id not found: ${start}`);
  }

  const endIdx = originalBlocks.findIndex((b) => b.id === end);
  if (endIdx === -1) {
    throw new Error(`spliceBlocks: end id not found: ${end}`);
  }

  if (endIdx < startIdx) {
    throw new Error(
      `spliceBlocks: end id (${end}) precedes start id (${start})`
    );
  }

  const before = originalBlocks.slice(0, startIdx);
  const after = originalBlocks.slice(endIdx + 1);
  return [...before, ...replacementBlocks, ...after];
}

// ---------- Prompt building ----------

export function buildGeneratePrompt(
  input: BuildGeneratePromptInput
): string {
  const { catalogue, memoryForPrompt } = input;
  const memorySection =
    memoryForPrompt && memoryForPrompt.trim().length > 0
      ? memoryForPrompt
      : "(none)";

  return [
    "Generate a Thai with Nine YouTube episode script.",
    "",
    "## Episode",
    `- episodeId: ${catalogue.episodeId}`,
    `- topic: ${catalogue.topic ?? "(unspecified)"}`,
    `- level: ${catalogue.level ?? "(unspecified)"}`,
    `- titleBucket: ${catalogue.titleBucket ?? "(unspecified)"}`,
    `- lessonRef: ${catalogue.lessonRef ?? "(unspecified)"}`,
    "",
    "## Recent writer feedback",
    memorySection,
    "",
    "## Output requirements",
    "Return a single valid JSON object matching the v2 schema. Output ONLY raw JSON. No markdown fences. No commentary.",
  ].join("\n");
}

function summariseBlock(block: Block): string {
  const firstLine = Array.isArray(block.lines) ? block.lines[0] : null;
  let snippet = "";
  if (firstLine && typeof firstLine === "object") {
    const obj = firstLine as Record<string, unknown>;
    const candidates = [obj.english, obj.thai, obj.text, obj.translit];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) {
        snippet = c.trim();
        break;
      }
    }
  } else if (typeof firstLine === "string") {
    snippet = firstLine;
  }
  if (snippet.length > 80) snippet = `${snippet.slice(0, 77)}...`;
  return `${block.id} [${block.mode}]${snippet ? `: ${snippet}` : ""}`;
}

function collectVocabIdRange(parts: SplitResult, partKey: PartKey): string {
  const ids = new Set<string>();
  for (const block of parts[partKey]) {
    const refs = block.vocabRefs;
    if (Array.isArray(refs)) {
      for (const r of refs) {
        if (typeof r === "string") ids.add(r);
      }
    }
  }
  if (ids.size === 0) return "(no vocab refs in this part)";
  return Array.from(ids).sort().join(", ");
}

export function buildRegeneratePartPrompt(
  input: BuildRegeneratePromptInput
): string {
  const { script, parts, partKey, instruction, reason, memoryForPrompt } =
    input;
  const partLabel = PART_LABELS[partKey];
  const partRange = parts.partRanges[partKey];
  const partBlocks = parts[partKey];

  const otherParts: PartKey[] = (["p1", "p2", "p3", "p4"] as PartKey[]).filter(
    (k) => k !== partKey
  );

  const skeletonLines: string[] = [];
  for (const k of otherParts) {
    const label = PART_LABELS[k];
    skeletonLines.push(`### ${k.toUpperCase()} (${label})`);
    if (parts[k].length === 0) {
      skeletonLines.push("(empty)");
    } else {
      for (const b of parts[k]) {
        skeletonLines.push(`- ${summariseBlock(b)}`);
      }
    }
    skeletonLines.push("");
  }

  const memorySection =
    memoryForPrompt && memoryForPrompt.trim().length > 0
      ? memoryForPrompt
      : "(none)";

  const startId = partRange.start ?? "(none)";
  const endId = partRange.end ?? "(none)";
  const vocabRange = collectVocabIdRange(parts, partKey);

  return [
    `Regenerate part ${partKey.toUpperCase()} (${partLabel}) of the Thai with Nine YouTube script.`,
    "",
    "## Episode",
    `- episodeId: ${script.episodeId}`,
    `- target part: ${partKey.toUpperCase()} (${partLabel})`,
    `- block id range: ${startId}..${endId}`,
    `- block count: ${partRange.count}`,
    "",
    "## Other parts (structural skeleton; do not modify)",
    ...skeletonLines,
    "## Existing blocks in target part",
    "```json",
    JSON.stringify(partBlocks, null, 2),
    "```",
    "",
    "## User instruction",
    instruction,
    "",
    "## Reason",
    reason,
    "",
    "## Recent writer feedback",
    memorySection,
    "",
    "## Constraints",
    `Reuse block IDs ${startId}..${endId}. Do not introduce new vocab IDs outside ${vocabRange}. Do not modify any block in other parts.`,
    "",
    "## Output requirements",
    "Return ONLY a JSON array of replacement blocks for this part. No commentary, no fences.",
  ].join("\n");
}

// ---------- Output parsing ----------

export function extractJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  let inner = trimmed;

  if (inner.startsWith("```")) {
    // Strip the leading fence (with optional language tag) on first newline.
    const firstNewline = inner.indexOf("\n");
    if (firstNewline !== -1) {
      inner = inner.slice(firstNewline + 1);
      // Strip trailing closing fence, if any.
      const lastFence = inner.lastIndexOf("```");
      if (lastFence !== -1) {
        inner = inner.slice(0, lastFence);
      }
    }
    inner = inner.trim();
  }

  try {
    return JSON.parse(inner);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `failed to parse JSON: ${message} ... text starts: ${trimmed.slice(0, 300)}`
    );
  }
}

// ---------- Orchestration helpers ----------

interface ClaudeFailure {
  ok: false;
  reason:
    | "claude-cli-missing"
    | "unsupported-platform"
    | "timeout"
    | "non-zero";
  message?: string;
  status?: number;
  stderr?: string;
}

function claudeFailureMessage(failure: ClaudeFailure): string {
  if (failure.reason === "non-zero") {
    return `claude exited ${failure.status ?? -1}: ${failure.stderr ?? ""}`.trim();
  }
  return failure.message ?? `claude failed: ${failure.reason}`;
}

function draftPath(targetPath: string): string {
  return `${targetPath}.draft.json`;
}

// ---------- High-level orchestration ----------

export async function generateScript(
  opts: GenerateScriptOptions
): Promise<GenerateOutcome> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const systemPromptFile =
    opts.systemPromptFile ?? defaultSystemPromptFile(repoRoot);
  const runClaudeImpl = opts.runClaudeImpl ?? defaultRunClaude;
  const validateImpl = opts.validateImpl ?? validateScriptFile;

  const catalogue = findCatalogueEntry(opts.episodeId, repoRoot);
  if (!catalogue) {
    return {
      ok: false,
      reason: "no-catalogue-entry",
      message: `no catalogue entry for ${opts.episodeId}`,
    };
  }

  const memoryForPrompt = selectMemoryForPrompt({
    episodeId: opts.episodeId,
    maxEntries: 10,
    repoRoot,
  });

  const promptText = buildGeneratePrompt({
    catalogue,
    memoryForPrompt,
  });

  const result = runClaudeImpl({
    promptText,
    systemPromptFile,
    timeoutMs: 5 * 60_000,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: claudeFailureMessage(result as ClaudeFailure),
      details: result,
    };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: "json-parse",
      message,
      details: { raw: result.text.slice(0, 1000) },
    };
  }

  const targetPath = scriptPath(opts.episodeId, repoRoot);
  const draft = draftPath(targetPath);
  atomicWrite(draft, `${JSON.stringify(parsed, null, 2)}\n`);

  const validation = validateImpl(draft, { repoRoot });
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation",
      message: "validate_script.py rejected the generated draft",
      details: validation.output,
    };
  }

  fs.renameSync(draft, targetPath);
  const status = writeEpisodeStatus(
    opts.episodeId,
    { scriptStatus: "DRAFT", lastError: null },
    repoRoot
  );

  return { ok: true, scriptPath: targetPath, status };
}

export async function regeneratePart(
  opts: RegeneratePartOptions
): Promise<RegenerateOutcome> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const systemPromptFile =
    opts.systemPromptFile ?? defaultSystemPromptFile(repoRoot);
  const runClaudeImpl = opts.runClaudeImpl ?? defaultRunClaude;
  const validateImpl = opts.validateImpl ?? validateScriptFile;

  const existing = readScriptParts(opts.episodeId, repoRoot);
  if (!existing) {
    return {
      ok: false,
      reason: "no-script",
      message: "generate first",
    };
  }

  // Snapshot before any change.
  const snapshotPath = snapshotScript(opts.episodeId, repoRoot);

  const memoryForPrompt = selectMemoryForPrompt({
    episodeId: opts.episodeId,
    maxEntries: 10,
    repoRoot,
  });

  const promptText = buildRegeneratePartPrompt({
    script: existing.script,
    parts: existing.parts,
    partKey: opts.partKey,
    instruction: opts.instruction,
    reason: opts.reason,
    memoryForPrompt,
  });

  const result = runClaudeImpl({
    promptText,
    systemPromptFile,
    timeoutMs: 5 * 60_000,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: claudeFailureMessage(result as ClaudeFailure),
      details: result,
    };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: "json-parse",
      message,
      details: { raw: result.text.slice(0, 1000) },
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "json-parse",
      message: "expected JSON array of replacement blocks",
      details: { raw: result.text.slice(0, 1000) },
    };
  }

  const replacementBlocks = parsed as Block[];
  const partRange = existing.parts.partRanges[opts.partKey];

  let mergedBlocks: Block[];
  try {
    mergedBlocks = spliceBlocks(
      existing.script.blocks,
      partRange,
      replacementBlocks
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: "splice-failure",
      message,
    };
  }

  const merged: ScriptFile = {
    ...existing.script,
    blocks: mergedBlocks,
  };

  const targetPath = scriptPath(opts.episodeId, repoRoot);
  const draft = draftPath(targetPath);
  atomicWrite(draft, `${JSON.stringify(merged, null, 2)}\n`);

  const validation = validateImpl(draft, { repoRoot });
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation",
      message: "validate_script.py rejected the spliced draft",
      details: validation.output,
    };
  }

  fs.renameSync(draft, targetPath);

  const prevPartBlocks = existing.parts[opts.partKey];
  const diff = diffBlocksById(prevPartBlocks, replacementBlocks);

  appendMemoryEntry(
    {
      episodeId: opts.episodeId,
      timestamp: new Date().toISOString(),
      partKey: opts.partKey,
      partLabel: PART_LABELS[opts.partKey],
      reason: opts.reason,
      diffSummary: formatDiffSummary(diff, prevPartBlocks.length),
    },
    { repoRoot }
  );

  writeEpisodeStatus(
    opts.episodeId,
    { scriptStatus: "DRAFT", lastError: null },
    repoRoot
  );

  return {
    ok: true,
    scriptPath: targetPath,
    snapshotPath,
    diff,
  };
}
