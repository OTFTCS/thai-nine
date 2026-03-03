"use client";

import { QuizRunner } from "@/components/quizzes/quiz-runner";
import { placementQuestionBank } from "@/lib/quiz/question-banks";
import {
  assemblePlacementQuestionIds,
  getPlacementTargetCount,
} from "@/lib/quiz/assembler";

export function PlacementQuiz() {
  return (
    <QuizRunner
      quizKind="placement"
      title="Placement Quiz"
      description="Universal placement assessment (reader/non-reader branching) designed for a sub-10 minute run. Progress auto-saves so you can resume any time."
      questionBank={placementQuestionBank}
      requireTrackSelection
      resolveQuestionIds={(track) =>
        assemblePlacementQuestionIds({
          track: track || "non_reader",
          targetCount: getPlacementTargetCount(),
          seed: `${track || "non_reader"}:${Date.now()}`,
        })
      }
      resultHref="/quiz/results"
      minimumAnswersForAdvisory={6}
    />
  );
}
