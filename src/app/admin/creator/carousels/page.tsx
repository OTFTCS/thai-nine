"use client";

import { useEffect, useState } from "react";
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
import type { CarouselRow } from "@/types/creator";

export default function CarouselsPage() {
  const [rows, setRows] = useState<CarouselRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function applyLocalStatus(id: string, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/creator/carousels", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { rows: CarouselRow[] };
        if (!cancelled) setRows(json.rows);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: ColumnSpec<CarouselRow>[] = [
    {
      key: "id",
      label: "Carousel",
      render: (row) => <FolderReveal path={row.folderPath} label={row.id} />,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusSelect
          kind="carousel"
          id={row.id}
          status={row.status}
          onUpdate={(s) => applyLocalStatus(row.id, s)}
        />
      ),
    },
    { key: "manifest", label: "Manifest" },
    { key: "sourceArt", label: "Source" },
    { key: "finalPng", label: "Final PNGs" },
    { key: "pptx", label: "PPTX" },
    { key: "contactSheet", label: "Sheet" },
    { key: "xlsx", label: "Tracker" },
  ];

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load carousels</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Image carousels</CardTitle>
          <CardDescription>
            {rows.length} carousels in &ldquo;Thai images&rdquo;. Status comes
            from the project tracker.
          </CardDescription>
        </CardHeader>
      </Card>

      <ArtifactSpreadsheet<CarouselRow>
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
