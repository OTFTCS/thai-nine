"use client";

import { useState } from "react";
import { Flashcard as FlashcardType } from "@/types/flashcard";
import { Flashcard } from "./flashcard";
import { SrsRating } from "./srs-rating";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface FlashcardDeckProps {
  cards: FlashcardType[];
  lessonId: string;
}

export function FlashcardDeck({ cards, lessonId }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setFlipped(!flipped);
  };

  const handleRate = (_quality: number) => {
    // In production, this would call the SRS progress API
    setFlipped(false);
    setReviewed(reviewed + 1);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Session Complete!
        </h2>
        <p className="text-muted-foreground mb-6">
          You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setCurrentIndex(0);
              setFlipped(false);
              setReviewed(0);
              setFinished(false);
            }}
          >
            Review Again
          </Button>
          <Link href={`/lessons/${lessonId}`}>
            <Button>Back to Lesson</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No flashcards available yet.</p>
        <Link href={`/lessons/${lessonId}`}>
          <Button variant="outline" className="mt-4">
            Back to Lesson
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
        </p>
        <div className="w-full max-w-md mx-auto h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / cards.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Card */}
      <Flashcard card={currentCard} flipped={flipped} onFlip={handleFlip} />

      {/* Rating buttons (show after flip) */}
      <div className="min-h-[44px]">
        {flipped ? (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              How well did you know this?
            </p>
            <SrsRating onRate={handleRate} />
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
