import { QuizRunner } from "@/components/quizzes/quiz-runner";
import { toneRecognitionQuestionBank } from "@/lib/quiz/question-banks";

export default function ToneQuizPage() {
  return (
    <QuizRunner
      quizKind="tones"
      title="Tone Recognition Quiz"
      description="Short advisory quiz focused on high-confusion tone minimal sets."
      questionBank={toneRecognitionQuestionBank}
      resultHref="/quiz/results"
      minimumAnswersForAdvisory={4}
    />
  );
}
