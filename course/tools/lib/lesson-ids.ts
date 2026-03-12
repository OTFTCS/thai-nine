export function lessonIdFromDir(lessonDir: string): string {
  const parts = lessonDir.split("/");
  const lesson = parts.at(-1) ?? "";
  const module = parts.at(-2) ?? "";
  return `${module}-${lesson}`;
}

export function parseLessonRef(lessonId: string): { moduleId: string; lessonNum: number } {
  const [moduleId, lessonPart] = lessonId.split("-");
  const lessonNum = Number((lessonPart ?? "L000").replace(/^L/, ""));
  return { moduleId: moduleId ?? "M00", lessonNum };
}

export function compareLessonIds(a: string, b: string): number {
  const pa = parseLessonRef(a);
  const pb = parseLessonRef(b);
  if (pa.moduleId !== pb.moduleId) {
    return pa.moduleId.localeCompare(pb.moduleId);
  }
  return pa.lessonNum - pb.lessonNum;
}
