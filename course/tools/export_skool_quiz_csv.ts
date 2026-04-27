#!/usr/bin/env -S node --experimental-strip-types
/**
 * export_skool_quiz_csv.ts
 *
 * Flattens any quiz JSON (per-lesson, module, or stage capstone) to Skool's
 * quiz-import CSV format.
 *
 *   node --experimental-strip-types course/tools/export_skool_quiz_csv.ts course/modules/M01/M01-module-quiz.json
 *
 * Skool columns (v1 documented shape):
 *   question_text, question_type, option_a, option_b, option_c, option_d,
 *   correct_option, points
 *
 * Listening questions become text questions with a YouTube-timestamp deep-link
 * placeholder template `[Listen at https://youtu.be/<videoId>?t=<sec>]` injected
 * into question_text. videoIds + offsets are filled in W2b post-recording from
 * the recordings manifest.
 *
 * Output: course/exports/skool-quizzes/<source_basename>.skool.csv
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface AnyQuizQuestion {
  id: string;
  sourceLessonId?: string;
  sourceQuestionId?: string;
  bankItemId?: string;
  vocabId: string;
  type: string;
  displayMode: string;
  prompt: { text: string; thai?: string; translit?: string; english?: string; audioCue?: string };
  options?: string[];
  answer: string;
  rationale: string;
}

interface AnyQuiz {
  schemaVersion: 1;
  lessonId?: string;
  scope?: "module" | "stage_capstone";
  scopeId?: string;
  questions: AnyQuizQuestion[];
}

const COLUMNS = [
  "question_text",
  "question_type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "points",
] as const;

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function detectListening(q: AnyQuizQuestion): boolean {
  return q.type === "listening_link" || Boolean(q.prompt.audioCue);
}

function buildListeningPrefix(q: AnyQuizQuestion): string {
  // Placeholder until W2b assigns videoIds + offsets per-lesson.
  // Format: [Listen at https://youtu.be/<videoId>?t=<sec>]
  const lessonRef = q.sourceLessonId ?? q.prompt.audioCue ?? "lesson";
  return `[Listen at https://youtu.be/<videoId:${lessonRef}>?t=<sec>] `;
}

function questionTextFor(q: AnyQuizQuestion): string {
  const base = q.prompt.text;
  if (detectListening(q)) {
    return `${buildListeningPrefix(q)}${base}`;
  }
  return base;
}

function questionTypeFor(q: AnyQuizQuestion): string {
  if (q.type === "fill_translit") return "short_answer";
  if (q.type === "listening_link") return "multiple_choice"; // listening renders as MCQ in Skool
  return "multiple_choice";
}

interface SkoolRow {
  question_text: string;
  question_type: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string; // "A" / "B" / "C" / "D" or "" for short_answer
  points: string;
}

function rowFor(q: AnyQuizQuestion): SkoolRow {
  const qType = questionTypeFor(q);
  const text = questionTextFor(q);

  if (qType === "short_answer") {
    // For fill_translit: answer goes into option_a (Skool convention for
    // short-answer accept-list); correct_option left blank.
    const accept = q.answer;
    return {
      question_text: text,
      question_type: "short_answer",
      option_a: accept,
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "",
      points: "1",
    };
  }

  // MCQ. Skool expects up to 4 options. We pad/truncate.
  const opts = (q.options ?? []).slice(0, 4);
  while (opts.length < 4) opts.push("");
  const correctIdx = opts.indexOf(q.answer);
  const correctLetter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "A";

  return {
    question_text: text,
    question_type: "multiple_choice",
    option_a: opts[0],
    option_b: opts[1],
    option_c: opts[2],
    option_d: opts[3],
    correct_option: correctLetter,
    points: "1",
  };
}

function serialise(rows: SkoolRow[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.join(","));
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => csvEscape(r[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    throw new Error("Usage: export_skool_quiz_csv.ts <path-to-quiz.json>");
  }
  const inputPath = argv[0];
  const root = repoRoot();
  const resolvedInput = inputPath.startsWith("/") ? inputPath : join(root, inputPath);
  if (!existsSync(resolvedInput)) {
    throw new Error(`Quiz JSON not found: ${resolvedInput}`);
  }

  const data = JSON.parse(readFileSync(resolvedInput, "utf8")) as AnyQuiz;
  if (!Array.isArray(data.questions)) {
    throw new Error(`Quiz JSON has no questions array: ${resolvedInput}`);
  }

  const rows = data.questions.map(rowFor);
  const csv = serialise(rows);

  const outDir = join(root, "course", "exports", "skool-quizzes");
  mkdirSync(outDir, { recursive: true });
  const inputBase = basename(resolvedInput, ".json");
  const outPath = join(outDir, `${inputBase}.skool.csv`);
  writeFileSync(outPath, csv, "utf8");

  console.log(`[skool-csv] Flattened ${rows.length} questions from ${basename(resolvedInput)}`);
  console.log(`[skool-csv] Wrote ${outPath}`);
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
