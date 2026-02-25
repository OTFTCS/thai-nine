import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

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
