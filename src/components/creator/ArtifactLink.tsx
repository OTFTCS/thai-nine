"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/types/creator";

const iconStyles: Record<string, string> = {
  md: "bg-blue-100 text-blue-800 border-blue-200",
  json: "bg-amber-100 text-amber-800 border-amber-200",
  pptx: "bg-orange-100 text-orange-800 border-orange-200",
  pdf: "bg-red-100 text-red-800 border-red-200",
  py: "bg-green-100 text-green-800 border-green-200",
  mp4: "bg-purple-100 text-purple-800 border-purple-200",
  m4a: "bg-indigo-100 text-indigo-800 border-indigo-200",
  mov: "bg-indigo-100 text-indigo-800 border-indigo-200",
  dir: "bg-slate-100 text-slate-800 border-slate-200",
  img: "bg-pink-100 text-pink-800 border-pink-200",
  xlsx: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

interface Props {
  artifact?: Artifact | null;
  compact?: boolean;
}

async function openPath(path: string, reveal: boolean): Promise<void> {
  await fetch("/api/creator/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, reveal }),
  });
}

export function ArtifactLink({ artifact, compact }: Props) {
  const [busy, setBusy] = useState(false);

  if (!artifact) {
    return (
      <span className="inline-block w-8 text-center text-muted-foreground">
        —
      </span>
    );
  }

  if (!artifact.exists) {
    return (
      <span
        title={`${artifact.label} — not present`}
        className={cn(
          "inline-block rounded border border-dashed border-border/60 px-2 py-0.5 text-[10px] font-mono uppercase text-muted-foreground/60",
          compact && "px-1.5"
        )}
      >
        {artifact.icon}
      </span>
    );
  }

  const variant = iconStyles[artifact.icon] ?? iconStyles.dir;

  async function handleOpen(reveal: boolean) {
    if (!artifact || busy) return;
    setBusy(true);
    try {
      await openPath(artifact.path, reveal);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        title={`${artifact.label} — click to open`}
        onClick={() => handleOpen(false)}
        disabled={busy}
        className={cn(
          "inline-block rounded border px-2 py-0.5 text-[10px] font-mono uppercase transition-opacity hover:opacity-80",
          variant,
          compact && "px-1.5",
          busy && "opacity-40"
        )}
      >
        {artifact.icon}
      </button>
      <button
        type="button"
        title="Reveal in Finder"
        onClick={() => handleOpen(true)}
        disabled={busy}
        className="text-[10px] text-muted-foreground hover:text-foreground"
      >
        ⤢
      </button>
    </span>
  );
}

export function openArtifact(artifact: Artifact, reveal = false): void {
  if (!artifact.exists) return;
  void openPath(artifact.path, reveal);
}

export function FolderReveal({ path, label }: { path: string; label: string }) {
  return (
    <button
      type="button"
      title="Reveal folder in Finder"
      onClick={() => void openPath(path, true)}
      className="font-mono text-sm text-primary hover:underline"
    >
      {label}
    </button>
  );
}
