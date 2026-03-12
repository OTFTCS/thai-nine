import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBlueprintLessonById } from "@/lib/curriculum/blueprint-loader";

interface EditLessonPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function EditLessonPage({ params }: EditLessonPageProps) {
  const { lessonId } = await params;
  const lesson = await getBlueprintLessonById(lessonId);

  if (!lesson) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/admin/lessons"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Lessons
      </Link>

      <h1 className="text-3xl font-bold text-foreground mt-4 mb-8">
        {lesson.id}: {lesson.title}
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Blueprint Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="new">Coming Soon</Badge>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Module:</span> {lesson.moduleId} · {lesson.moduleTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Track / CEFR:</span> {lesson.trackTitle} ({lesson.cefrBand})
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Primary outcome:</span> {lesson.primaryOutcome}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Secondary outcome:</span> {lesson.secondaryOutcome}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Quiz focus:</span> {lesson.quizFocus}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Flashcard tags:</span>{" "}
              {lesson.flashcardTags.length > 0 ? lesson.flashcardTags.join(", ") : "None"}
            </p>
            <p className="text-sm text-muted-foreground">
              Blueprint fields are read-only. Lesson assets are not authored yet.
            </p>
            <div className="pt-2">
              <Link href="/admin/lessons">
                <Button variant="outline">Back to Lesson List</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Link href={`/admin/flashcards/${lessonId}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6 text-center">
                <span className="text-3xl block mb-2">🗂️</span>
                <p className="font-medium text-foreground">Flashcards Placeholder</p>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/admin/quizzes/${lessonId}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6 text-center">
                <span className="text-3xl block mb-2">✅</span>
                <p className="font-medium text-foreground">Quiz Placeholder</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
