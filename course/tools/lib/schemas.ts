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

export const DECK_SOURCE_SCHEMA_KEYS = [
  "schemaVersion",
  "lessonId",
  "sourceScript",
  "canvas",
  "theme",
  "slides",
] as const;

export const CANVA_CONTENT_SCHEMA_KEYS = [
  "schemaVersion",
  "lessonId",
  "sourceDeck",
  "layoutContract",
  "theme",
  "slides",
] as const;

export const PDF_SCHEMA_KEYS = ["schemaVersion", "lessonId", "title", "sections", "drills", "answerKey"] as const;

export const FLASHCARDS_SCHEMA_KEYS = ["schemaVersion", "lessonId", "cards"] as const;

export const QUIZ_SCHEMA_KEYS = ["schemaVersion", "lessonId", "passScore", "questions"] as const;
