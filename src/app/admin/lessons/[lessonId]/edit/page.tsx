import { notFound } from "next/navigation";
import Link from "next/link";
import { mockLessons } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EditLessonPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function EditLessonPage({ params }: EditLessonPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

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
        Edit: {lesson.title}
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Title
                </label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm"
                  defaultValue={lesson.title}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm min-h-[80px]"
                  defaultValue={lesson.description}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Video URL
                </label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm"
                  defaultValue={lesson.videoUrl || ""}
                  placeholder="https://vimeo.com/..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Transcript
                </label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm min-h-[200px] font-mono"
                  defaultValue={lesson.transcript || ""}
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    defaultChecked={lesson.isFree}
                  />
                  Free lesson
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    defaultChecked={lesson.isPublished}
                  />
                  Published
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button">Save Changes</Button>
                <Link href="/admin/lessons">
                  <Button variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Quick links to manage flashcards and quizzes */}
        <div className="grid grid-cols-2 gap-4">
          <Link href={`/admin/flashcards/${lessonId}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6 text-center">
                <span className="text-3xl block mb-2">🗂️</span>
                <p className="font-medium text-foreground">Manage Flashcards</p>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/admin/quizzes/${lessonId}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6 text-center">
                <span className="text-3xl block mb-2">✅</span>
                <p className="font-medium text-foreground">Manage Quiz</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
