export const LESSON_SCOPED_ARTIFACT_BASE_NAMES = [
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
] as const;

export type LessonScopedArtifactBaseName =
  (typeof LESSON_SCOPED_ARTIFACT_BASE_NAMES)[number];

const LESSON_ID_PREFIX = /^M\d{2}-L\d{3}-(.+)$/;
const LESSON_SCOPED_ARTIFACT_SET = new Set<string>(
  LESSON_SCOPED_ARTIFACT_BASE_NAMES
);

export function isLessonScopedArtifactBaseName(
  fileName: string
): fileName is LessonScopedArtifactBaseName {
  return LESSON_SCOPED_ARTIFACT_SET.has(fileName);
}

export function lessonArtifactFileName(
  lessonId: string,
  baseName: string
): string {
  if (!isLessonScopedArtifactBaseName(baseName)) {
    return baseName;
  }
  return `${lessonId}-${baseName}`;
}

export function lessonArtifactCandidateNames(
  lessonId: string,
  baseName: string
): string[] {
  const prefixed = lessonArtifactFileName(lessonId, baseName);
  return prefixed === baseName ? [baseName] : [prefixed, baseName];
}

export function stripLessonArtifactPrefix(fileName: string): string {
  const match = LESSON_ID_PREFIX.exec(fileName);
  if (!match) {
    return fileName;
  }

  const [, baseName] = match;
  return isLessonScopedArtifactBaseName(baseName) ? baseName : fileName;
}
