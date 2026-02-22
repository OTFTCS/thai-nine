import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Lesson } from "@/types/lesson";

interface LessonNavProps {
  currentLesson: Lesson;
  prevLesson?: Lesson;
  nextLesson?: Lesson;
}

export function LessonNav({ currentLesson, prevLesson, nextLesson }: LessonNavProps) {
  return (
    <div className="space-y-4">
      {/* Flashcards & Quiz links */}
      <div className="flex gap-3">
        <Link href={`/lessons/${currentLesson.id}/flashcards`} className="flex-1">
          <div className="p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-center">
            <span className="text-2xl block mb-1">🗂️</span>
            <p className="text-sm font-medium text-foreground">Flashcards</p>
            <p className="text-xs text-muted-foreground">Practice vocabulary</p>
          </div>
        </Link>
        <Link href={`/lessons/${currentLesson.id}/quiz`} className="flex-1">
          <div className="p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-center">
            <span className="text-2xl block mb-1">✅</span>
            <p className="text-sm font-medium text-foreground">Quiz</p>
            <p className="text-xs text-muted-foreground">Test your knowledge</p>
          </div>
        </Link>
      </div>

      {/* Prev/Next navigation */}
      <div className="flex justify-between gap-4">
        {prevLesson ? (
          <Link href={`/lessons/${prevLesson.id}`}>
            <Button variant="outline" size="sm">
              &larr; {prevLesson.title}
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {nextLesson ? (
          <Link href={`/lessons/${nextLesson.id}`}>
            <Button variant="outline" size="sm">
              {nextLesson.title} &rarr;
            </Button>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
