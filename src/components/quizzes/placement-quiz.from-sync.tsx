"use client";

import { QuizRunner } from "@/components/quizzes/quiz-runner";
import { placementQuestionBank } from "@/lib/quiz/question-banks";
import {
  assemblePlacementPhase1Ids,
  assemblePlacementPhase2Ids,
  getPlacementMidpoint,
} from "@/lib/quiz/assembler";
import { computeMidQuizScore } from "@/lib/quiz/scoring";
import type { AssessmentAttempt } from "@/types/assessment";

export function PlacementQuiz() {
  return (
    <QuizRunner
      quizKind="placement"
      title="Placement Quiz"
      description="Universal placement assessment (reader/non-reader branching) designed for a sub-10 minute run. Progress auto-saves so you can resume any time."
      questionBank={placementQuestionBank}
      requireTrackSelection
      resolveQuestionIds={(track) =>
        assemblePlacementPhase1Ids(
          track || "non_reader",
          `${track || "non_reader"}:${Date.now()}`
        )
      }
      midpointIndex={getPlacementMidpoint()}
      onMidpointReached={(attempt: AssessmentAttempt) => {
        const phase1Score = computeMidQuizScore(
          attempt.answers,
          attempt.questionIds
        );
        const phase2Ids = assemblePlacementPhase2Ids({
          track: attempt.track || "non_reader",
          phase1Score,
          alreadyUsedIds: new Set(attempt.questionIds),
          seed: `${attempt.attemptId}:phase2:${phase1Score}`,
        });
        return { additionalQuestionIds: phase2Ids };
      }}
      resultHref="/quiz/results"
      minimumAnswersForAdvisory={6}
    />
  );
}
