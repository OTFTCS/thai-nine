"use client";

import { DiagnosticQuizRunner } from "@/components/quizzes/diagnostic-quiz-runner";
import { placementQuestionBank } from "@/lib/quiz/question-banks";
import {
  assemblePlacementQuestionIds,
  getPlacementTargetCount,
} from "@/lib/quiz/assembler";
import type { LearnerTrack } from "@/types/assessment";

interface Props {
  token: string;
  learnerName?: string;
}

export function DiagnosticQuizClient({ token, learnerName }: Props) {
  return (
    <DiagnosticQuizRunner
      token={token}
      learnerName={learnerName}
      questionBank={placementQuestionBank}
      resolveQuestionIds={(track: LearnerTrack) =>
        assemblePlacementQuestionIds({
          track,
          targetCount: getPlacementTargetCount(),
          seed: `diagnostic:${token}:${track}`,
        })
      }
    />
  );
}
