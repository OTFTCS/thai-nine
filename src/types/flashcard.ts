export interface FlashcardDeck {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  frontText: string;
  frontAudioUrl?: string;
  backText: string;
  backNotes?: string;
  sortOrder: number;
}

export interface UserFlashcardProgress {
  flashcardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt?: string;
}
