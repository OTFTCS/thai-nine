import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            Learn Thai at your own pace
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
            Speak Thai with{" "}
            <span className="text-primary">confidence</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Video lessons, interactive flashcards, and quizzes designed by a
            native Thai speaker. Start with free lessons and unlock the full
            course when you&apos;re ready.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-base px-8">
                Start Learning Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="text-base px-8">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required. 2 free lessons to get started.
          </p>
        </div>

        {/* Decorative Thai script */}
        <div className="mt-16 text-6xl sm:text-8xl font-bold text-primary/10 select-none" aria-hidden>
          สวัสดี
        </div>
      </div>
    </section>
  );
}
