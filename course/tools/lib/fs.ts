import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  lessonArtifactCandidateNames,
  lessonArtifactFileName as buildLessonArtifactFileName,
} from "../../../src/lib/course-artifacts.ts";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function writeText(path: string, value: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, value, "utf8");
}

export function lessonPath(root: string, lessonId: string): string {
  const [moduleId, lessonPart] = lessonId.split("-");
  return join(root, "course", "modules", moduleId, lessonPart);
}

export function lessonArtifactFileName(lessonId: string, baseName: string): string {
  return buildLessonArtifactFileName(lessonId, baseName);
}

export function lessonDirArtifactPath(
  lessonDir: string,
  lessonId: string,
  baseName: string
): string {
  return join(lessonDir, lessonArtifactFileName(lessonId, baseName));
}

export function lessonArtifactPath(
  root: string,
  lessonId: string,
  baseName: string
): string {
  return lessonDirArtifactPath(lessonPath(root, lessonId), lessonId, baseName);
}

export function resolveLessonDirArtifactPath(
  lessonDir: string,
  lessonId: string,
  baseName: string
): string {
  for (const candidate of lessonArtifactCandidateNames(lessonId, baseName)) {
    const candidatePath = join(lessonDir, candidate);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return lessonDirArtifactPath(lessonDir, lessonId, baseName);
}

export function resolveLessonArtifactPath(
  root: string,
  lessonId: string,
  baseName: string
): string {
  return resolveLessonDirArtifactPath(lessonPath(root, lessonId), lessonId, baseName);
}

export function listLessonDirs(root: string): string[] {
  const modulesDir = join(root, "course", "modules");
  if (!existsSync(modulesDir)) return [];
  const out: string[] = [];

  for (const mod of readdirSync(modulesDir)) {
    const modPath = join(modulesDir, mod);
    if (!statSync(modPath).isDirectory()) continue;
    for (const lesson of readdirSync(modPath)) {
      const lp = join(modPath, lesson);
      if (statSync(lp).isDirectory()) out.push(lp);
    }
  }

  return out.sort();
}
