import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubscribeForm } from "@/components/links/subscribe-form";

export default function LinksPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      {/* Profile Header */}
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-2xl font-bold text-white shadow-md">
          N
        </div>
        <h1 className="text-2xl font-bold text-foreground">Nine</h1>
        <p className="mt-1 text-muted-foreground">
          Thai teacher helping you speak with confidence
        </p>
        <a
          href="https://instagram.com/thaiwith.nine"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm text-primary hover:underline"
        >
          @thaiwith.nine
        </a>
      </header>

      <div className="space-y-4">
        {/* Email Signup — Primary CTA */}
        <Suspense>
          <SubscribeForm />
        </Suspense>

        {/* Test Your Thai Level */}
        <Link href="/quiz" className="group block">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all group-hover:shadow-md">
            <h2 className="font-semibold text-foreground">
              What&apos;s your Thai level?
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              5-minute placement quiz. No signup needed.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Take the Quiz
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </Link>

        {/* Free Classifiers Cheat Sheet */}
        <a href="#cheat-sheet" className="group block">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all group-hover:shadow-md">
            <h2 className="font-semibold text-foreground">
              Thai Classifier Cheat Sheet
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              19 classifiers every learner needs. Free PDF.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Get It Free
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </a>

        {/* Book a Lesson */}
        <a
          href="https://calendly.com/thaiwith-nine"
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all group-hover:shadow-md">
            <h2 className="font-semibold text-foreground">
              Learn Thai 1-on-1 with Nine
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Private video lessons. Friendly, patient, fun.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Book a Lesson
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </a>
      </div>

      {/* Social Links */}
      <footer className="mt-10 text-center">
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://instagram.com/thaiwith.nine"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="Instagram"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a
            href="https://tiktok.com/@thaiwith.nine"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="TikTok"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.49a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.4a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.13a8.16 8.16 0 003.76.92V6.62c-.01.03-.01.05 0 .07z" />
            </svg>
          </a>
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>🇹🇭</span>
            <span className="text-sm font-medium">Immersion Thai</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            &copy; {new Date().getFullYear()} Immersion Thai
          </p>
        </div>
      </footer>
    </main>
  );
}
