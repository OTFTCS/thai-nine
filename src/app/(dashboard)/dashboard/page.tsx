import Link from "next/link";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";

export default async function DashboardPage() {
  const curriculum = await getBlueprintCurriculum();
  const lessons = curriculum.lessons;

  const mockProgress = [
    {
      lessonId: "M01-L001",
      status: "completed" as const,
      videoProgressSeconds: 720,
      completedAt: "2024-01-15",
    },
    {
      lessonId: "M01-L002",
      status: "in_progress" as const,
      videoProgressSeconds: 300,
    },
  ];

  const completedCount = mockProgress.filter(
    (p) => p.status === "completed"
  ).length;
  const progressPercent = (completedCount / lessons.length) * 100;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Your Lessons</h1>
        <p className="text-muted-foreground mt-1">
          Full blueprint module and lesson tree (all lessons currently coming soon)
        </p>

        <div className="mt-4 max-w-md">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>
              {completedCount} of {lessons.length} lessons completed
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <ProgressBar value={progressPercent} />
        </div>
      </div>

      <div className="space-y-4">
        {curriculum.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {module.id}: {module.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {module.trackTitle} ({module.cefrBand})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {module.lessons.map((lesson) => {
                  const progress = mockProgress.find((item) => item.lessonId === lesson.id);
                  const badgeVariant =
                    progress?.status === "completed"
                      ? "completed"
                      : progress?.status === "in_progress"
                      ? "in_progress"
                      : "new";
                  return (
                    <Link
                      key={lesson.id}
                      href={`/lessons/${lesson.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {lesson.id}: {lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {lesson.primaryOutcome}
                        </p>
                      </div>
                      <Badge variant={badgeVariant}>
                        {progress?.status === "completed"
                          ? "Completed"
                          : progress?.status === "in_progress"
                          ? "In Progress"
                          : "Coming Soon"}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
