"use client";

import { cn } from "@/lib/utils";
import type { ThaiTriplet } from "@/types/assessment";

interface ThaiTripletDisplayProps {
  triplet: ThaiTriplet;
  /** Which parts to show based on display mode */
  showThai?: boolean;
  showTranslit?: boolean;
  showEnglish?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a Thai triplet (Thai script + transliteration + English).
 * Per repo policy, transliteration always includes inline PTM tone marks.
 */
export function ThaiTripletDisplay({
  triplet,
  showThai = true,
  showTranslit = true,
  showEnglish = true,
  size = "md",
  className,
}: ThaiTripletDisplayProps) {
  const thaiSize = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  const translitSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const englishSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {showThai && (
        <span
          className={cn(thaiSize, "font-semibold text-foreground")}
          lang="th"
          aria-label={`Thai: ${triplet.thai}`}
        >
          {triplet.thai}
        </span>
      )}
      {showTranslit && (
        <span
          className={cn(
            translitSize,
            "text-primary font-mono tracking-wide",
          )}
          aria-label={`Transliteration: ${triplet.translit}`}
        >
          {triplet.translit}
        </span>
      )}
      {showEnglish && (
        <span
          className={cn(englishSize, "text-muted-foreground")}
          aria-label={`English: ${triplet.english}`}
        >
          {triplet.english}
        </span>
      )}
    </div>
  );
}
