import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  lessonArtifactPath,
  lessonPath,
  readJson,
  resolveLessonArtifactPath,
} from "./fs.ts";
import { compareLessonIds } from "./lesson-ids.ts";
import type { LessonStatus } from "./types.ts";

export interface BlueprintLessonRow {
  trackId: string;
  trackTitle: string;
  cefrBand: string;
  moduleId: string;
  moduleTitle: string;
  moduleExitOutcome: string;
  lessonId: string;
  lessonTitle: string;
  lessonPrimaryOutcome: string;
  lessonSecondaryOutcome: string;
  grammarFunctionPrimary: string;
  grammarFunctionSecondary: string;
  newVocabCore: string;
  newChunksCore: string;
  reviewVocabRequired: string;
  scriptTarget: string;
  listeningTarget: string;
  speakingTarget: string;
  lessonQuizFocus: string;
  moduleQuizLink: string;
  flashcardTags: string;
  notes: string;
  sourceInspiration: string;
}

export interface ProduceLessonState {
  schemaVersion: 1;
  lessonId: string;
  blueprintRow: BlueprintLessonRow;
  qaAttempts: number;
  phase:
    | "selected"
    | "awaiting_stage1"
    | "awaiting_editorial_qa"
    | "editorial_qa_failed"
    | "editorial_qa_passed"
    | "awaiting_visual_qa"
    | "visual_qa_failed"
    | "visual_qa_passed"
    | "qa_failed"
    | "qa_passed"
    | "awaiting_assessment_qa"
    | "assessment_qa_failed"
    | "assessment_qa_passed"
    | "completed";
  producedArtifacts: string[];
  finalState: LessonStatus["state"];
  failureReason?: string;
  updatedAt: string;
}

export const STAGE_1_OUTPUT_FILES = [
  "brief.md",
  "script-master.json",
  "script-spoken.md",
  "script-spoken.html",
  "script-visual.md",
] as const;

export const WORKFLOW_ARTIFACT_FILES = [
  "context.json",
  "brief.md",
  "script-master.json",
  "script-spoken.md",
  "script-spoken.html",
  "script-visual.md",
  "editorial-qa-report.md",
  "qa-report.md",
  "deck-source.json",
  "deck.pptx",
  "asset-provenance.json",
  "canva-content.json",
  "canva-deck.pptx",
  "canva-import-guide.md",
  "pdf-source.json",
  "pdf.md",
  "pdf.pdf",
  "flashcards.json",
  "vocab-export.json",
  "quiz-item-bank.json",
  "quiz.json",
  "visual-qa-report.md",
  "assessment-qa-report.md",
  "status.json",
] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

type ParsedCsv = {
  headers: string[];
  index: Map<string, number>;
  rows: string[][];
};

function parseCsvFile(path: string): ParsedCsv {
  const raw = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  if (raw.length < 1) {
    return { headers: [], index: new Map(), rows: [] };
  }
  const headers = parseCsvLine(raw[0]);
  const index = new Map(headers.map((h, i) => [h, i]));
  const rows = raw.slice(1).map(parseCsvLine);
  return { headers, index, rows };
}

function cellAt(cells: string[], index: Map<string, number>, key: string): string {
  return (cells[index.get(key) ?? -1] ?? "").trim();
}

type ModulesSidecar = Map<string, {
  moduleTitle: string;
  moduleExitOutcome: string;
  cefrBand: string;
  stageId: string;
  parallelTrack: string;
  legacyTrackId: string;
}>;

type SkoolMetadataSidecar = Map<string, {
  flashcardTags: string;
}>;

function loadModulesSidecar(path: string): ModulesSidecar {
  if (!existsSync(path)) return new Map();
  const csv = parseCsvFile(path);
  const map: ModulesSidecar = new Map();
  for (const cells of csv.rows) {
    const moduleId = cellAt(cells, csv.index, "module_id");
    if (!moduleId) continue;
    map.set(moduleId, {
      moduleTitle: cellAt(cells, csv.index, "module_title"),
      moduleExitOutcome: cellAt(cells, csv.index, "module_exit_outcome"),
      cefrBand: cellAt(cells, csv.index, "cefr_band"),
      stageId: cellAt(cells, csv.index, "stage_id"),
      parallelTrack: cellAt(cells, csv.index, "parallel_track"),
      legacyTrackId: cellAt(cells, csv.index, "legacy_track_id"),
    });
  }
  return map;
}

function loadSkoolMetadataSidecar(path: string): SkoolMetadataSidecar {
  if (!existsSync(path)) return new Map();
  const csv = parseCsvFile(path);
  const map: SkoolMetadataSidecar = new Map();
  for (const cells of csv.rows) {
    const lessonId = cellAt(cells, csv.index, "lesson_id");
    if (!lessonId) continue;
    map.set(lessonId, {
      flashcardTags: cellAt(cells, csv.index, "flashcard_tags"),
    });
  }
  return map;
}

function blueprintPathFor(root: string): string {
  const override = process.env.BLUEPRINT_CSV;
  if (override && override.length > 0) {
    return override.startsWith("/") ? override : join(root, override);
  }
  return join(root, "course", "exports", "full-thai-course-blueprint.csv");
}

export function readBlueprintLessonRows(root: string): BlueprintLessonRow[] {
  const blueprintPath = blueprintPathFor(root);
  const csv = parseCsvFile(blueprintPath);
  if (csv.rows.length === 0) return [];

  const isV2 = csv.headers.includes("stage_id") && csv.headers.includes("targets");

  if (isV2) {
    const exportsDir = join(root, "course", "exports");
    const modules = loadModulesSidecar(join(exportsDir, "modules.csv"));
    const skoolMeta = loadSkoolMetadataSidecar(join(exportsDir, "skool-metadata.csv"));

    return csv.rows.map((cells) => {
      const lessonId = cellAt(cells, csv.index, "lesson_id");
      const moduleId = cellAt(cells, csv.index, "module_id");
      const mod = modules.get(moduleId);
      const meta = skoolMeta.get(lessonId);
      const targetsRaw = cellAt(cells, csv.index, "targets");
      const [scriptTarget = "", listeningTarget = "", speakingTarget = ""] = targetsRaw.split("|");

      return {
        trackId: mod?.legacyTrackId ?? "",
        trackTitle: "",
        cefrBand: cellAt(cells, csv.index, "cefr_band") || (mod?.cefrBand ?? ""),
        moduleId,
        moduleTitle: cellAt(cells, csv.index, "module_title") || (mod?.moduleTitle ?? ""),
        moduleExitOutcome: mod?.moduleExitOutcome ?? "",
        lessonId,
        lessonTitle: cellAt(cells, csv.index, "lesson_title"),
        lessonPrimaryOutcome: cellAt(cells, csv.index, "lesson_primary_outcome"),
        lessonSecondaryOutcome: cellAt(cells, csv.index, "lesson_secondary_outcome"),
        grammarFunctionPrimary: cellAt(cells, csv.index, "grammar_function_primary"),
        grammarFunctionSecondary: cellAt(cells, csv.index, "grammar_function_secondary"),
        newVocabCore: cellAt(cells, csv.index, "new_vocab_core"),
        newChunksCore: cellAt(cells, csv.index, "new_chunks_core"),
        reviewVocabRequired: cellAt(cells, csv.index, "review_vocab_required"),
        scriptTarget,
        listeningTarget,
        speakingTarget,
        lessonQuizFocus: cellAt(cells, csv.index, "lesson_quiz_focus"),
        moduleQuizLink: moduleId ? `${moduleId}-QUIZ` : "",
        flashcardTags: meta?.flashcardTags ?? "",
        notes: cellAt(cells, csv.index, "notes"),
        sourceInspiration: "",
      };
    });
  }

  // v1 fallback
  return csv.rows.map((cells) => ({
    trackId: cellAt(cells, csv.index, "track_id"),
    trackTitle: cellAt(cells, csv.index, "track_title"),
    cefrBand: cellAt(cells, csv.index, "cefr_band"),
    moduleId: cellAt(cells, csv.index, "module_id"),
    moduleTitle: cellAt(cells, csv.index, "module_title"),
    moduleExitOutcome: cellAt(cells, csv.index, "module_exit_outcome"),
    lessonId: cellAt(cells, csv.index, "lesson_id"),
    lessonTitle: cellAt(cells, csv.index, "lesson_title"),
    lessonPrimaryOutcome: cellAt(cells, csv.index, "lesson_primary_outcome"),
    lessonSecondaryOutcome: cellAt(cells, csv.index, "lesson_secondary_outcome"),
    grammarFunctionPrimary: cellAt(cells, csv.index, "grammar_function_primary"),
    grammarFunctionSecondary: cellAt(cells, csv.index, "grammar_function_secondary"),
    newVocabCore: cellAt(cells, csv.index, "new_vocab_core"),
    newChunksCore: cellAt(cells, csv.index, "new_chunks_core"),
    reviewVocabRequired: cellAt(cells, csv.index, "review_vocab_required"),
    scriptTarget: cellAt(cells, csv.index, "script_target"),
    listeningTarget: cellAt(cells, csv.index, "listening_target"),
    speakingTarget: cellAt(cells, csv.index, "speaking_target"),
    lessonQuizFocus: cellAt(cells, csv.index, "lesson_quiz_focus"),
    moduleQuizLink: cellAt(cells, csv.index, "module_quiz_link"),
    flashcardTags: cellAt(cells, csv.index, "flashcard_tags"),
    notes: cellAt(cells, csv.index, "notes"),
    sourceInspiration: cellAt(cells, csv.index, "source_inspiration"),
  }));
}

export function readLessonStatus(root: string, lessonId: string): LessonStatus {
  const statusPath = join(lessonPath(root, lessonId), "status.json");
  if (!existsSync(statusPath)) {
    return {
      lessonId,
      state: "BACKLOG",
      updatedAt: new Date(0).toISOString(),
      validatedAt: null,
    };
  }

  return readJson<LessonStatus>(statusPath);
}

export function selectNextPlannedLesson(
  rows: BlueprintLessonRow[],
  getStatus: (lessonId: string) => LessonStatus
): BlueprintLessonRow | null {
  return (
    [...rows]
      .sort((left, right) => compareLessonIds(left.lessonId, right.lessonId))
      .find((row) => getStatus(row.lessonId).state === "PLANNED") ?? null
  );
}

export function selectNextWorkflowLesson(
  rows: BlueprintLessonRow[],
  getStatus: (lessonId: string) => LessonStatus,
  getWorkflowState: (lessonId: string) => ProduceLessonState | null
): BlueprintLessonRow | null {
  const ordered = [...rows].sort((left, right) =>
    compareLessonIds(left.lessonId, right.lessonId)
  );

  const inProgress = ordered.find((row) => {
    const workflowState = getWorkflowState(row.lessonId);
    const status = getStatus(row.lessonId);
    return (
      workflowState !== null &&
      workflowState.phase !== "completed" &&
      status.state !== "READY_TO_RECORD"
    );
  });

  if (inProgress) {
    return inProgress;
  }

  return ordered.find((row) => getStatus(row.lessonId).state === "PLANNED") ?? null;
}

export function findBlueprintRow(
  rows: BlueprintLessonRow[],
  lessonId: string
): BlueprintLessonRow | null {
  return rows.find((row) => row.lessonId === lessonId) ?? null;
}

export function resolveBlueprintLesson(
  rows: BlueprintLessonRow[],
  explicitLessonId: string | null,
  getStatus: (lessonId: string) => LessonStatus,
  getWorkflowState?: (lessonId: string) => ProduceLessonState | null
): BlueprintLessonRow | null {
  if (explicitLessonId) {
    return findBlueprintRow(rows, explicitLessonId);
  }

  if (getWorkflowState) {
    return selectNextWorkflowLesson(rows, getStatus, getWorkflowState);
  }

  return selectNextPlannedLesson(rows, getStatus);
}

export function stage1FilesExist(root: string, lessonId: string): boolean {
  return STAGE_1_OUTPUT_FILES.every((file) =>
    existsSync(resolveLessonArtifactPath(root, lessonId, file))
  );
}

export function listProducedArtifacts(root: string, lessonId: string): string[] {
  return WORKFLOW_ARTIFACT_FILES.filter((file) =>
    existsSync(resolveLessonArtifactPath(root, lessonId, file))
  ).map((file) => lessonArtifactPath(root, lessonId, file).split("/").pop() ?? file);
}

export function reportHasPassResult(markdown: string): boolean {
  return /Result:\s+PASS\b/.test(markdown);
}

export function newestMtimeMs(paths: string[]): number {
  return Math.max(
    ...paths.map((path) => {
      if (!existsSync(path)) {
        return 0;
      }
      return statSync(path).mtimeMs;
    })
  );
}

export function reportIsFreshAgainst(reportPath: string, sourcePaths: string[]): boolean {
  if (!existsSync(reportPath)) {
    return false;
  }

  return statSync(reportPath).mtimeMs >= newestMtimeMs(sourcePaths);
}
