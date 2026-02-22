// SM-2 Spaced Repetition Algorithm (same as Anki)
// quality: 0 = complete blackout, 5 = perfect response

export interface SRSCard {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SRSResult extends SRSCard {
  nextReviewAt: Date;
}

export function calculateNextReview(
  card: SRSCard,
  quality: number // 0-5
): SRSResult {
  let { easeFactor, intervalDays, repetitions } = card;

  if (quality < 3) {
    // Failed: reset
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  // Update ease factor
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return { easeFactor, intervalDays, repetitions, nextReviewAt };
}

// Map button labels to quality scores
export const SRS_RATINGS = [
  { label: "Again", quality: 0, color: "destructive" },
  { label: "Hard", quality: 2, color: "warning" },
  { label: "Good", quality: 4, color: "success" },
  { label: "Easy", quality: 5, color: "primary" },
] as const;
