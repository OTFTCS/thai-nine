import type {
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentScoreSummary,
  AssessmentTopic,
  PlacementBand,
  PlacementRecommendation,
  TopicSubscore,
} from "@/types/assessment";
import {
  getRecommendationForBand,
  type PlacementRecommendationMap,
} from "@/lib/quiz/lesson-recommendations";

const orderedBands: PlacementBand[] = [
  "A1.0",
  "A1.1",
  "A1.2",
  "A2.0",
  "A2.1",
  "B1-ish",
];

const coreTopics: AssessmentTopic[] = [
  "greetings",
  "politeness",
  "self_intro",
  "basics",
  "numbers",
  "question_words",
  "verbs",
  "adjectives",
];

const advancedTopics: AssessmentTopic[] = [
  "scheduling",
  "directions",
  "transport",
  "ordering",
  "grammar",
];

interface TopicAccumulator {
  topic: AssessmentTopic;
  answered: number;
  correct: number;
  wrong: number;
  idk: number;
  weightedAttempted: number;
  weightedCorrect: number;
}

function toBandIndex(band: PlacementBand) {
  return orderedBands.indexOf(band);
}

function averageTopicScore(subscores: TopicSubscore[], topics: AssessmentTopic[]) {
  const relevant = subscores.filter(
    (subscore) => topics.includes(subscore.topic) && subscore.answered > 0
  );

  if (relevant.length === 0) {
    return null;
  }

  return Math.round(
    relevant.reduce((sum, item) => sum + item.score, 0) / relevant.length
  );
}

function confidenceFromCompletionAndIdk(
  completionPercent: number,
  idkRate: number
) {
  if (completionPercent < 50 || idkRate >= 0.45) {
    return "low" as const;
  }

  if (completionPercent < 80 || idkRate >= 0.2) {
    return "medium" as const;
  }

  return "high" as const;
}

export function scoreAssessment(
  questions: AssessmentQuestion[],
  answers: Record<string, AssessmentAnswer>
): AssessmentScoreSummary {
  const topicMap = new Map<AssessmentTopic, TopicAccumulator>();
  let weightedAttempted = 0;
  let weightedCorrect = 0;
  let answeredCount = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalIdk = 0;
  const missedQuestionIds: string[] = [];

  questions.forEach((question) => {
    const answer = answers[question.id];

    if (!topicMap.has(question.topic)) {
      topicMap.set(question.topic, {
        topic: question.topic,
        answered: 0,
        correct: 0,
        wrong: 0,
        idk: 0,
        weightedAttempted: 0,
        weightedCorrect: 0,
      });
    }

    if (!answer) {
      return;
    }

    answeredCount += 1;
    weightedAttempted += question.difficulty;

    const topicStats = topicMap.get(question.topic);

    if (!topicStats) {
      return;
    }

    topicStats.answered += 1;
    topicStats.weightedAttempted += question.difficulty;

    if (answer.isCorrect) {
      weightedCorrect += question.difficulty;
      totalCorrect += 1;
      topicStats.correct += 1;
      topicStats.weightedCorrect += question.difficulty;
      return;
    }

    missedQuestionIds.push(question.id);

    if (answer.answerType === "idk") {
      totalIdk += 1;
      topicStats.idk += 1;
      return;
    }

    totalWrong += 1;
    topicStats.wrong += 1;
  });

  const score =
    weightedAttempted > 0
      ? Math.round((weightedCorrect / weightedAttempted) * 100)
      : 0;

  const topicSubscores: TopicSubscore[] = [...topicMap.values()]
    .filter((item) => item.answered > 0)
    .map((item) => ({
      topic: item.topic,
      answered: item.answered,
      correct: item.correct,
      wrong: item.wrong,
      idk: item.idk,
      weightedCorrect: item.weightedCorrect,
      weightedAttempted: item.weightedAttempted,
      score:
        item.weightedAttempted > 0
          ? Math.round((item.weightedCorrect / item.weightedAttempted) * 100)
          : 0,
    }))
    .sort((left, right) => {
      if (left.score === right.score) {
        return (right.idk + right.wrong) - (left.idk + left.wrong);
      }

      return right.score - left.score;
    });

  const completionPercent =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const idkRate = answeredCount > 0 ? totalIdk / answeredCount : 0;

  return {
    score,
    answeredCount,
    totalCount: questions.length,
    completionPercent,
    confidence: confidenceFromCompletionAndIdk(completionPercent, idkRate),
    totalCorrect,
    totalWrong,
    totalIdk,
    idkRate,
    topicSubscores,
    missedQuestionIds,
  };
}

function baseBandFromScore(score: number): PlacementBand {
  if (score < 30) {
    return "A1.0";
  }
  if (score < 45) {
    return "A1.1";
  }
  if (score < 60) {
    return "A1.2";
  }
  if (score < 75) {
    return "A2.0";
  }
  if (score < 88) {
    return "A2.1";
  }
  return "B1-ish";
}

export function derivePlacementBand(summary: AssessmentScoreSummary): PlacementBand {
  let bandIndex = toBandIndex(baseBandFromScore(summary.score));

  const coreAverage = averageTopicScore(summary.topicSubscores, coreTopics);
  const advancedAverage = averageTopicScore(summary.topicSubscores, advancedTopics);

  if (coreAverage !== null && coreAverage < 45) {
    bandIndex = Math.min(bandIndex, toBandIndex("A1.1"));
  } else if (coreAverage !== null && coreAverage < 60) {
    bandIndex = Math.min(bandIndex, toBandIndex("A1.2"));
  }

  if (advancedAverage !== null && advancedAverage < 50) {
    bandIndex = Math.min(bandIndex, toBandIndex("A2.0"));
  }

  if (summary.confidence === "low") {
    bandIndex = Math.max(0, bandIndex - 1);
  }

  return orderedBands[bandIndex];
}

export function buildPlacementRecommendation(
  summary: AssessmentScoreSummary,
  recommendationMap: PlacementRecommendationMap
): PlacementRecommendation {
  const band = derivePlacementBand(summary);
  const moduleRecommendation = getRecommendationForBand(band, recommendationMap);

  const strengths = [...summary.topicSubscores]
    .sort((left, right) => {
      if (left.score === right.score) {
        return (left.idk + left.wrong) - (right.idk + right.wrong);
      }

      return right.score - left.score;
    })
    .slice(0, 3);

  const gaps = [...summary.topicSubscores]
    .sort((left, right) => {
      if (left.score === right.score) {
        return (right.idk + right.wrong) - (left.idk + left.wrong);
      }

      return left.score - right.score;
    })
    .slice(0, 3);

  return {
    band,
    moduleId: moduleRecommendation.moduleId,
    moduleTitle: moduleRecommendation.moduleTitle,
    confidence: summary.confidence,
    strengths,
    gaps,
    lessonLinks: moduleRecommendation.lessonLinks,
  };
}

export function shouldShowToneQuizCta(summary: AssessmentScoreSummary) {
  return summary.score >= 70;
}

/**
 * Simple correct-percentage over a subset of question IDs.
 * Used for adaptive branching at the quiz midpoint — not for final scoring.
 */
export function computeMidQuizScore(
  answers: Record<string, AssessmentAnswer>,
  questionIds: string[]
): number {
  let answered = 0;
  let correct = 0;

  for (const qId of questionIds) {
    const answer = answers[qId];
    if (!answer) continue;
    answered += 1;
    if (answer.isCorrect) correct += 1;
  }

  if (answered === 0) return 0;
  return Math.round((correct / answered) * 100);
}
