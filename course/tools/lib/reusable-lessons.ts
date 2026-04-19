import { existsSync } from "node:fs";
import {
  lessonPath,
  listLessonDirs,
  readJson,
  resolveLessonArtifactPath,
} from "./fs.ts";
import { compareLessonIds, lessonIdFromDir } from "./lesson-ids.ts";
import type { LessonStatus, ScriptMaster } from "./types.ts";

function scriptMeetsReusableStandard(script: ScriptMaster): boolean {
  return (
    !!script.teachingFrame &&
    script.sections.length >= 1 &&
    script.sections.every((section) => !!section.visualPlan)
  );
}

export function readReusableLessonScript(
  root: string,
  lessonId: string
): ScriptMaster | null {
  const statusPath = resolveLessonArtifactPath(root, lessonId, "status.json");
  const scriptPath = resolveLessonArtifactPath(root, lessonId, "script-master.json");

  if (!existsSync(statusPath) || !existsSync(scriptPath)) {
    return null;
  }

  try {
    const status = readJson<LessonStatus>(statusPath);
    if (status.state !== "READY_TO_RECORD") {
      return null;
    }

    const script = readJson<ScriptMaster>(scriptPath);
    return scriptMeetsReusableStandard(script) ? script : null;
  } catch {
    return null;
  }
}

export function isReusableLesson(
  root: string,
  lessonId: string
): boolean {
  return readReusableLessonScript(root, lessonId) !== null;
}

export function listReusableLessonIds(root: string): string[] {
  return listLessonDirs(root)
    .map((dir) => lessonIdFromDir(dir))
    .filter((lessonId) => isReusableLesson(root, lessonId))
    .sort(compareLessonIds);
}
