export const SCRIPT_MASTER_SCHEMA_KEYS = [
  "schemaVersion",
  "lessonId",
  "title",
  "objective",
  "context",
  "sections",
  "roleplay",
  "recap",
  "qaChecks",
  "policies",
] as const;

export const REMOTION_SCHEMA_KEYS = ["schemaVersion", "lessonId", "sourceScript", "scenes"] as const;

export const PDF_SCHEMA_KEYS = ["schemaVersion", "lessonId", "title", "sections", "drills", "answerKey"] as const;

export const FLASHCARDS_SCHEMA_KEYS = ["schemaVersion", "lessonId", "cards"] as const;

export const QUIZ_SCHEMA_KEYS = ["schemaVersion", "lessonId", "passScore", "questions"] as const;
