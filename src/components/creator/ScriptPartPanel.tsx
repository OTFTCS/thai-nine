"use client";

import { useEffect, useState } from "react";
import type { Block, PartKey } from "@/lib/creator/youtube-script-parts";
import { formatPartPreview } from "@/lib/creator/youtube-teleprompter";

interface Props {
  partKey: PartKey;
  partLabel: string;
  blocks: Block[];
  onRegenerate: (instruction: string, reason: string) => Promise<void>;
  isRegenerating: boolean;
  disabled?: boolean;
  /**
   * Optional diff summary from the latest regeneration. When set, the panel
   * shows a small "Updated" badge that fades out after a few seconds.
   */
  lastRegenerationDiff?: { kept: string[]; added: string[]; removed: string[] } | null;
}

export function ScriptPartPanel({
  partKey,
  partLabel,
  blocks,
  onRegenerate,
  isRegenerating,
  disabled,
  lastRegenerationDiff,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showUpdatedBadge, setShowUpdatedBadge] = useState(false);

  // Show a transient "Updated" badge when a fresh diff arrives.
  useEffect(() => {
    if (!lastRegenerationDiff) return;
    setShowUpdatedBadge(true);
    const timer = window.setTimeout(() => setShowUpdatedBadge(false), 5000);
    return () => window.clearTimeout(timer);
  }, [lastRegenerationDiff]);

  const preview = formatPartPreview(blocks);
  const partKeyLabel = partKey.toUpperCase();

  const trimmedInstruction = instruction.trim();
  const trimmedReason = reason.trim();
  const cannotSubmit =
    isRegenerating ||
    disabled === true ||
    trimmedInstruction.length === 0 ||
    trimmedReason.length === 0;

  async function handleSubmit() {
    if (cannotSubmit) return;
    setError(null);
    try {
      await onRegenerate(trimmedInstruction, trimmedReason);
      // On success: clear inputs so the panel is ready for the next round.
      setInstruction("");
      setReason("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <details
      open
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <summary className="cursor-pointer list-none px-4 py-3 hover:bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            {partKeyLabel} - {partLabel} ({blocks.length} block
            {blocks.length === 1 ? "" : "s"})
          </span>
          <span className="flex items-center gap-2">
            {showUpdatedBadge && lastRegenerationDiff ? (
              <span
                className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800"
                title={`+${lastRegenerationDiff.added.length} / -${lastRegenerationDiff.removed.length} blocks`}
              >
                Updated
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              click to toggle
            </span>
          </span>
        </div>
      </summary>

      <div className="space-y-3 border-t border-border/60 px-4 py-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          <pre className="max-h-72 overflow-auto rounded border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap">
            {preview.trim().length === 0
              ? "(no blocks in this part)"
              : preview}
          </pre>
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Instruction
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="What should this part do differently?"
              rows={3}
              disabled={isRegenerating || disabled === true}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Reason
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you regenerating? (e.g. 'Hook felt slow')"
              rows={2}
              disabled={isRegenerating || disabled === true}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={cannotSubmit}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Regenerate this part
          </button>
          {isRegenerating ? (
            <span className="text-xs text-muted-foreground">
              Regenerating...
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
