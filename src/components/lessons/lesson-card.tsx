import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lesson, UserLessonProgress } from "@/types/lesson";

interface LessonCardProps {
  lesson: Lesson;
  progress?: UserLessonProgress;
  userHasAccess: boolean;
}

export function LessonCard({ lesson, progress, userHasAccess }: LessonCardProps) {
  const isLocked = !lesson.isFree && !userHasAccess;
  const status = progress?.status || "not_started";

  const badgeVariant = isLocked
    ? "locked"
    : lesson.isFree
    ? "free"
    : status === "completed"
    ? "completed"
    : status === "in_progress"
    ? "in_progress"
    : "default";

  const badgeText = isLocked
    ? "Premium"
    : lesson.isFree
    ? "Free"
    : status === "completed"
    ? "Completed"
    : status === "in_progress"
    ? "In Progress"
    : "Premium";

  return (
    <Link
      href={isLocked ? "/pricing" : `/lessons/${lesson.id}`}
      className={cn(
        "group block rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-md",
        isLocked && "opacity-75"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <span className="text-5xl group-hover:scale-110 transition-transform">
          🇹🇭
        </span>
        {isLocked && (
          <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
            <div className="text-white text-center">
              <span className="text-3xl">🔒</span>
              <p className="text-sm mt-1 font-medium">Upgrade to unlock</p>
            </div>
          </div>
        )}
        {lesson.durationMinutes && (
          <span className="absolute bottom-2 right-2 bg-foreground/80 text-background text-xs px-2 py-0.5 rounded">
            {lesson.durationMinutes} min
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={badgeVariant}>{badgeText}</Badge>
          <span className="text-xs text-muted-foreground">
            Lesson {lesson.sortOrder}
          </span>
        </div>
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {lesson.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {lesson.description}
        </p>
      </div>
    </Link>
  );
}
