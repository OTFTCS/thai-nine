import type { AssessmentQuizKind, LearnerTrack } from "@/types/assessment";

export function shouldShowLearnerTransliteration(
  quizKind: AssessmentQuizKind,
  track?: LearnerTrack
) {
  if (quizKind === "reader_tones") {
    return false;
  }

  if (track === "reader") {
    return false;
  }

  return true;
}
