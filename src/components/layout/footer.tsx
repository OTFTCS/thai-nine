import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🇹🇭</span>
              <span className="flex flex-col leading-tight">
                <span className="text-xl font-bold text-foreground">Immersion Thai</span>
                <span className="text-xs font-medium text-primary">with Nine</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              Learn Thai at your own pace with video lessons, flashcards, and
              quizzes. Created by Nine, a native Thai speaker passionate about
              teaching.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Learn</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Course
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Connect</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About Nine
                </Link>
              </li>
              <li>
                <a
                  href="https://tiktok.com/@thaiwith.nine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/thaiwith.nine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Immersion Thai. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
