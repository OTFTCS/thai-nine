#!/usr/bin/env -S node --experimental-strip-types
/**
 * build_flashcards.ts — W8 Flashcards builder.
 *
 * Reads:
 *   - course/vocab/vocab-index.json          (source of truth for vocab)
 *   - course/exports/full-thai-course-blueprint.csv  (module / lesson mapping)
 *   - course/exports/skool-metadata.csv      (extra flashcard tags)
 *
 * Emits:
 *   - course/exports/flashcards/M01.json ... M18.json  (web viewer + .apkg input)
 *   - course/exports/flashcards/M01.apkg ... M18.apkg  (via build_flashcards.py)
 *
 * Audio-less v1: no TTS / forced alignment. Card front is Thai script;
 * card back is PTM transliteration + English gloss + the lesson_id where the
 * vocab token was first introduced. Tags include `module-M??`,
 * `lesson-M??-L???`, plus any tokens from `flashcard_tags` in skool-metadata.
 *
 * The .apkg writer is a Python helper (build_flashcards.py) because the
 * official `genanki` package targets Python and there is no maintained npm
 * equivalent. The TS half owns the data shaping; the Python half owns the
 * SQLite-backed Anki package format.
 *
 * Usage:
 *   node --experimental-strip-types course/tools/build_flashcards.ts
 *   node --experimental-strip-types course/tools/build_flashcards.ts --module M01
 *   node --experimental-strip-types course/tools/build_flashcards.ts --json-only
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readBlueprintLessonRows, type BlueprintLessonRow } from "./lib/produce-lesson.ts";
import type { VocabIndex } from "./lib/types.ts";

interface ModuleFlashcard {
  id: string;
  vocabId: string;
  thai: string;
  translit: string;
  english: string;
  lessonId: string;
  tags: string[];
}

interface ModuleFlashcardDeck {
  schemaVersion: 1;
  moduleId: string;
  moduleTitle: string;
  generatedAt: string;
  source: "build_flashcards";
  lessonIds: string[];
  cards: ModuleFlashcard[];
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

function parseArgs(argv: string[]): { module?: string; jsonOnly: boolean } {
  let module: string | undefined;
  let jsonOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--module" && argv[i + 1]) {
      module = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json-only") {
      jsonOnly = true;
    }
  }
  if (module && !/^M\d{2}$/.test(module)) {
    throw new Error(`Module id must match /^M\\d{2}$/, got "${module}"`);
  }
  return { module, jsonOnly };
}

/**
 * Parse a single new_vocab_core entry like "สวัสดี = hello" -> "สวัสดี".
 */
function extractThaiTokens(newVocabCore: string): string[] {
  if (!newVocabCore) return [];
  const tokens: string[] = [];
  for (const raw of newVocabCore.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const [thaiSide] = trimmed.split("=");
    const thai = (thaiSide ?? "").trim();
    if (thai) tokens.push(thai);
  }
  return tokens;
}

/**
 * Parse the loose `flashcard_tags` cell from skool-metadata. Format is
 * mixed semicolon / comma separated, e.g. "M01; L001; first-contact;politeness".
 */
function parseFlashcardTagCell(cell: string): string[] {
  if (!cell) return [];
  return cell
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function loadVocabIndex(root: string): VocabIndex {
  const path = join(root, "course", "vocab", "vocab-index.json");
  return JSON.parse(readFileSync(path, "utf8")) as VocabIndex;
}

/**
 * Build the per-module deck payloads. Walks the blueprint in lesson order;
 * for each lesson, reads `new_vocab_core` and resolves each Thai token
 * against the vocab-index. Cards inherit the lesson_id where the token was
 * introduced (which is the current lesson by definition since we read
 * `new_vocab_core`).
 */
function buildDecks(
  rows: BlueprintLessonRow[],
  vocabIndex: VocabIndex
): ModuleFlashcardDeck[] {
  const byThaiKey = new Map<string, (typeof vocabIndex.entries)[number]>();
  for (const entry of vocabIndex.entries) {
    // Prefer first-seen entry. vocab-index entries are unique by id; collisions
    // on Thai-only key are rare but possible (homographs); resolve by
    // earliest firstSeenLesson.
    const existing = byThaiKey.get(entry.thai);
    if (!existing || (entry.firstSeenLesson ?? "") < (existing.firstSeenLesson ?? "")) {
      byThaiKey.set(entry.thai, entry);
    }
  }

  // Group blueprint rows by module, preserving lesson order.
  const byModule = new Map<string, BlueprintLessonRow[]>();
  for (const row of [...rows].sort((a, b) => a.lessonId.localeCompare(b.lessonId))) {
    if (!byModule.has(row.moduleId)) byModule.set(row.moduleId, []);
    byModule.get(row.moduleId)!.push(row);
  }

  const generatedAt = new Date().toISOString();
  const decks: ModuleFlashcardDeck[] = [];

  for (const [moduleId, moduleRows] of [...byModule.entries()].sort()) {
    const moduleTitle = moduleRows[0]?.moduleTitle ?? "";
    const cards: ModuleFlashcard[] = [];
    const lessonIds: string[] = [];
    const seenInDeck = new Set<string>(); // dedup vocabIds inside one module

    let cardCounter = 1;
    for (const row of moduleRows) {
      lessonIds.push(row.lessonId);
      const tokens = extractThaiTokens(row.newVocabCore);
      const extraTags = parseFlashcardTagCell(row.flashcardTags);

      for (const thai of tokens) {
        const entry = byThaiKey.get(thai);
        if (!entry) {
          console.warn(
            `[build_flashcards] WARN ${row.lessonId}: Thai token "${thai}" not found in vocab-index, skipping`
          );
          continue;
        }
        if (seenInDeck.has(entry.id)) continue;
        seenInDeck.add(entry.id);

        const tagSet = new Set<string>([
          `module-${moduleId}`,
          `lesson-${row.lessonId}`,
          ...extraTags,
        ]);

        cards.push({
          id: `${moduleId.toLowerCase()}-c${String(cardCounter).padStart(3, "0")}`,
          vocabId: entry.id,
          thai: entry.thai,
          translit: entry.translit,
          english: entry.english,
          lessonId: row.lessonId,
          tags: [...tagSet],
        });
        cardCounter += 1;
      }
    }

    decks.push({
      schemaVersion: 1,
      moduleId,
      moduleTitle,
      generatedAt,
      source: "build_flashcards",
      lessonIds,
      cards,
    });
  }

  return decks;
}

function writeDeckJson(root: string, deck: ModuleFlashcardDeck): string {
  const dir = join(root, "course", "exports", "flashcards");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${deck.moduleId}.json`);
  writeFileSync(outPath, JSON.stringify(deck, null, 2) + "\n", "utf8");
  return outPath;
}

function runApkgBuilder(root: string, moduleId?: string): void {
  const script = join(root, "course", "tools", "build_flashcards.py");
  const args = moduleId ? ["--module", moduleId] : ["--all"];
  // Use the python that has genanki; fall back to /usr/bin/python3.
  const candidates = ["/opt/homebrew/bin/python3", "/usr/bin/python3", "python3"];
  let pythonBin = candidates[0];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-c", "import genanki"], { stdio: "ignore" });
      pythonBin = c;
      break;
    } catch {
      // try next candidate
    }
  }
  console.log(`[build_flashcards] Running ${pythonBin} ${script} ${args.join(" ")}`);
  execFileSync(pythonBin, [script, ...args], { stdio: "inherit" });
}

function main(): void {
  const root = repoRoot();
  const { module: moduleFilter, jsonOnly } = parseArgs(process.argv.slice(2));

  console.log("[build_flashcards] Reading blueprint and vocab-index...");
  const rows = readBlueprintLessonRows(root);
  if (rows.length === 0) {
    console.error("No blueprint rows found.");
    process.exit(1);
  }
  const vocabIndex = loadVocabIndex(root);
  console.log(
    `[build_flashcards] ${rows.length} lessons, ${vocabIndex.entries.length} vocab entries`
  );

  const decks = buildDecks(rows, vocabIndex);
  console.log(`[build_flashcards] Built ${decks.length} module decks`);

  const filtered = moduleFilter ? decks.filter((d) => d.moduleId === moduleFilter) : decks;
  if (filtered.length === 0) {
    console.error(`No decks matched module filter ${moduleFilter}.`);
    process.exit(1);
  }

  for (const deck of filtered) {
    const path = writeDeckJson(root, deck);
    console.log(`  wrote ${path.replace(root + "/", "")} (${deck.cards.length} cards)`);
  }

  if (jsonOnly) {
    console.log("[build_flashcards] --json-only passed, skipping .apkg build");
    return;
  }

  runApkgBuilder(root, moduleFilter);
  console.log("[build_flashcards] Done.");
}

main();
