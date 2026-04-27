import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { ModuleFlashcardsClient } from "./module-flashcards-client";

interface ModuleFlashcardsPageProps {
  params: Promise<{ module: string }>;
}

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
  schemaVersion: number;
  moduleId: string;
  moduleTitle: string;
  generatedAt: string;
  source: string;
  lessonIds: string[];
  cards: ModuleFlashcard[];
}

function loadDeck(moduleId: string): ModuleFlashcardDeck | null {
  if (!/^M\d{2}$/.test(moduleId)) return null;
  const path = join(
    process.cwd(),
    "course",
    "exports",
    "flashcards",
    `${moduleId}.json`
  );
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ModuleFlashcardDeck;
  } catch {
    return null;
  }
}

export default async function ModuleFlashcardsPage({
  params,
}: ModuleFlashcardsPageProps) {
  const { module } = await params;
  const deck = loadDeck(module);
  if (!deck) {
    notFound();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">
          {deck.moduleId} flashcards
        </p>
        <h1 className="text-2xl font-bold text-foreground mt-1">
          {deck.moduleTitle || deck.moduleId}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""} across{" "}
          {deck.lessonIds.length} lesson{deck.lessonIds.length !== 1 ? "s" : ""}
        </p>
      </header>

      <ModuleFlashcardsClient cards={deck.cards} moduleId={deck.moduleId} />
    </main>
  );
}
