#!/usr/bin/env -S node --experimental-strip-types
/**
 * build_module_quiz.ts
 *
 * Aggregates per-lesson quiz JSONs across one module into a 20-question
 * module quiz with a balanced type mix.
 *
 *   node --experimental-strip-types course/tools/build_module_quiz.ts --module M01
 *
 * Mix target (of 20):
 *   ~40% MCQ comprehension       (thai_to_english + english_to_thai)
 *   ~30% transliteration         (fill_translit)
 *   ~20% production / short-answer (context_mcq, treated as production-ish)
 *   ~10% listening-link          (synthesised from comprehension items if present)
 *
 * If a per-lesson quiz JSON is missing, the lesson is skipped with a warning.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { QuizItem, QuizSet } from "./lib/types.ts";

interface ModuleQuizQuestion {
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
}

interface ModuleQuiz {
  schemaVersion: 1;
  scope: "module";
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
    gating: {
      passScore: 80;
      attemptsBeforeCooldown: number;
      cooldownHours: number;
      unlockNote: string;
    };
  };
  questions: ModuleQuizQuestion[];
}

const TARGET = 20;
// Quotas roughly: 8 comprehension MCQ, 6 translit, 4 production (context_mcq), 2 listening.
const QUOTAS = {
  comprehension: 8,
  translit: 6,
  production: 4,
  listening: 2,
} as const;

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

function parseArgs(argv: string[]): { module: string } {
  const idx = argv.indexOf("--module");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("Usage: build_module_quiz.ts --module M01");
  }
  const m = argv[idx + 1];
  if (!/^M\d{2}$/.test(m)) {
    throw new Error(`Module id must match /^M\\d{2}$/, got "${m}"`);
  }
  return { module: m };
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

function bucketFor(type: QuizItem["type"]): "comprehension" | "translit" | "production" {
  if (type === "fill_translit") return "translit";
  if (type === "context_mcq") return "production";
  return "comprehension"; // thai_to_english + english_to_thai
}

function pickWithRotation<T extends { sourceLessonId: string }>(pool: T[], n: number): T[] {
  // Round-robin by sourceLessonId so we spread questions across lessons.
  const byLesson = new Map<string, T[]>();
  for (const q of pool) {
    if (!byLesson.has(q.sourceLessonId)) byLesson.set(q.sourceLessonId, []);
    byLesson.get(q.sourceLessonId)!.push(q);
  }
  const lessons = [...byLesson.keys()].sort();
  const picked: T[] = [];
  while (picked.length < n) {
    let advanced = false;
    for (const lesson of lessons) {
      if (picked.length >= n) break;
      const queue = byLesson.get(lesson)!;
      if (queue.length === 0) continue;
      picked.push(queue.shift()!);
      advanced = true;
    }
    if (!advanced) break;
  }
  return picked;
}

function buildListeningQuestions(
  comprehension: ModuleQuizQuestion[],
  needed: number
): ModuleQuizQuestion[] {
  // Synthesise listening-link questions from existing comprehension items.
  // Until videoIds land in W2b we use a placeholder — see export_skool_quiz_csv.ts
  // for how this gets serialised into Skool's text-only listening prompt.
  const out: ModuleQuizQuestion[] = [];
  for (const q of comprehension) {
    if (out.length >= needed) break;
    if (!q.prompt.thai) continue;
    out.push({
      id: `mq-listen-${out.length + 1}`,
      sourceLessonId: q.sourceLessonId,
      sourceQuestionId: q.sourceQuestionId,
      bankItemId: q.bankItemId,
      vocabId: q.vocabId,
      type: "listening_link",
      displayMode: "thai_only",
      prompt: {
        text: `Listen to the lesson clip, then choose the best meaning of ${q.prompt.thai}.`,
        thai: q.prompt.thai,
        translit: q.prompt.translit,
        audioCue: `lesson:${q.sourceLessonId}`,
      },
      options: q.options,
      answer: q.answer,
      rationale: "Listening recall sourced from lesson recording (timestamped link added at export).",
    });
  }
  return out;
}

function main(): number {
  const root = repoRoot();
  const { module: moduleId } = parseArgs(process.argv.slice(2));
  const lessonIds = moduleLessonIds(moduleId);

  const sourceLessons: string[] = [];
  const lessonsMissing: string[] = [];
  const allQuestions: ModuleQuizQuestion[] = [];

  for (const lessonId of lessonIds) {
    const quiz = loadQuiz(quizPath(root, lessonId));
    if (!quiz) {
      lessonsMissing.push(lessonId);
      continue;
    }
    sourceLessons.push(lessonId);
    for (const q of quiz.questions) {
      allQuestions.push({
        id: `mq-src-${lessonId}-${q.id}`,
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
      });
    }
  }

  const buckets = {
    comprehension: allQuestions.filter((q) => bucketFor(q.type as QuizItem["type"]) === "comprehension"),
    translit: allQuestions.filter((q) => bucketFor(q.type as QuizItem["type"]) === "translit"),
    production: allQuestions.filter((q) => bucketFor(q.type as QuizItem["type"]) === "production"),
  };

  const picked: ModuleQuizQuestion[] = [];
  picked.push(...pickWithRotation(buckets.comprehension, QUOTAS.comprehension));
  picked.push(...pickWithRotation(buckets.translit, QUOTAS.translit));
  picked.push(...pickWithRotation(buckets.production, QUOTAS.production));

  const listening = buildListeningQuestions(buckets.comprehension, QUOTAS.listening);
  picked.push(...listening);

  // If we underran a quota (small bank), backfill with whatever's left.
  if (picked.length < TARGET) {
    const used = new Set(picked.map((q) => `${q.sourceLessonId}:${q.sourceQuestionId}`));
    for (const q of allQuestions) {
      if (picked.length >= TARGET) break;
      const key = `${q.sourceLessonId}:${q.sourceQuestionId}`;
      if (used.has(key)) continue;
      picked.push(q);
      used.add(key);
    }
  }

  // Reassign sequential IDs so the output looks clean.
  const final = picked.slice(0, TARGET).map((q, i) => ({
    ...q,
    id: `mq-${moduleId}-q${String(i + 1).padStart(2, "0")}`,
  }));

  const typeMix: Record<string, number> = {};
  for (const q of final) {
    typeMix[q.type] = (typeMix[q.type] ?? 0) + 1;
  }

  const out: ModuleQuiz = {
    schemaVersion: 1,
    scope: "module",
    scopeId: moduleId,
    passScore: 80,
    generatedAt: new Date().toISOString(),
    sourceLessons,
    metadata: {
      targetQuestionCount: TARGET,
      actualQuestionCount: final.length,
      lessonsCovered: sourceLessons.length,
      lessonsExpected: lessonIds.length,
      lessonsMissing,
      typeMix,
      gating: {
        passScore: 80,
        attemptsBeforeCooldown: 3,
        cooldownHours: 24,
        unlockNote: "Skool gates next module on this quiz; 80% to pass, 3 attempts then 24h cooldown.",
      },
    },
    questions: final,
  };

  const outPath = join(root, "course", "modules", moduleId, `${moduleId}-module-quiz.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    `[${moduleId.toLowerCase()}-quiz] ${sourceLessons.length} of ${lessonIds.length} lessons had quiz JSON; produced module quiz with ${final.length} items, expected ${TARGET}.`
  );
  if (lessonsMissing.length > 0) {
    console.log(
      `[${moduleId.toLowerCase()}-quiz] Missing per-lesson quizzes: ${lessonsMissing.join(", ")}. Run /produce-lesson on each to fill in.`
    );
  }
  console.log(`[${moduleId.toLowerCase()}-quiz] Wrote ${outPath}`);
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
