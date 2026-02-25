export type LessonState = "BACKLOG" | "PLANNED" | "DRAFT" | "READY_TO_RECORD";

export interface LessonStatus {
  lessonId: string;
  state: LessonState;
  updatedAt: string;
  validatedAt: string | null;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
