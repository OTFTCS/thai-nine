import { notFound } from "next/navigation";
import { mockLessons } from "@/lib/mock-data";
import { VideoPlayer } from "@/components/lessons/video-player";
import { LessonTranscript } from "@/components/lessons/lesson-transcript";
import { PdfDownload } from "@/components/lessons/pdf-download";
import { LessonNav } from "@/components/lessons/lesson-nav";
import { Badge } from "@/components/ui/badge";

interface LessonPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

  if (!lesson) {
    notFound();
  }

  const sortedLessons = mockLessons
    .filter((l) => l.isPublished)
    .sort((a, b) => a.sortOrder - b.sortOrder);
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
          <Badge variant={lesson.isFree ? "free" : "default"}>
            {lesson.isFree ? "Free" : "Premium"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Lesson {lesson.sortOrder}
          </span>
          {lesson.durationMinutes && (
            <span className="text-sm text-muted-foreground">
              &middot; {lesson.durationMinutes} min
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
        <p className="text-muted-foreground mt-1">{lesson.description}</p>
      </div>

      <div className="space-y-6">
        <VideoPlayer videoUrl={lesson.videoUrl} title={lesson.title} />
        <LessonTranscript transcript={lesson.transcript} />
        <PdfDownload pdfUrl={lesson.pdfUrl} lessonTitle={lesson.title} />
        <LessonNav
          currentLesson={lesson}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
        />
      </div>
    </div>
  );
}
