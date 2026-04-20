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
      <div className="flex gap-3">
        <div className="flex-1 p-4 rounded-lg border border-border bg-card text-center">
          <span className="text-2xl block mb-1">🗂️</span>
          <p className="text-sm font-medium text-foreground">Flashcards</p>
          <p className="text-xs text-muted-foreground">Coming soon for {currentLesson.id}</p>
        </div>
        <div className="flex-1 p-4 rounded-lg border border-border bg-card text-center">
          <span className="text-2xl block mb-1">✅</span>
          <p className="text-sm font-medium text-foreground">Lesson Quiz</p>
          <p className="text-xs text-muted-foreground">Coming soon for {currentLesson.id}</p>
        </div>
      </div>

      <div className="flex justify-between gap-4">
        {prevLesson ? (
          <Link href={`/lessons/${prevLesson.id}`}>
            <Button variant="outline" size="sm">
              &larr; {prevLesson.id}
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {nextLesson ? (
          <Link href={`/lessons/${nextLesson.id}`}>
            <Button variant="outline" size="sm">
              {nextLesson.id} &rarr;
            </Button>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
