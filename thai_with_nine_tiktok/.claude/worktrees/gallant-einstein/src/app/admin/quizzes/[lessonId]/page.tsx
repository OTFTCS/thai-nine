import { notFound } from "next/navigation";
import Link from "next/link";
import { mockLessons, mockQuizQuestions } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AdminQuizzesPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function AdminQuizzesPage({ params }: AdminQuizzesPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

  if (!lesson) {
    notFound();
  }

  const questions = mockQuizQuestions[lessonId] || [];

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/admin/lessons/${lessonId}/edit`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to {lesson.title}
      </Link>

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Quiz: {lesson.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button>+ Add Question</Button>
      </div>

      <div className="space-y-3">
        {questions.map((question, i) => (
          <Card key={question.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                    {question.questionText}
                  </p>
                  <div className="mt-2 space-y-1">
                    {question.options.map((option) => (
                      <p
                        key={option.id}
                        className={`text-sm ${
                          option.id === question.correctOptionId
                            ? "text-success font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {option.id.toUpperCase()}. {option.text}
                        {option.id === question.correctOptionId && " ✓"}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {questions.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No quiz questions yet. Add your first question to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
