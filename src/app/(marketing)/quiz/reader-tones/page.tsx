import { QuizRunner } from "@/components/quizzes/quiz-runner";
import { readerToneQuestionBank } from "@/lib/quiz/question-banks";

export default function ReaderToneQuizPage() {
  return (
    <QuizRunner
      quizKind="reader_tones"
      title="Reader Tone + Script Discrimination Quiz"
      description="Audio-to-script discrimination with confusable Thai spellings and tones."
      questionBank={readerToneQuestionBank}
      defaultTrack="reader"
      resultHref="/quiz/results"
      minimumAnswersForAdvisory={4}
    />
  );
}
