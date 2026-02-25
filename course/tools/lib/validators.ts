import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listLessonDirs, readJson } from "./fs.ts";
import type { LessonStatus, ValidationIssue } from "./types.ts";

const REQUIRED_READY_FILES = [
  "brief.md",
  "script-spoken.md",
  "script-visual.md",
  "quiz.json",
  "qa-checklist.md",
  "status.json",
];

function parseChecklist(path: string): boolean {
  const content = readFileSync(path, "utf8");
  return content.includes("[x]") && !content.includes("[ ]");
}

export function validateLessonDir(lessonDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const statusPath = join(lessonDir, "status.json");

  if (!existsSync(statusPath)) {
    issues.push({ path: lessonDir, message: "Missing status.json" });
    return issues;
  }

  const status = readJson<LessonStatus>(statusPath);
  if (status.state === "READY_TO_RECORD") {
    for (const file of REQUIRED_READY_FILES) {
      const filePath = join(lessonDir, file);
      if (!existsSync(filePath)) {
        issues.push({ path: filePath, message: "Required file missing for READY_TO_RECORD" });
      }
    }

    const qaPath = join(lessonDir, "qa-checklist.md");
    if (existsSync(qaPath) && !parseChecklist(qaPath)) {
      issues.push({ path: qaPath, message: "Checklist contains unchecked items" });
    }

    if (!status.validatedAt) {
      issues.push({ path: statusPath, message: "READY_TO_RECORD requires validatedAt timestamp" });
    }
  }

  const lessonFolder = basename(lessonDir);
  if (!/^L\d{3}$/.test(lessonFolder)) {
    issues.push({ path: lessonDir, message: "Lesson folder must follow L### format" });
  }

  return issues;
}

export function validateAll(root: string): ValidationIssue[] {
  const dirs = listLessonDirs(root);
  return dirs.flatMap((dir) => validateLessonDir(dir));
}
