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
  "script-visual.md",
] as const;

export const WORKFLOW_ARTIFACT_FILES = [
  "context.json",
  "brief.md",
  "script-master.json",
  "script-spoken.md",
  "script-visual.md",
  "editorial-qa-report.md",
  "qa-report.md",
  "remotion.json",
  "asset-provenance.json",
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

export function readBlueprintLessonRows(root: string): BlueprintLessonRow[] {
  const blueprintPath = join(
    root,
    "course",
    "exports",
    "full-thai-course-blueprint.csv"
  );
  const raw = readFileSync(blueprintPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  if (raw.length < 2) {
    return [];
  }

  const headers = parseCsvLine(raw[0]);
  const index = new Map(headers.map((header, headerIndex) => [header, headerIndex]));
  const getCell = (cells: string[], key: string) =>
    (cells[index.get(key) ?? -1] ?? "").trim();

  return raw.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      trackId: getCell(cells, "track_id"),
      trackTitle: getCell(cells, "track_title"),
      cefrBand: getCell(cells, "cefr_band"),
      moduleId: getCell(cells, "module_id"),
      moduleTitle: getCell(cells, "module_title"),
      moduleExitOutcome: getCell(cells, "module_exit_outcome"),
      lessonId: getCell(cells, "lesson_id"),
      lessonTitle: getCell(cells, "lesson_title"),
      lessonPrimaryOutcome: getCell(cells, "lesson_primary_outcome"),
      lessonSecondaryOutcome: getCell(cells, "lesson_secondary_outcome"),
      grammarFunctionPrimary: getCell(cells, "grammar_function_primary"),
      grammarFunctionSecondary: getCell(cells, "grammar_function_secondary"),
      newVocabCore: getCell(cells, "new_vocab_core"),
      newChunksCore: getCell(cells, "new_chunks_core"),
      reviewVocabRequired: getCell(cells, "review_vocab_required"),
      scriptTarget: getCell(cells, "script_target"),
      listeningTarget: getCell(cells, "listening_target"),
      speakingTarget: getCell(cells, "speaking_target"),
      lessonQuizFocus: getCell(cells, "lesson_quiz_focus"),
      moduleQuizLink: getCell(cells, "module_quiz_link"),
      flashcardTags: getCell(cells, "flashcard_tags"),
      notes: getCell(cells, "notes"),
      sourceInspiration: getCell(cells, "source_inspiration"),
    };
  });
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
