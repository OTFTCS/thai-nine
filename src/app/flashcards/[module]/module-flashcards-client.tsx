"use client";

import { useMemo, useState } from "react";

interface ModuleFlashcard {
  id: string;
  vocabId: string;
  thai: string;
  translit: string;
  english: string;
  lessonId: string;
  tags: string[];
}

interface ModuleFlashcardsClientProps {
  cards: ModuleFlashcard[];
  moduleId: string;
}

/**
 * SRS-lite v1: in-memory only. "Got it" advances; "Review again" defers
 * the card to the back of the queue. No persistence, no spaced timing.
 */
export function ModuleFlashcardsClient({
  cards,
  moduleId,
}: ModuleFlashcardsClientProps) {
  const initialQueue = useMemo(() => cards.map((c) => c.id), [cards]);
  const cardsById = useMemo(() => {
    const m = new Map<string, ModuleFlashcard>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [deferred, setDeferred] = useState(0);

  const currentId = queue[0];
  const current = currentId ? cardsById.get(currentId) : undefined;
  const finished = queue.length === 0;

  function gotIt() {
    setReviewed((n) => n + 1);
    setQueue((q) => q.slice(1));
    setFlipped(false);
  }

  function reviewAgain() {
    setDeferred((n) => n + 1);
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    setFlipped(false);
  }

  function restart() {
    setQueue(initialQueue);
    setFlipped(false);
    setReviewed(0);
    setDeferred(0);
  }

  if (cards.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        This module has no cards yet.
      </p>
    );
  }

  if (finished) {
    return (
      <div className="text-center py-12 space-y-4">
        <h2 className="text-xl font-bold text-foreground">Session complete</h2>
        <p className="text-muted-foreground">
          You cleared {reviewed} card{reviewed !== 1 ? "s" : ""} from{" "}
          {moduleId}
          {deferred > 0
            ? `, with ${deferred} deferred review${deferred !== 1 ? "s" : ""} along the way`
            : ""}
          .
        </p>
        <button
          type="button"
          onClick={restart}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          Restart deck
        </button>
      </div>
    );
  }

  if (!current) return null;

  const totalCards = cards.length;
  const progress = totalCards - queue.length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Card {progress + 1} of {totalCards}
        </p>
        <div className="w-full max-w-md mx-auto h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-300"
            style={{ width: `${(progress / totalCards) * 100}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full rounded-xl border border-border bg-card p-10 text-center cursor-pointer select-none min-h-[260px] flex flex-col items-center justify-center"
        aria-label={flipped ? "Hide answer" : "Reveal answer"}
      >
        {!flipped ? (
          <p
            className="text-5xl font-medium text-foreground"
            style={{ fontFamily: "Sarabun, sans-serif" }}
          >
            {current.thai}
          </p>
        ) : (
          <div className="space-y-3">
            <p
              className="text-2xl text-muted-foreground"
              style={{ fontFamily: "Sarabun, sans-serif" }}
            >
              {current.translit}
            </p>
            <p className="text-xl text-foreground">{current.english}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Introduced in {current.lessonId}
            </p>
          </div>
        )}
      </button>

      <div className="min-h-[44px]">
        {flipped ? (
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={reviewAgain}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Review again
            </button>
            <button
              type="button"
              onClick={gotIt}
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
            >
              Got it
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Tap the card to reveal the answer
          </p>
        )}
      </div>
    </div>
  );
}
