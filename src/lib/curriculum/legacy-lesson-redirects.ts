const LEGACY_LESSON_ID_REDIRECTS: Record<string, string> = {
  "lesson-1": "M01-L001",
  "lesson-2": "M01-L002",
  "lesson-3": "M01-L003",
  "lesson-4": "M01-L004",
  "lesson-5": "M01-L005",
  "lesson-6": "M01-L006",
};

export function resolveLegacyLessonId(lessonId: string): string | null {
  return LEGACY_LESSON_ID_REDIRECTS[lessonId] ?? null;
}
