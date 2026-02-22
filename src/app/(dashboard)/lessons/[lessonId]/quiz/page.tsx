import { notFound } from "next/navigation";
import Link from "next/link";
import { mockLessons, mockQuizzes, mockQuizQuestions } from "@/lib/mock-data";
import { QuizContainer } from "@/components/quizzes/quiz-container";
import { Button } from "@/components/ui/button";

interface QuizPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

  if (!lesson) {
    notFound();
  }

  const quiz = mockQuizzes[lessonId];
  const questions = mockQuizQuestions[lessonId] || [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/lessons/${lessonId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to {lesson.title}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">
          Quiz: {lesson.title}
        </h1>
        {quiz && (
          <p className="text-muted-foreground mt-1">
            {questions.length} question{questions.length !== 1 ? "s" : ""} &middot;
            {" "}{quiz.passingScore}% to pass
          </p>
        )}
      </div>

      {questions.length > 0 && quiz ? (
        <QuizContainer
          questions={questions}
          passingScore={quiz.passingScore}
          lessonId={lessonId}
        />
      ) : (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-muted-foreground mb-4">
            No quiz available for this lesson yet.
          </p>
          <Link href={`/lessons/${lessonId}`}>
            <Button variant="outline">Back to Lesson</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
