import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";

export async function CoursePreview() {
  const curriculum = await getBlueprintCurriculum();
  const previewModules = curriculum.modules.slice(0, 3);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground">
            Full Curriculum Blueprint
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            {curriculum.modules.length} modules · {curriculum.lessons.length} lessons · all lesson pages live as placeholders
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {previewModules.map((module) => (
            <div
              key={module.id}
              className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-2xl font-semibold text-foreground/75">{module.id}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="new">
                    Coming Soon
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {module.lessons.length} lessons
                  </span>
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {module.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {module.lessons[0]?.id}: {module.lessons[0]?.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/dashboard">
            <Button size="lg">Browse Full Lesson Tree</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
