"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScriptPartPanel } from "@/components/creator/ScriptPartPanel";
import { StatusSelect } from "@/components/creator/StatusSelect";
import {
  PART_LABELS,
  type Block,
  type PartKey,
} from "@/lib/creator/youtube-script-parts";
import type { ScriptStatus } from "@/types/creator";

interface CataloguePayload {
  episodeId: string;
  topic: string | null;
  level: string | null;
  lessonRef: string | null;
  titleBucket: string | null;
  status: string | null;
}

interface StatusPayload {
  episodeId: string;
  scriptStatus: ScriptStatus;
  updatedAt: string;
  lastError: string | null;
}

interface ScriptParts {
  p1: Block[];
  p2: Block[];
  p3: Block[];
  p4: Block[];
}

interface ScriptPayload {
  episodeId: string;
  catalogue: CataloguePayload | null;
  status: StatusPayload | null;
  hasScript: boolean;
  parts: ScriptParts | null;
  script: { episodeId?: string; topic?: string; title?: string } | null;
}

interface BlockDiff {
  kept: string[];
  added: string[];
  removed: string[];
}

interface RegenerateSuccess {
  ok: true;
  scriptPath: string;
  snapshotPath: string;
  diff: BlockDiff;
}

interface ApiFailure {
  ok: false;
  reason?: string;
  message?: string;
  error?: string;
  details?: unknown;
}

const PART_KEYS: PartKey[] = ["p1", "p2", "p3", "p4"];

function describeFailure(payload: ApiFailure): string {
  if (payload.reason === "claude-cli-missing") {
    return "Claude CLI not installed (you must be on Nine's Mac with `claude` in PATH).";
  }
  if (payload.reason === "unsupported-platform") {
    return "This server cannot run script generation (claude CLI is Mac-only).";
  }
  if (payload.reason === "in-flight") {
    return "Generation already in flight.";
  }
  return (
    payload.message ?? payload.error ?? "Unknown error from server."
  );
}

async function parseFailure(res: Response): Promise<string> {
  let body: ApiFailure | null = null;
  try {
    body = (await res.json()) as ApiFailure;
  } catch {
    body = null;
  }
  if (!body) return `HTTP ${res.status}`;
  return describeFailure(body);
}

interface PageProps {
  params: Promise<{ episodeId: string }>;
}

export default function EpisodeDetailPage({ params }: PageProps) {
  const { episodeId } = use(params);

  const [payload, setPayload] = useState<ScriptPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<Record<PartKey, string | null>>(
    { p1: null, p2: null, p3: null, p4: null }
  );
  const [diffByPart, setDiffByPart] = useState<
    Record<PartKey, BlockDiff | null>
  >({ p1: null, p2: null, p3: null, p4: null });

  const [isWorking, setIsWorking] = useState(false);
  const [activePart, setActivePart] = useState<PartKey | null>(null);
  const [generating, setGenerating] = useState(false);

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryBody, setMemoryBody] = useState("");
  const [memoryFetched, setMemoryFetched] = useState<string | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const fetchScript = useCallback(async () => {
    const res = await fetch(
      `/api/creator/youtube/script?episodeId=${encodeURIComponent(episodeId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const msg = await parseFailure(res);
      throw new Error(msg);
    }
    const json = (await res.json()) as ScriptPayload;
    setPayload(json);
  }, [episodeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchScript();
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchScript]);

  async function handleGenerate() {
    if (isWorking) return;
    setIsWorking(true);
    setGenerating(true);
    setGenerateError(null);
    setActionError(null);
    try {
      const res = await fetch(
        "/api/creator/youtube/script/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId }),
        }
      );
      if (!res.ok) {
        const msg = await parseFailure(res);
        throw new Error(msg);
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "generate failed");
      }
      await fetchScript();
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
      setIsWorking(false);
    }
  }

  async function handleRegenerate(
    partKey: PartKey,
    instruction: string,
    reason: string
  ) {
    if (isWorking) {
      throw new Error(
        "Another script operation is already running for this page."
      );
    }
    setIsWorking(true);
    setActivePart(partKey);
    setRegenError((prev) => ({ ...prev, [partKey]: null }));
    setActionError(null);
    try {
      const res = await fetch(
        "/api/creator/youtube/script/regenerate-part",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId,
            partKey,
            instruction,
            reason,
          }),
        }
      );
      if (!res.ok) {
        const msg = await parseFailure(res);
        throw new Error(msg);
      }
      const data = (await res.json()) as RegenerateSuccess | ApiFailure;
      if (data.ok === false) {
        throw new Error(describeFailure(data));
      }
      setDiffByPart((prev) => ({ ...prev, [partKey]: data.diff }));
      await fetchScript();
    } catch (err) {
      const msg = (err as Error).message;
      setRegenError((prev) => ({ ...prev, [partKey]: msg }));
      // Re-throw so the panel knows to surface its own banner too.
      throw err;
    } finally {
      setIsWorking(false);
      setActivePart(null);
    }
  }

  async function handleCopyTeleprompter() {
    if (!payload || !payload.hasScript) return;
    const status = payload.status?.scriptStatus ?? "NOT_STARTED";
    if (status !== "APPROVED" && status !== "RECORDED") return;
    setActionError(null);
    setCopyStatus(null);
    try {
      const res = await fetch(
        `/api/creator/youtube/script/teleprompter?episodeId=${encodeURIComponent(
          episodeId
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const msg = await parseFailure(res);
        throw new Error(msg);
      }
      const data = (await res.json()) as { body?: string };
      const text = data.body ?? "";
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied!");
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function openMemoryDrawer() {
    if (memoryOpen) {
      // Toggle close.
      setMemoryOpen(false);
      return;
    }
    setMemoryOpen(true);
    setMemoryError(null);
    setMemoryStatus(null);
    setMemoryLoading(true);
    try {
      const res = await fetch("/api/creator/youtube/script/memory", {
        cache: "no-store",
      });
      if (!res.ok) {
        const msg = await parseFailure(res);
        throw new Error(msg);
      }
      const data = (await res.json()) as { body?: string };
      const body = data.body ?? "";
      setMemoryBody(body);
      setMemoryFetched(body);
    } catch (err) {
      setMemoryError((err as Error).message);
    } finally {
      setMemoryLoading(false);
    }
  }

  async function handleMemorySave() {
    setMemorySaving(true);
    setMemoryError(null);
    setMemoryStatus(null);
    try {
      const res = await fetch("/api/creator/youtube/script/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: memoryBody }),
      });
      if (!res.ok) {
        const msg = await parseFailure(res);
        throw new Error(msg);
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "save failed");
      }
      setMemoryFetched(memoryBody);
      setMemoryStatus("Saved");
      window.setTimeout(() => setMemoryStatus(null), 2500);
    } catch (err) {
      setMemoryError((err as Error).message);
    } finally {
      setMemorySaving(false);
    }
  }

  function handleMemoryDiscard() {
    if (memoryFetched === null) return;
    setMemoryBody(memoryFetched);
    setMemoryStatus("Discarded");
    window.setTimeout(() => setMemoryStatus(null), 2000);
  }

  const scriptStatus: ScriptStatus =
    payload?.status?.scriptStatus ?? "NOT_STARTED";
  const canCopyTeleprompter =
    payload?.hasScript === true &&
    (scriptStatus === "APPROVED" || scriptStatus === "RECORDED");

  if (loading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardHeader>
            <CardTitle>Could not load episode</CardTitle>
            <CardDescription>
              {loadError ?? "Unknown error."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const catalogue = payload.catalogue;
  const headerSubtitle = (() => {
    const topic = catalogue?.topic ?? "(no catalogue topic)";
    const level = catalogue?.level ? ` (${catalogue.level})` : "";
    return `${topic}${level}`;
  })();

  return (
    <div className="space-y-4">
      <BackLink />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                {payload.episodeId}: {headerSubtitle}
              </CardTitle>
              <CardDescription>
                Status, generation, and per-part regeneration controls.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Script status
              </span>
              <StatusSelect
                kind="scriptStatus"
                id={payload.episodeId}
                status={scriptStatus}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isWorking || payload.hasScript}
              title={
                payload.hasScript
                  ? "A script already exists for this episode. Use per-part regenerate instead."
                  : "Generate a fresh draft script with Claude."
              }
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate full script"}
            </button>

            <button
              type="button"
              onClick={() => void handleCopyTeleprompter()}
              disabled={!canCopyTeleprompter}
              title={
                canCopyTeleprompter
                  ? "Copy the formatted teleprompter to your clipboard."
                  : "Available once script status is APPROVED or RECORDED."
              }
              className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy to teleprompter
            </button>

            <button
              type="button"
              onClick={() => void openMemoryDrawer()}
              className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/30"
            >
              {memoryOpen ? "Hide writer memory" : "Show writer memory"}
            </button>

            {copyStatus ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                {copyStatus}
              </span>
            ) : null}
          </div>

          {generateError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {generateError}
            </p>
          ) : null}
          {actionError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {actionError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
          <CardDescription>
            From <code>youtube/episode-catalogue.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <MetaRow label="Topic" value={catalogue?.topic} />
            <MetaRow label="Level" value={catalogue?.level} />
            <MetaRow label="Lesson ref" value={catalogue?.lessonRef} />
            <MetaRow label="Title bucket" value={catalogue?.titleBucket} />
          </dl>
        </CardContent>
      </Card>

      {payload.hasScript && payload.parts ? (
        <div className="space-y-3">
          {PART_KEYS.map((pk) => {
            const blocks = payload.parts ? payload.parts[pk] : [];
            const err = regenError[pk];
            return (
              <div key={pk} className="space-y-1">
                <ScriptPartPanel
                  partKey={pk}
                  partLabel={PART_LABELS[pk]}
                  blocks={blocks}
                  isRegenerating={isWorking && activePart === pk}
                  disabled={isWorking && activePart !== pk}
                  lastRegenerationDiff={diffByPart[pk] ?? null}
                  onRegenerate={(instruction, reason) =>
                    handleRegenerate(pk, instruction, reason)
                  }
                />
                {err ? (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {err}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No script yet</CardTitle>
            <CardDescription>
              Click Generate to draft one with Claude.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {memoryOpen ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Writer memory</CardTitle>
                <CardDescription>
                  Notes that get spliced into every script-writing prompt.
                </CardDescription>
              </div>
              {memoryStatus ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                  {memoryStatus}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {memoryLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading memory...
              </p>
            ) : (
              <textarea
                value={memoryBody}
                onChange={(e) => setMemoryBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleMemorySave()}
                disabled={memorySaving || memoryLoading}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {memorySaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleMemoryDiscard}
                disabled={
                  memorySaving ||
                  memoryLoading ||
                  memoryFetched === null ||
                  memoryFetched === memoryBody
                }
                className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard
              </button>
            </div>

            {memoryError ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {memoryError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/creator/youtube"
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      &larr; Back to YouTube list
    </Link>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value && value.length > 0 ? value : "-"}</dd>
    </div>
  );
}
