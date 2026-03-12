import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";

export default async function AdminLessonsPage() {
  const curriculum = await getBlueprintCurriculum();
  const sortedLessons = curriculum.lessons;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Lessons</h1>
          <p className="text-muted-foreground mt-1">
            Blueprint curriculum listing with placeholder status
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedLessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-28">
                  {lesson.id}
                </span>
                <div>
                  <h3 className="font-medium text-foreground">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lesson.moduleTitle} · {lesson.trackTitle} ({lesson.cefrBand})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="new">Coming Soon</Badge>
                <Link href={`/admin/lessons/${lesson.id}/edit`}>
                  <span className="text-sm text-primary hover:text-primary-dark">
                    View
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
