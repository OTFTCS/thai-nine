"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArtifactSpreadsheet,
  type ColumnSpec,
} from "@/components/creator/ArtifactSpreadsheet";
import { StatusBadge } from "@/components/creator/StatusBadge";
import { FolderReveal } from "@/components/creator/ArtifactLink";
import type { LessonRow } from "@/types/creator";

export default function LessonsPage() {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/creator/lessons", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { rows: LessonRow[] };
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

  const modules = useMemo(() => {
    const set = new Set(rows.map((r) => r.meta.module));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (module !== "all" && r.meta.module !== module) return false;
      if (!q) return true;
      return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
    });
  }, [rows, search, module]);

  const columns: ColumnSpec<LessonRow>[] = [
    {
      key: "id",
      label: "Lesson",
      render: (row) => <FolderReveal path={row.folderPath} label={row.id} />,
    },
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <span className="text-sm">
          {row.title}
          {row.meta.cefrBand && (
            <span className="ml-2 text-xs text-muted-foreground">
              {row.meta.cefrBand}
            </span>
          )}
        </span>
      ),
    },
    { key: "module", label: "Mod", render: (row) => <span className="font-mono text-xs">{row.meta.module}</span> },
    {
      key: "status",
      label: "State",
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "scriptSpoken", label: "Script" },
    { key: "scriptVisual", label: "Visual" },
    { key: "scriptMaster", label: "Master" },
    { key: "deck", label: "Deck" },
    { key: "canvaDeck", label: "Canva" },
    { key: "pdf", label: "PDF" },
    { key: "quiz", label: "Quiz" },
    { key: "flashcards", label: "Flash" },
    { key: "vocabExport", label: "Vocab" },
    { key: "qaReport", label: "QA" },
    { key: "brief", label: "Brief" },
  ];

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load lessons</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Course lessons</CardTitle>
          <CardDescription>
            {rows.length} lessons on disk. Click an artifact to open it; the
            lesson ID reveals the folder in Finder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="min-w-[260px] flex-1">
              <Input
                placeholder="Search by lesson ID or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ArtifactSpreadsheet<LessonRow>
        rows={filtered}
        columns={columns}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
