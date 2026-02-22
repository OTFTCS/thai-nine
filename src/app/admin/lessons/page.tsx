import Link from "next/link";
import { mockLessons } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminLessonsPage() {
  const sortedLessons = [...mockLessons].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Lessons</h1>
          <p className="text-muted-foreground mt-1">
            Create, edit, and organize your course lessons
          </p>
        </div>
        <Link href="/admin/lessons/new">
          <Button>+ New Lesson</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {sortedLessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <span className="text-lg font-mono text-muted-foreground w-8">
                  {lesson.sortOrder}
                </span>
                <div>
                  <h3 className="font-medium text-foreground">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lesson.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={lesson.isFree ? "free" : "default"}>
                  {lesson.isFree ? "Free" : "Premium"}
                </Badge>
                <Badge
                  variant={lesson.isPublished ? "completed" : "locked"}
                >
                  {lesson.isPublished ? "Published" : "Draft"}
                </Badge>
                {lesson.durationMinutes && (
                  <span className="text-xs text-muted-foreground">
                    {lesson.durationMinutes} min
                  </span>
                )}
                <Link href={`/admin/lessons/${lesson.id}/edit`}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
