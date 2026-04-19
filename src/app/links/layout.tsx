import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Nine — Learn Thai | ${SITE_NAME}`,
  description: "Free Thai lessons, placement quiz, and more from Nine at Immersion Thai.",
  openGraph: {
    title: "Nine — Learn Thai",
    description: "Free Thai lessons, placement quiz, and more from Nine.",
    type: "website",
    url: `${SITE_URL}/links`,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: "Nine — Learn Thai",
    description: "Free Thai lessons, placement quiz, and more from Nine.",
  },
};

const lightVars: React.CSSProperties = {
  colorScheme: "light",
  // Override dark-mode CSS variables with light values
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

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background" style={lightVars}>
      {children}
    </div>
  );
}
