export type EvalScriptType = "youtube" | "course";
export type AnnotationRating = "good" | "ok" | "rework";
export type AnnotationScope = "overall" | "block";

export interface EvalScript {
  id: string;                  // creator_eval_scripts.id
  scriptType: EvalScriptType;
  evalRunId: string;
  scriptId: string;            // e.g. 'YT-S01-E05' or 'M01-L001'
  promptPath: string;
  promptSha: string;
  generatedAt: string;
  createdAt: string;
}

export interface EvalAnnotation {
  id: string;                  // creator_annotations.id
  evalScriptId: string;
  scope: AnnotationScope;
  blockId: string | null;
  blockLabel: string | null;
  rating: AnnotationRating;
  comment: string;
  rolledUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvalReviewBlock {
  id: string;                  // section/block id used as block_id
  label: string;               // human-readable header (e.g. "Hook", "S01: Opening")
  preview: string;             // short text snippet shown in the accordion summary
}

export interface EvalReviewModel {
  script: EvalScript;
  blocks: EvalReviewBlock[];
  annotations: EvalAnnotation[];
}

export interface EvalRunSummary {
  scriptType: EvalScriptType;
  evalRunId: string;
  scriptCount: number;
  annotatedCount: number;       // scripts with at least one annotation row
  newestRun: string | null;     // ISO timestamp of newest script in run
}

export interface EvalRunScriptListing {
  scriptId: string;
  filename: string;
  byteSize: number;
  isStub: boolean;              // generation failed (under STUB_BYTE_THRESHOLD)
  isSeeded: boolean;            // creator_eval_scripts row exists
  annotationStatus: "none" | "partial" | "complete";
  evalScriptId: string | null;  // null until first seed
}

export const STUB_BYTE_THRESHOLD = 200;
