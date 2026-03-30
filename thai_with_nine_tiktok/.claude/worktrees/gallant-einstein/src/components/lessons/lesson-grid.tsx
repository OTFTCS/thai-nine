import { Lesson, UserLessonProgress } from "@/types/lesson";
import { LessonCard } from "./lesson-card";

interface LessonGridProps {
  lessons: Lesson[];
  progress: UserLessonProgress[];
  userHasAccess: boolean;
}

export function LessonGrid({ lessons, progress, userHasAccess }: LessonGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          progress={progress.find((p) => p.lessonId === lesson.id)}
          userHasAccess={userHasAccess}
        />
      ))}
    </div>
  );
}
