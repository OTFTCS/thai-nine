"use client";

import { cn } from "@/lib/utils";
import type { AnnotationRating } from "@/types/creator-eval";

interface Props {
  value: AnnotationRating | null;
  disabled?: boolean;
  onChange: (next: AnnotationRating | null) => void;
}

const OPTIONS: { value: AnnotationRating; label: string; activeClass: string }[] = [
  { value: "good", label: "good", activeClass: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  { value: "ok", label: "ok", activeClass: "bg-slate-200 text-slate-800 ring-slate-400" },
  { value: "rework", label: "rework", activeClass: "bg-amber-100 text-amber-900 ring-amber-400" },
];

export function EvalRatingStrip({ value, disabled, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? null : opt.value)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
              active
                ? cn(opt.activeClass, "ring-2")
                : "bg-muted/40 text-muted-foreground hover:bg-muted",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
