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
import type { TikTokEpisodeRow } from "@/types/creator";

export default function TikTokPage() {
  const [rows, setRows] = useState<TikTokEpisodeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (endpoint: string) => {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { rows: TikTokEpisodeRow[] };
    setRows(json.rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load("/api/creator/tiktok");
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
      await load("/api/creator/tiktok/sync");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  function applyLocalStatus(id: string, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const columns: ColumnSpec<TikTokEpisodeRow>[] = [
    {
      key: "series",
      label: "Series",
      render: (row) => (
        <FolderReveal path={row.folderPath} label={row.meta.series} />
      ),
    },
    {
      key: "ep",
      label: "Ep",
      render: (row) => (
        <span className="font-mono text-sm">
          {String(row.meta.epNum).padStart(2, "0")}
        </span>
      ),
    },
    { key: "title", label: "Title", render: (row) => row.title },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusSelect
          kind="tiktok"
          id={row.id}
          status={row.status}
          onUpdate={(s) => applyLocalStatus(row.id, s)}
        />
      ),
    },
    { key: "script", label: "Script" },
    { key: "beatsheet", label: "Beatsheet" },
    { key: "scene", label: "Scene" },
    { key: "final", label: "Final" },
    { key: "recording", label: "Recording" },
  ];

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load TikTok episodes</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>TikTok episodes</CardTitle>
              <CardDescription>
                {rows.length} episodes scripted across{" "}
                {new Set(rows.map((r) => r.meta.series)).size} series. Status
                comes from the TikTok API when{" "}
                <code>TIKTOK_ACCESS_TOKEN</code> is set, otherwise{" "}
                <strong>UNKNOWN</strong>.
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

      <ArtifactSpreadsheet<TikTokEpisodeRow>
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
