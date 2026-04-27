"use client";

import { useMemo, useState } from "react";
import { EvalBlockPanel } from "@/components/creator/EvalBlockPanel";
import { EvalOverallCard } from "@/components/creator/EvalOverallCard";
import type { EvalAnnotation, EvalReviewBlock } from "@/types/creator-eval";

interface Props {
  evalScriptId: string;
  blocks: EvalReviewBlock[];
  initialAnnotations: EvalAnnotation[];
}

type FilterMode = "all" | "rework" | "unrated";

export function EvalReviewBoard({ evalScriptId, blocks, initialAnnotations }: Props) {
  const [annotations, setAnnotations] = useState<EvalAnnotation[]>(initialAnnotations);
  const [filter, setFilter] = useState<FilterMode>("all");

  const overall = annotations.find((a) => a.scope === "overall") ?? null;
  const blockMap = useMemo(() => {
    const map = new Map<string, EvalAnnotation>();
    for (const a of annotations) if (a.scope === "block" && a.blockId) map.set(a.blockId, a);
    return map;
  }, [annotations]);

  function recordSaved(saved: EvalAnnotation) {
    setAnnotations((prev) => {
      const next = prev.filter((a) => a.id !== saved.id);
      next.push(saved);
      return next;
    });
  }

  const visibleBlocks = useMemo(() => {
    if (filter === "all") return blocks;
    if (filter === "rework") {
      return blocks.filter((b) => blockMap.get(b.id)?.rating === "rework");
    }
    return blocks.filter((b) => !blockMap.has(b.id));
  }, [blocks, blockMap, filter]);

  const counts = useMemo(() => {
    let good = 0;
    let ok = 0;
    let rework = 0;
    for (const a of annotations) {
      if (a.scope !== "block") continue;
      if (a.rating === "good") good++;
      else if (a.rating === "ok") ok++;
      else if (a.rating === "rework") rework++;
    }
    return { good, ok, rework, unrated: blocks.length - (good + ok + rework) };
  }, [annotations, blocks.length]);

  return (
    <div className="space-y-6">
      <EvalOverallCard
        evalScriptId={evalScriptId}
        initial={overall}
        onSaved={recordSaved}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          Sections
        </span>
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-emerald-800">
          good {counts.good}
        </span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-slate-700">
          ok {counts.ok}
        </span>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-900">
          rework {counts.rework}
        </span>
        <span className="rounded bg-muted/40 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-muted-foreground">
          unrated {counts.unrated}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          {(["all", "rework", "unrated"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={
                filter === mode
                  ? "rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                  : "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 hover:bg-blue-50"
              }
            >
              {mode}
            </button>
          ))}
        </span>
      </div>

      {visibleBlocks.length === 0 ? (
        <p className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          No sections match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleBlocks.map((b) => (
            <EvalBlockPanel
              key={b.id}
              evalScriptId={evalScriptId}
              block={b}
              initial={blockMap.get(b.id) ?? null}
              onSaved={recordSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
