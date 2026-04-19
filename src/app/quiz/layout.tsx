import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Thai Level Quiz | ${SITE_NAME}`,
  description: "Find out your Thai level in 5 minutes. Free placement quiz by Nine at Immersion Thai.",
};

const lightVars: React.CSSProperties = {
  colorScheme: "light",
  ["--background" as string]: "#faf9f7",
  ["--foreground" as string]: "#2c1810",
  ["--primary" as string]: "#5b9bd5",
  ["--primary-dark" as string]: "#3a7bbf",
  ["--primary-light" as string]: "#d0e4f7",
  ["--secondary" as string]: "#5c3d2e",
  ["--secondary-dark" as string]: "#3e2518",
  ["--secondary-light" as string]: "#8b6b5a",
  ["--accent" as string]: "#e85d4a",
  ["--muted" as string]: "#f0ede8",
  ["--muted-foreground" as string]: "#6b7280",
  ["--border" as string]: "#e0dbd4",
  ["--card" as string]: "#ffffff",
  ["--card-foreground" as string]: "#2c1810",
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" style={lightVars}>
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <Link href="/links" className="inline-flex items-center gap-2">
            <span className="text-xl">🇹🇭</span>
            <span className="text-sm font-medium text-foreground">Immersion Thai</span>
            <span className="text-xs text-primary">with Nine</span>
          </Link>
        </div>
      </nav>
      <main className="px-4">{children}</main>
    </div>
  );
}
