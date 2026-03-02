// ---------------------------------------------------------------------------
// Assessment Scoring Engine
// Handles: weighted section scoring, confidence, topic gaps, placement bands
// ---------------------------------------------------------------------------

import type {
  AssessmentQuiz,
  AssessmentResult,
  AssessmentSession,
  ConfidenceResult,
  PlacementBand,
  QuestionAnswer,
  SectionScore,
  TopicGap,
} from "@/types/assessment";
import { TAG_LESSON_MAP } from "@/types/assessment";

/** Compute weighted section scores from a completed session. */
export function computeSectionScores(
  quiz: AssessmentQuiz,
  answers: QuestionAnswer[],
): SectionScore[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  return quiz.sections.map((section) => {
    const sectionQuestions = quiz.questions.filter(
      (q) => q.sectionId === section.id,
    );
    const answered = sectionQuestions.filter((q) => answerMap.has(q.id));
    const correct = answered.filter((q) => answerMap.get(q.id)?.correct).length;
    const total = sectionQuestions.length;
    const rawPercent = total > 0 ? (correct / total) * 100 : 0;
    const weightedScore = rawPercent * section.weight;

    return {
      sectionId: section.id,
      correct,
      total,
      rawPercent: Math.round(rawPercent * 100) / 100,
      weightedScore: Math.round(weightedScore * 100) / 100,
    };
  });
}

/** Compute overall weighted score (0-100). */
export function computeOverallScore(sectionScores: SectionScore[]): number {
  const total = sectionScores.reduce((sum, s) => sum + s.weightedScore, 0);
  return Math.round(total * 100) / 100;
}

/** Determine placement band from score. */
export function determinePlacementBand(
  score: number,
  bands: PlacementBand[],
): PlacementBand | undefined {
  return bands.find((b) => score >= b.scoreMin && score <= b.scoreMax);
}

/** Assess confidence based on answer patterns. */
export function assessConfidence(
  answers: QuestionAnswer[],
  totalQuestions: number,
): ConfidenceResult {
  if (answers.length === 0) {
    return { level: "low", reason: "No questions answered" };
  }

  const answeredRatio = answers.length / totalQuestions;
  const correctRatio =
    answers.filter((a) => a.correct).length / answers.length;

  // Fast answers (< 3s) on wrong questions suggest guessing
  const fastWrongCount = answers.filter(
    (a) => !a.correct && a.timeSpentMs < 3000,
  ).length;
  const guessRatio = fastWrongCount / answers.length;

  // Consistent performance = high confidence
  if (answeredRatio >= 0.9 && guessRatio < 0.15) {
    return { level: "high", reason: "Consistent, deliberate responses" };
  }

  if (answeredRatio >= 0.7 && guessRatio < 0.3) {
    return {
      level: "medium",
      reason: `${Math.round(guessRatio * 100)}% of answers appeared rushed`,
    };
  }

  const skipped = totalQuestions - answers.length;
  const parts: string[] = [];
  if (skipped > 0) parts.push(`${skipped} question(s) skipped`);
  if (fastWrongCount > 0)
    parts.push(`${fastWrongCount} answer(s) appeared rushed`);

  return {
    level: "low",
    reason: parts.join("; ") || "Insufficient data for confident placement",
  };
}

/** Identify topic gaps from wrong answers and map to lesson recommendations. */
export function identifyTopicGaps(
  quiz: AssessmentQuiz,
  answers: QuestionAnswer[],
): TopicGap[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const tagStats = new Map<string, { missed: number; total: number }>();

  for (const question of quiz.questions) {
    for (const tag of question.tags) {
      const stats = tagStats.get(tag) ?? { missed: 0, total: 0 };
      stats.total += 1;
      const answer = answerMap.get(question.id);
      if (!answer || !answer.correct) {
        stats.missed += 1;
      }
      tagStats.set(tag, stats);
    }
  }

  const gaps: TopicGap[] = [];
  for (const [tag, stats] of tagStats) {
    // Only flag if >= 50% of questions with this tag were missed
    if (stats.missed / stats.total >= 0.5) {
      const mapping = TAG_LESSON_MAP.find((m) => m.tag === tag);
      gaps.push({
        tag,
        missedCount: stats.missed,
        totalCount: stats.total,
        recommendedLessonIds: mapping?.lessonIds ?? [],
      });
    }
  }

  return gaps.sort((a, b) => b.missedCount - a.missedCount);
}

/** Compute the full assessment result from a completed session. */
export function computeAssessmentResult(
  quiz: AssessmentQuiz,
  session: AssessmentSession,
): AssessmentResult {
  const sectionScores = computeSectionScores(quiz, session.answers);
  const overallScore = computeOverallScore(sectionScores);
  const confidence = assessConfidence(session.answers, quiz.questions.length);
  const topicGaps = identifyTopicGaps(quiz, session.answers);

  const placementBand = quiz.placementBands
    ? determinePlacementBand(overallScore, quiz.placementBands)
    : undefined;

  const passedCtaThreshold = quiz.ctaThresholdPercent
    ? overallScore >= quiz.ctaThresholdPercent
    : undefined;

  // Determine recommended deep link
  let recommendedDeepLink = "/dashboard";
  if (placementBand) {
    recommendedDeepLink = placementBand.deepLink;
  } else if (topicGaps.length > 0 && topicGaps[0].recommendedLessonIds.length > 0) {
    recommendedDeepLink = `/lessons/${topicGaps[0].recommendedLessonIds[0]}`;
  }

  return {
    sessionId: session.sessionId,
    quizId: quiz.id,
    kind: quiz.kind,
    overallScore,
    sectionScores,
    placementBand,
    confidence,
    topicGaps,
    passedCtaThreshold,
    recommendedDeepLink,
    completedAt: session.completedAt ?? new Date().toISOString(),
  };
}

/** Get the running score for a specific section during the quiz (for branching). */
export function getRunningSectionScore(
  quiz: AssessmentQuiz,
  answers: QuestionAnswer[],
  sectionId: string,
): number {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const section = quiz.sections.find((s) => s.id === sectionId);
  if (!section) return 0;

  const sectionQuestions = quiz.questions.filter(
    (q) => q.sectionId === section.id,
  );
  const answered = sectionQuestions.filter((q) => answerMap.has(q.id));
  if (answered.length === 0) return 0;

  const correct = answered.filter((q) => answerMap.get(q.id)?.correct).length;
  return (correct / answered.length) * 100;
}
