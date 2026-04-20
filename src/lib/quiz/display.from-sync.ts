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

/**
 * Audio quizzes should not always reveal the exact Thai target text.
 * For tone and reader-tone discrimination, hide the source Thai prompt
 * so learners must rely on listening + script discrimination.
 */
export function shouldShowAudioPromptThai(quizKind: AssessmentQuizKind) {
  if (quizKind === "tones" || quizKind === "reader_tones") {
    return false;
  }

  return true;
}
