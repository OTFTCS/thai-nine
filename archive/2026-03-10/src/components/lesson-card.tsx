import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Lesson, UserLessonProgress } from "@/types/lesson";

interface LessonCardProps {
  lesson: Lesson;
  progress?: UserLessonProgress;
}

export function LessonCard({ lesson, progress }: LessonCardProps) {
  const status = progress?.status || "not_started";
  const badgeVariant =
    status === "completed"
      ? "completed"
      : status === "in_progress"
      ? "in_progress"
      : "new";

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="group block rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-md"
    >
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <span className="text-2xl font-semibold text-foreground/75">{lesson.id}</span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={badgeVariant}>
            {status === "completed"
              ? "Completed"
              : status === "in_progress"
              ? "In Progress"
              : "Coming Soon"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {lesson.moduleId} · {lesson.cefrBand}
          </span>
        </div>
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {lesson.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {lesson.primaryOutcome}
        </p>
      </div>
    </Link>
  );
}
