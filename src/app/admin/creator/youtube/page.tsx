"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function YouTubePage() {
  const [rows, setRows] = useState<YouTubeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  const columns: ColumnSpec<YouTubeRow>[] = [
    {
      key: "id",
      label: "Episode",
      render: (row) => <FolderReveal path={row.folderPath} label={row.id} />,
    },
    {
      key: "status",
      label: "Status",
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

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
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
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Sync from API"}
            </button>
          </div>
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
