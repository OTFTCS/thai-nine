"use client";

import { useEffect, useRef, useState } from "react";
import { EvalRatingStrip } from "@/components/creator/EvalRatingStrip";
import type { AnnotationRating, EvalAnnotation } from "@/types/creator-eval";

interface Props {
  evalScriptId: string;
  initial: EvalAnnotation | null;
  onSaved: (annotation: EvalAnnotation) => void;
}

export function EvalOverallCard({ evalScriptId, initial, onSaved }: Props) {
  const [rating, setRating] = useState<AnnotationRating | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(false), 2500);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

  async function save(nextRating: AnnotationRating | null, nextComment: string) {
    if (nextRating === null) {
      if (!initial) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/creator/eval/annotations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotationId: initial.id }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `HTTP ${res.status}`);
        }
        setRating(null);
        setComment("");
        setUpdatedAt(null);
        setSavedFlash(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/eval/annotations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evalScriptId,
          scope: "overall",
          blockId: null,
          blockLabel: null,
          rating: nextRating,
          comment: nextComment,
          expectedUpdatedAt: updatedAt,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as { ok: true; annotation: EvalAnnotation };
      setUpdatedAt(payload.annotation.updatedAt);
      setSavedFlash(true);
      dirtyRef.current = false;
      onSaved(payload.annotation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Overall impression
        </h2>
        {savedFlash ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
            Saved
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <EvalRatingStrip
          value={rating}
          disabled={saving}
          onChange={(next) => {
            dirtyRef.current = true;
            setRating(next);
            void save(next, comment);
          }}
        />
        {saving ? <span className="text-xs text-muted-foreground">saving...</span> : null}
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Comment
        </span>
        <textarea
          value={comment}
          onChange={(e) => {
            dirtyRef.current = true;
            setComment(e.target.value);
          }}
          onBlur={() => {
            if (dirtyRef.current && rating !== null) {
              void save(rating, comment);
            }
          }}
          placeholder="What's your overall reaction to this script?"
          rows={2}
          disabled={saving}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
        />
      </label>

      {error ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
