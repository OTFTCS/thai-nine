import { QuizRunner } from "@/components/quizzes/quiz-runner";
import { readerToneQuestionBank } from "@/lib/quiz/question-banks";

export default function ReaderToneQuizPage() {
  return (
    <QuizRunner
      quizKind="reader_tones"
      title="Reader Tone + Script Discrimination Quiz"
      description="Advanced audio-to-script discrimination for Thai readers, using tighter confusable sets and less prompt scaffolding."
      questionBank={readerToneQuestionBank}
      defaultTrack="reader"
      resultHref="/quiz/results"
      minimumAnswersForAdvisory={6}
    />
  );
}
