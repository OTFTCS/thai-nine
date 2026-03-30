import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const previewLessons = [
  {
    title: "Thai Greetings & Introductions",
    description: "Learn essential Thai greetings and how to introduce yourself.",
    duration: "12 min",
    free: true,
  },
  {
    title: "Numbers & Counting",
    description: "Master Thai numbers 1-100 and use them in everyday situations.",
    duration: "15 min",
    free: true,
  },
  {
    title: "At the Restaurant",
    description: "Order food like a local with essential restaurant phrases.",
    duration: "18 min",
    free: false,
  },
];

export function CoursePreview() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground">
            Start with free lessons
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Try before you commit — the first two lessons are completely free
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {previewLessons.map((lesson, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-5xl">🇹🇭</span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={lesson.free ? "free" : "locked"}>
                    {lesson.free ? "Free" : "Premium"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {lesson.duration}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  {lesson.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lesson.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/signup">
            <Button size="lg">Start Learning Free</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
