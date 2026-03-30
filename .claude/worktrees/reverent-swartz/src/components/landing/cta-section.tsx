import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Ready to speak Thai?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Join thousands of learners who are building their Thai skills with
          Nine. Start with free lessons today.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="text-base px-8">
              Get Started Free
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg" className="text-base px-8">
              See Full Pricing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
