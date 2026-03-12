import { notFound, redirect } from "next/navigation";
import { LessonNav } from "@/components/lessons/lesson-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";
import { resolveLegacyLessonId } from "@/lib/curriculum/legacy-lesson-redirects";

interface LessonPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  const legacyRedirect = resolveLegacyLessonId(lessonId);
  if (legacyRedirect) {
    redirect(`/lessons/${legacyRedirect}`);
  }

  const curriculum = await getBlueprintCurriculum();
  const lesson = curriculum.lessonById[lessonId];

  if (!lesson) {
    notFound();
  }

  const sortedLessons = curriculum.lessons;
  const currentIndex = sortedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? sortedLessons[currentIndex - 1] : undefined;
  const nextLesson =
    currentIndex < sortedLessons.length - 1
      ? sortedLessons[currentIndex + 1]
      : undefined;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="new">Coming Soon</Badge>
          <span className="text-sm text-muted-foreground">
            {lesson.id} · {lesson.moduleId}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
        <p className="text-muted-foreground mt-1">
          {lesson.moduleTitle} · {lesson.trackTitle} ({lesson.cefrBand})
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Lesson Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Primary outcome:</span>{" "}
              {lesson.primaryOutcome}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Secondary outcome:</span>{" "}
              {lesson.secondaryOutcome}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Quiz focus:</span>{" "}
              {lesson.quizFocus}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Flashcard tags:</span>{" "}
              {lesson.flashcardTags.length > 0 ? lesson.flashcardTags.join(", ") : "None"}
            </p>
            {lesson.notes && (
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Notes:</span> {lesson.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              This lesson is currently a placeholder shell sourced from the blueprint. Lesson content,
              flashcards, and lesson quiz will be published in a future release.
            </p>
          </CardContent>
        </Card>

        <LessonNav
          currentLesson={lesson}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
        />
      </div>
    </div>
  );
}
