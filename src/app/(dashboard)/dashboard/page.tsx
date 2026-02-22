import { mockLessons } from "@/lib/mock-data";
import { LessonGrid } from "@/components/lessons/lesson-grid";
import { ProgressBar } from "@/components/ui/progress-bar";

export default function DashboardPage() {
  // Mock: user is on free tier, has completed lesson 1
  const mockProgress = [
    {
      lessonId: "lesson-1",
      status: "completed" as const,
      videoProgressSeconds: 720,
      completedAt: "2024-01-15",
    },
    {
      lessonId: "lesson-2",
      status: "in_progress" as const,
      videoProgressSeconds: 300,
    },
  ];

  const publishedLessons = mockLessons.filter((l) => l.isPublished);
  const completedCount = mockProgress.filter(
    (p) => p.status === "completed"
  ).length;
  const progressPercent = (completedCount / publishedLessons.length) * 100;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Your Lessons</h1>
        <p className="text-muted-foreground mt-1">
          Pick up where you left off or start a new lesson
        </p>

        <div className="mt-4 max-w-md">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>
              {completedCount} of {publishedLessons.length} lessons completed
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <ProgressBar value={progressPercent} />
        </div>
      </div>

      <LessonGrid
        lessons={publishedLessons}
        progress={mockProgress}
        userHasAccess={false}
      />
    </div>
  );
}
