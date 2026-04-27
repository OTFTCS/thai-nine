"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArtifactSpreadsheet,
  type ColumnSpec,
} from "@/components/creator/ArtifactSpreadsheet";
import { StatusSelect } from "@/components/creator/StatusSelect";
import { FolderReveal } from "@/components/creator/ArtifactLink";
import type { YouTubeRow } from "@/types/creator";

interface ApiFailure {
  ok?: false;
  reason?: string;
  message?: string;
  error?: string;
}

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
  return payload.message ?? payload.error ?? "Unknown error from server.";
}

export default function YouTubePage() {
  const router = useRouter();
  const [rows, setRows] = useState<YouTubeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async (endpoint: string) => {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { rows: YouTubeRow[] };
    setRows(json.rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load("/api/creator/youtube");
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await load("/api/creator/youtube/sync");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  function applyLocalStatus(id: string, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const nextNotStarted = useMemo(
    () => rows.find((r) => r.meta.scriptStatus === "NOT_STARTED") ?? null,
    [rows]
  );

  async function handleGenerateNext() {
    if (!nextNotStarted || generatingNext) return;
    setGeneratingNext(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/creator/youtube/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: nextNotStarted.id }),
      });
      if (!res.ok) {
        let payload: ApiFailure | null = null;
        try {
          payload = (await res.json()) as ApiFailure;
        } catch {
          payload = null;
        }
        throw new Error(
          payload ? describeFailure(payload) : `HTTP ${res.status}`
        );
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok === false) {
        throw new Error(data.error ?? "generate failed");
      }
      router.push(`/admin/creator/youtube/${nextNotStarted.id}`);
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGeneratingNext(false);
    }
  }

  const columns: ColumnSpec<YouTubeRow>[] = [
    {
      key: "id",
      label: "Episode",
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <Link
            href={`/admin/creator/youtube/${row.id}`}
            className="font-mono text-sm text-primary hover:underline"
          >
            {row.id}
          </Link>
          <FolderReveal path={row.folderPath} label="dir" />
        </span>
      ),
    },
    {
      key: "topic",
      label: "Topic",
      render: (row) => (
        <span className="text-sm">
          {row.meta.topic ?? row.meta.catalogueTitle ?? "-"}
        </span>
      ),
    },
    {
      key: "scriptStatus",
      label: "Script",
      render: (row) => (
        <StatusSelect
          kind="scriptStatus"
          id={row.id}
          status={row.meta.scriptStatus}
        />
      ),
    },
    {
      key: "status",
      label: "Pub status",
      render: (row) => (
        <StatusSelect
          kind="youtube"
          id={row.id}
          status={row.status}
          onUpdate={(s) => applyLocalStatus(row.id, s)}
        />
      ),
    },
    { key: "scene", label: "Scene" },
    { key: "sceneBase", label: "Base" },
    { key: "background", label: "Background" },
    { key: "final", label: "Final" },
    { key: "recording", label: "Recording" },
    { key: "imagesDir", label: "Images" },
    { key: "qaReport", label: "QA" },
  ];

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load YouTube episodes</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  const recorded = rows.filter((r) => r.meta.recorded).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>YouTube episodes</CardTitle>
              <CardDescription>
                {recorded} of {rows.length} recorded. Status comes from the
                YouTube Data API when <code>YOUTUBE_API_KEY</code> +{" "}
                <code>YOUTUBE_CHANNEL_ID</code> are set; otherwise it falls
                back to the local recorded-ids list.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/creator/eval"
                className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Eval annotations
              </Link>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {syncing ? "Syncing..." : "Sync from API"}
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {nextNotStarted ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleGenerateNext()}
                  disabled={generatingNext}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {generatingNext
                    ? `Generating ${nextNotStarted.id}...`
                    : `Generate next: ${nextNotStarted.id}`}
                </button>
                <span className="text-xs text-muted-foreground">
                  Next catalogue episode without a draft.
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                All catalogue episodes have at least a draft.
              </span>
            )}
          </div>
          {generateError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {generateError}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      <ArtifactSpreadsheet<YouTubeRow>
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
