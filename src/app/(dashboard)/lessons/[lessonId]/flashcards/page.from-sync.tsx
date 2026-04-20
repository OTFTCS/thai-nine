import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlueprintLessonById } from "@/lib/curriculum/blueprint-loader";
import { resolveLegacyLessonId } from "@/lib/curriculum/legacy-lesson-redirects";

interface FlashcardsPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function FlashcardsPage({ params }: FlashcardsPageProps) {
  const { lessonId } = await params;
  const legacyRedirect = resolveLegacyLessonId(lessonId);
  if (legacyRedirect) {
    redirect(`/lessons/${legacyRedirect}/flashcards`);
  }

  const lesson = await getBlueprintLessonById(lessonId);

  if (!lesson) {
    notFound();
  }

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
          Flashcards: {lesson.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lesson.id} · {lesson.moduleTitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flashcards Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lesson flashcards are disabled while this lesson remains in blueprint placeholder
            state.
          </p>
          <Link href={`/lessons/${lessonId}`}>
            <Button variant="outline">Back to Lesson</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
