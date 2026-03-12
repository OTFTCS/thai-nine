import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBlueprintLessonById } from "@/lib/curriculum/blueprint-loader";

interface AdminQuizzesPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function AdminQuizzesPage({ params }: AdminQuizzesPageProps) {
  const { lessonId } = await params;
  const lesson = await getBlueprintLessonById(lessonId);

  if (!lesson) {
    notFound();
  }

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
            {lesson.id} · {lesson.moduleTitle}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lesson quiz authoring is disabled for blueprint placeholder lessons.
          </p>
          <Link href={`/admin/lessons/${lessonId}/edit`}>
            <Button variant="outline">Back to Lesson</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
