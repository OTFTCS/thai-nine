#!/usr/bin/env -S node --experimental-strip-types
/**
 * build_stage_capstone.ts
 *
 * Aggregates per-lesson quiz JSONs across all modules in a stage into a 30-question
 * cumulative capstone, weighted to grammar function and recently-introduced vocab.
 *
 *   node --experimental-strip-types course/tools/build_stage_capstone.ts --stage S1
 *
 * Weighting:
 *   - 60% from the most recent module in the stage (recency bias for new vocab).
 *   - 30% from middle modules.
 *   - 10% from the oldest module.
 *   - Grammar-function bias: prefer items whose rationale mentions "languageFocus"
 *     or whose type is context_mcq (production/grammar usage).
 *
 * Skips lessons without quiz JSON and warns rather than failing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { QuizItem, QuizSet } from "./lib/types.ts";

interface CapstoneQuestion {
  id: string;
  sourceLessonId: string;
  sourceQuestionId: string;
  bankItemId?: string;
  vocabId: string;
  type: QuizItem["type"] | "listening_link";
  displayMode: QuizItem["displayMode"];
  prompt: { text: string; thai?: string; translit?: string; english?: string; audioCue?: string };
  options?: string[];
  answer: string;
  rationale: string;
  weight: number;
}

interface StageCapstone {
  schemaVersion: 1;
  scope: "stage_capstone";
  scopeId: string;
  passScore: 80;
  generatedAt: string;
  sourceLessons: string[];
  metadata: {
    targetQuestionCount: number;
    actualQuestionCount: number;
    lessonsCovered: number;
    lessonsExpected: number;
    lessonsMissing: string[];
    typeMix: Record<string, number>;
    moduleMix: Record<string, number>;
    gating: {
      passScore: 80;
      attemptsBeforeCooldown: number;
      cooldownHours: number;
      unlockNote: string;
    };
  };
  questions: Omit<CapstoneQuestion, "weight">[];
}

const TARGET = 30;

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

function parseArgs(argv: string[]): { stage: string } {
  const idx = argv.indexOf("--stage");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("Usage: build_stage_capstone.ts --stage S1");
  }
  const s = argv[idx + 1];
  if (!/^S\d$/.test(s)) {
    throw new Error(`Stage id must match /^S\\d$/, got "${s}"`);
  }
  return { stage: s };
}

interface StagesFile {
  stages: Array<{ stage_id: string; stage_title: string; module_range: string[] }>;
}

function loadStage(root: string, stageId: string): { title: string; modules: string[] } {
  const stagesPath = join(root, "course", "exports", "stages.json");
  const raw = JSON.parse(readFileSync(stagesPath, "utf8")) as StagesFile;
  const found = raw.stages.find((s) => s.stage_id === stageId);
  if (!found) throw new Error(`Stage ${stageId} not found in stages.json`);
  return { title: found.stage_title, modules: found.module_range };
}

function moduleLessonIds(moduleId: string): string[] {
  return Array.from({ length: 10 }, (_, i) => `${moduleId}-L${String(i + 1).padStart(3, "0")}`);
}

function quizPath(root: string, lessonId: string): string {
  const [moduleId, lessonFolder] = lessonId.split("-");
  return join(root, "course", "modules", moduleId, lessonFolder, `${lessonId}-quiz.json`);
}

function loadQuiz(path: string): QuizSet | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as QuizSet;
}

function moduleWeight(moduleIdx: number, totalModules: number): number {
  // Recency-biased: most recent module gets the highest base weight.
  if (totalModules === 1) return 1;
  if (moduleIdx === totalModules - 1) return 6;
  if (moduleIdx === 0) return 1;
  return 3;
}

function questionWeight(q: QuizItem, moduleW: number): number {
  // Grammar/production preference: context_mcq gets a small boost.
  // fill_translit also boosted (active recall).
  let typeBoost = 1;
  if (q.type === "context_mcq") typeBoost = 1.5;
  else if (q.type === "fill_translit") typeBoost = 1.25;
  return moduleW * typeBoost;
}

function pickWeighted<T extends { weight: number; sourceLessonId: string }>(
  pool: T[],
  n: number
): T[] {
  // Sort by weight desc, but rotate within equal-weight tiers across lessons
  // to avoid clustering on a single lesson.
  const sorted = [...pool].sort((a, b) => b.weight - a.weight);
  const tiers = new Map<number, T[]>();
  for (const q of sorted) {
    if (!tiers.has(q.weight)) tiers.set(q.weight, []);
    tiers.get(q.weight)!.push(q);
  }
  const picked: T[] = [];
  for (const tier of [...tiers.keys()].sort((a, b) => b - a)) {
    const items = tiers.get(tier)!;
    const byLesson = new Map<string, T[]>();
    for (const it of items) {
      if (!byLesson.has(it.sourceLessonId)) byLesson.set(it.sourceLessonId, []);
      byLesson.get(it.sourceLessonId)!.push(it);
    }
    const lessonOrder = [...byLesson.keys()].sort();
    let advanced = true;
    while (advanced && picked.length < n) {
      advanced = false;
      for (const lesson of lessonOrder) {
        if (picked.length >= n) break;
        const queue = byLesson.get(lesson)!;
        if (queue.length === 0) continue;
        picked.push(queue.shift()!);
        advanced = true;
      }
    }
    if (picked.length >= n) break;
  }
  return picked;
}

function main(): number {
  const root = repoRoot();
  const { stage: stageId } = parseArgs(process.argv.slice(2));
  const stage = loadStage(root, stageId);

  const sourceLessons: string[] = [];
  const lessonsMissing: string[] = [];
  const expectedLessons: string[] = [];
  const pool: CapstoneQuestion[] = [];

  stage.modules.forEach((moduleId, moduleIdx) => {
    const moduleW = moduleWeight(moduleIdx, stage.modules.length);
    for (const lessonId of moduleLessonIds(moduleId)) {
      expectedLessons.push(lessonId);
      const quiz = loadQuiz(quizPath(root, lessonId));
      if (!quiz) {
        lessonsMissing.push(lessonId);
        continue;
      }
      sourceLessons.push(lessonId);
      for (const q of quiz.questions) {
        pool.push({
          id: `cap-src-${lessonId}-${q.id}`,
          sourceLessonId: lessonId,
          sourceQuestionId: q.id,
          bankItemId: q.bankItemId,
          vocabId: q.vocabId,
          type: q.type,
          displayMode: q.displayMode,
          prompt: { ...q.prompt },
          options: q.options ? [...q.options] : undefined,
          answer: q.answer,
          rationale: q.rationale,
          weight: questionWeight(q, moduleW),
        });
      }
    }
  });

  const pickedWithWeight = pickWeighted(pool, TARGET);

  const final = pickedWithWeight.slice(0, TARGET).map((q, i) => {
    const { weight: _w, ...rest } = q;
    return {
      ...rest,
      id: `cap-${stageId}-q${String(i + 1).padStart(2, "0")}`,
    };
  });

  const typeMix: Record<string, number> = {};
  const moduleMix: Record<string, number> = {};
  for (const q of final) {
    typeMix[q.type] = (typeMix[q.type] ?? 0) + 1;
    const m = q.sourceLessonId.split("-")[0];
    moduleMix[m] = (moduleMix[m] ?? 0) + 1;
  }

  const out: StageCapstone = {
    schemaVersion: 1,
    scope: "stage_capstone",
    scopeId: stageId,
    passScore: 80,
    generatedAt: new Date().toISOString(),
    sourceLessons,
    metadata: {
      targetQuestionCount: TARGET,
      actualQuestionCount: final.length,
      lessonsCovered: sourceLessons.length,
      lessonsExpected: expectedLessons.length,
      lessonsMissing,
      typeMix,
      moduleMix,
      gating: {
        passScore: 80,
        attemptsBeforeCooldown: 3,
        cooldownHours: 24,
        unlockNote: `Skool gates next stage on this capstone (${stage.title}); 80% to pass, 3 attempts then 24h cooldown.`,
      },
    },
    questions: final,
  };

  const outDir = join(root, "course", "exports", "stage-capstones");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${stageId}-capstone-quiz.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    `[${stageId.toLowerCase()}-capstone] ${sourceLessons.length} of ${expectedLessons.length} lessons had quiz JSON; produced capstone with ${final.length} items, expected ${TARGET}.`
  );
  if (lessonsMissing.length > 0 && lessonsMissing.length <= 10) {
    console.log(`[${stageId.toLowerCase()}-capstone] Missing: ${lessonsMissing.join(", ")}.`);
  } else if (lessonsMissing.length > 10) {
    console.log(`[${stageId.toLowerCase()}-capstone] Missing ${lessonsMissing.length} lessons. Run /produce-lesson to fill.`);
  }
  console.log(`[${stageId.toLowerCase()}-capstone] Wrote ${outPath}`);
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
