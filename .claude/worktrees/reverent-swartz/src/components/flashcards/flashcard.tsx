"use client";

import { cn } from "@/lib/utils";
import { Flashcard as FlashcardType } from "@/types/flashcard";

interface FlashcardProps {
  card: FlashcardType;
  flipped: boolean;
  onFlip: () => void;
}

export function Flashcard({ card, flipped, onFlip }: FlashcardProps) {
  return (
    <div
      className="flashcard-flip w-full max-w-md mx-auto cursor-pointer select-none"
      onClick={onFlip}
    >
      <div className={cn("flashcard-inner relative w-full aspect-[3/2]", flipped && "flipped")}>
        {/* Front */}
        <div className="flashcard-front absolute inset-0 rounded-2xl border border-border bg-card shadow-lg flex flex-col items-center justify-center p-8">
          <p className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            {card.frontText}
          </p>
          <p className="text-sm text-muted-foreground">Tap to reveal</p>
        </div>

        {/* Back */}
        <div className="flashcard-back absolute inset-0 rounded-2xl border border-primary/30 bg-card shadow-lg flex flex-col items-center justify-center p-8">
          <p className="text-3xl font-bold text-foreground mb-2">
            {card.backText}
          </p>
          {card.backNotes && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              {card.backNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
