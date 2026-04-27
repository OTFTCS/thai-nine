import { promises as fs } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  STUB_BYTE_THRESHOLD,
  type AnnotationRating,
  type AnnotationScope,
  type EvalAnnotation,
  type EvalRunScriptListing,
  type EvalRunSummary,
  type EvalScript,
  type EvalScriptType,
} from "@/types/creator-eval";

const REPO_ROOT = path.resolve(process.cwd());

const EXPERIMENTS_DIR: Record<EvalScriptType, string> = {
  youtube: path.join(REPO_ROOT, "youtube", "experiments"),
  course: path.join(REPO_ROOT, "course", "experiments"),
};

const SCRIPT_FILE_SUFFIX: Record<EvalScriptType, string> = {
  youtube: ".json",
  course: ".script.md",
};

interface DbEvalScriptRow {
  id: string;
  script_type: EvalScriptType;
  eval_run_id: string;
  script_id: string;
  prompt_path: string;
  prompt_sha: string;
  generated_at: string;
  created_at: string;
}

interface DbAnnotationRow {
  id: string;
  eval_script_id: string;
  scope: AnnotationScope;
  block_id: string | null;
  block_label: string | null;
  rating: AnnotationRating;
  comment: string;
  rolled_up_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToScript(row: DbEvalScriptRow): EvalScript {
  return {
    id: row.id,
    scriptType: row.script_type,
    evalRunId: row.eval_run_id,
    scriptId: row.script_id,
    promptPath: row.prompt_path,
    promptSha: row.prompt_sha,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}

function rowToAnnotation(row: DbAnnotationRow): EvalAnnotation {
  return {
    id: row.id,
    evalScriptId: row.eval_script_id,
    scope: row.scope,
    blockId: row.block_id,
    blockLabel: row.block_label,
    rating: row.rating,
    comment: row.comment,
    rolledUpAt: row.rolled_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveScriptIdFromFile(scriptType: EvalScriptType, filename: string): string | null {
  const suffix = SCRIPT_FILE_SUFFIX[scriptType];
  if (!filename.endsWith(suffix)) return null;
  const stem = filename.slice(0, -suffix.length);
  if (stem.startsWith("_")) return null;
  return stem;
}

export async function listEvalRuns(): Promise<EvalRunSummary[]> {
  const sb = getServiceClient();
  const summaries: EvalRunSummary[] = [];
  const types: EvalScriptType[] = ["youtube", "course"];

  for (const scriptType of types) {
    const root = EXPERIMENTS_DIR[scriptType];
    let runDirs: string[] = [];
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      runDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      runDirs = [];
    }

    for (const evalRunId of runDirs) {
      const runPath = path.join(root, evalRunId);
      let scriptFiles: string[] = [];
      try {
        const files = await fs.readdir(runPath);
        scriptFiles = files.filter((f) => deriveScriptIdFromFile(scriptType, f) !== null);
      } catch {
        scriptFiles = [];
      }

      const { data: annotated } = await sb
        .from("creator_eval_scripts")
        .select("id, creator_annotations(id)")
        .eq("script_type", scriptType)
        .eq("eval_run_id", evalRunId);

      const annotatedCount =
        (annotated ?? []).filter((row) => {
          const anns = (row as { creator_annotations?: unknown[] }).creator_annotations;
          return Array.isArray(anns) && anns.length > 0;
        }).length;

      let newestRun: string | null = null;
      for (const file of scriptFiles) {
        const stat = await fs.stat(path.join(runPath, file));
        const iso = stat.mtime.toISOString();
        if (!newestRun || iso > newestRun) newestRun = iso;
      }

      summaries.push({
        scriptType,
        evalRunId,
        scriptCount: scriptFiles.length,
        annotatedCount,
        newestRun,
      });
    }
  }

  summaries.sort((a, b) => {
    if (a.scriptType !== b.scriptType) return a.scriptType.localeCompare(b.scriptType);
    return b.evalRunId.localeCompare(a.evalRunId);
  });
  return summaries;
}

export async function listRunScripts(
  scriptType: EvalScriptType,
  evalRunId: string,
): Promise<EvalRunScriptListing[]> {
  const sb = getServiceClient();
  const runPath = path.join(EXPERIMENTS_DIR[scriptType], evalRunId);

  let files: string[] = [];
  try {
    files = await fs.readdir(runPath);
  } catch {
    return [];
  }

  const scriptFiles = files.filter((f) => deriveScriptIdFromFile(scriptType, f) !== null);
  if (scriptFiles.length === 0) return [];

  const { data: seeded } = await sb
    .from("creator_eval_scripts")
    .select("id, script_id, creator_annotations(id, scope)")
    .eq("script_type", scriptType)
    .eq("eval_run_id", evalRunId);
  const seedMap = new Map<string, { id: string; annotations: { id: string; scope: AnnotationScope }[] }>();
  for (const row of seeded ?? []) {
    const r = row as { id: string; script_id: string; creator_annotations: { id: string; scope: AnnotationScope }[] | null };
    seedMap.set(r.script_id, { id: r.id, annotations: r.creator_annotations ?? [] });
  }

  const listings: EvalRunScriptListing[] = [];
  for (const filename of scriptFiles) {
    const scriptId = deriveScriptIdFromFile(scriptType, filename)!;
    const stat = await fs.stat(path.join(runPath, filename));
    const seed = seedMap.get(scriptId);
    const annotations = seed?.annotations ?? [];
    let status: EvalRunScriptListing["annotationStatus"] = "none";
    if (annotations.length > 0) {
      // "complete" = at least an overall + at least one block annotation.
      const hasOverall = annotations.some((a) => a.scope === "overall");
      const hasBlock = annotations.some((a) => a.scope === "block");
      status = hasOverall && hasBlock ? "complete" : "partial";
    }
    listings.push({
      scriptId,
      filename,
      byteSize: stat.size,
      isStub: stat.size < STUB_BYTE_THRESHOLD,
      isSeeded: !!seed,
      annotationStatus: status,
      evalScriptId: seed?.id ?? null,
    });
  }
  listings.sort((a, b) => a.scriptId.localeCompare(b.scriptId));
  return listings;
}

export async function fetchScriptWithAnnotations(
  evalScriptId: string,
): Promise<{ script: EvalScript; annotations: EvalAnnotation[] } | null> {
  const sb = getServiceClient();
  const { data: scriptRow } = await sb
    .from("creator_eval_scripts")
    .select("*")
    .eq("id", evalScriptId)
    .maybeSingle();
  if (!scriptRow) return null;
  const { data: annRows } = await sb
    .from("creator_annotations")
    .select("*")
    .eq("eval_script_id", evalScriptId);
  return {
    script: rowToScript(scriptRow as DbEvalScriptRow),
    annotations: (annRows ?? []).map((r) => rowToAnnotation(r as DbAnnotationRow)),
  };
}

export interface UpsertAnnotationInput {
  evalScriptId: string;
  scope: AnnotationScope;
  blockId: string | null;
  blockLabel: string | null;
  rating: AnnotationRating;
  comment: string;
  expectedUpdatedAt: string | null;   // null when inserting; required for updates
}

export type UpsertAnnotationResult =
  | { ok: true; annotation: EvalAnnotation }
  | { ok: false; reason: "stale-lock"; current: EvalAnnotation }
  | { ok: false; reason: "script-not-found" }
  | { ok: false; reason: "scope-block-mismatch" }
  | { ok: false; reason: "db-error"; message: string };

export async function upsertAnnotation(input: UpsertAnnotationInput): Promise<UpsertAnnotationResult> {
  if (input.scope === "block" && !input.blockId) return { ok: false, reason: "scope-block-mismatch" };
  if (input.scope === "overall" && input.blockId) return { ok: false, reason: "scope-block-mismatch" };

  const sb = getServiceClient();
  const existing = await findExistingAnnotation(sb, input);
  if (existing) {
    if (input.expectedUpdatedAt && existing.updatedAt !== input.expectedUpdatedAt) {
      return { ok: false, reason: "stale-lock", current: existing };
    }
    const { data, error } = await sb
      .from("creator_annotations")
      .update({
        rating: input.rating,
        comment: input.comment,
        block_label: input.blockLabel,
        updated_at: new Date().toISOString(),
        rolled_up_at: null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return { ok: false, reason: "db-error", message: error.message };
    return { ok: true, annotation: rowToAnnotation(data as DbAnnotationRow) };
  }

  const { data: scriptRow } = await sb
    .from("creator_eval_scripts")
    .select("id")
    .eq("id", input.evalScriptId)
    .maybeSingle();
  if (!scriptRow) return { ok: false, reason: "script-not-found" };

  const { data, error } = await sb
    .from("creator_annotations")
    .insert({
      eval_script_id: input.evalScriptId,
      scope: input.scope,
      block_id: input.blockId,
      block_label: input.blockLabel,
      rating: input.rating,
      comment: input.comment,
    })
    .select("*")
    .single();
  if (error) return { ok: false, reason: "db-error", message: error.message };
  return { ok: true, annotation: rowToAnnotation(data as DbAnnotationRow) };
}

async function findExistingAnnotation(
  sb: SupabaseClient,
  input: UpsertAnnotationInput,
): Promise<EvalAnnotation | null> {
  let query = sb
    .from("creator_annotations")
    .select("*")
    .eq("eval_script_id", input.evalScriptId)
    .eq("scope", input.scope);
  query = input.scope === "overall" ? query.is("block_id", null) : query.eq("block_id", input.blockId);
  const { data } = await query.maybeSingle();
  return data ? rowToAnnotation(data as DbAnnotationRow) : null;
}

export async function deleteAnnotation(annotationId: string): Promise<{ ok: boolean; message?: string }> {
  const sb = getServiceClient();
  const { error } = await sb.from("creator_annotations").delete().eq("id", annotationId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export interface SeedEvalScriptInput {
  scriptType: EvalScriptType;
  evalRunId: string;
  scriptId: string;
  promptPath: string;
  promptSha: string;
  generatedAt: string;
}

export async function ensureEvalScriptRow(input: SeedEvalScriptInput): Promise<EvalScript> {
  const sb = getServiceClient();
  const { data: existing } = await sb
    .from("creator_eval_scripts")
    .select("*")
    .eq("script_type", input.scriptType)
    .eq("eval_run_id", input.evalRunId)
    .eq("script_id", input.scriptId)
    .maybeSingle();
  if (existing) return rowToScript(existing as DbEvalScriptRow);

  const { data, error } = await sb
    .from("creator_eval_scripts")
    .insert({
      script_type: input.scriptType,
      eval_run_id: input.evalRunId,
      script_id: input.scriptId,
      prompt_path: input.promptPath,
      prompt_sha: input.promptSha,
      generated_at: input.generatedAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(`failed to insert creator_eval_scripts row: ${error.message}`);
  return rowToScript(data as DbEvalScriptRow);
}

export const __test = { deriveScriptIdFromFile };
