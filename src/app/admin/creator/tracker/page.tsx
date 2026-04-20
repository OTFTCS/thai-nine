"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { SocialsRow, TrackerSnapshot } from "@/types/creator";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusVariant(status: string): "default" | "free" | "in_progress" | "locked" | "new" {
  const s = status.toLowerCase();
  if (s === "published" || s === "done") return "free";
  if (s.includes("ready") || s.includes("scripted")) return "in_progress";
  if (s.includes("idea")) return "new";
  if (s.includes("rework") || s.includes("block")) return "locked";
  return "default";
}

interface PostModalState {
  row: SocialsRow;
  datePosted: string;
  link: string;
  views: string;
  likes: string;
  submitting: boolean;
  error: string | null;
}

export default function TrackerPage() {
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<PostModalState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creator/tracker", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TrackerSnapshot;
      setSnapshot(json);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!snapshot) return [] as SocialsRow[];
    return snapshot.socials.filter((row) => {
      if (row.kind !== "data" && row.kind !== "section") return false;
      if (row.kind === "section") return true;
      if (platformFilter && !row.platforms.toLowerCase().includes(platformFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter && !row.status.toLowerCase().includes(statusFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [snapshot, platformFilter, statusFilter]);

  async function submitMarkPosted() {
    if (!modal) return;
    setModal({ ...modal, submitting: true, error: null });
    try {
      const res = await fetch("/api/creator/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "socials",
          rowIndex: modal.row.rowIndex,
          patch: {
            status: "Published",
            datePosted: modal.datePosted,
            link: modal.link,
            views: modal.views,
            likes: modal.likes,
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setModal(null);
      await load();
    } catch (err) {
      setModal((curr) =>
        curr ? { ...curr, submitting: false, error: (err as Error).message } : curr
      );
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading tracker…</p>;
  if (error || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load tracker</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recurring tasks</CardTitle>
          <CardDescription>
            {snapshot.recurringTasks.length} items. Rows without a &quot;Next Due&quot; date don&apos;t
            fire alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {snapshot.recurringTasks.map((task) => (
              <div
                key={task.rowIndex}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="font-medium">{task.task}</div>
                <div className="text-muted-foreground">
                  {task.frequency || "—"} · {task.owner || "unassigned"} ·{" "}
                  {task.nextDue || "no due date"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priorities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {snapshot.priorities.slice(0, 5).map((p) => (
              <div key={p.rowIndex} className="rounded-md border border-border p-3 text-sm">
                <div className="font-medium">
                  #{p.priority} {p.area}
                </div>
                <div className="text-muted-foreground">{p.currentStatus}</div>
                {p.keyBlocker && (
                  <div className="mt-1 text-xs text-destructive">Blocker: {p.keyBlocker}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Socials</CardTitle>
          <CardDescription>
            Each data row maps to a row in thai-nine-project-tracker.xlsx. &quot;Mark posted&quot;
            writes directly to the xlsx on disk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              placeholder="Filter by platform (IG, TT, YT)"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="max-w-xs"
            />
            <Input
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Platforms</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  if (row.kind === "section") {
                    return (
                      <tr key={row.rowIndex} className="bg-muted/50">
                        <td
                          colSpan={8}
                          className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {row.sectionLabel}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.rowIndex} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{row.num}</td>
                      <td className="py-2 pr-4">{row.title || <span className="text-muted-foreground">(untitled)</span>}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.contentType}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.category}</td>
                      <td className="py-2 pr-4">{row.platforms}</td>
                      <td className="py-2 pr-4">
                        {row.status && (
                          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.datePosted}</td>
                      <td className="py-2 pr-4">
                        {row.status.toLowerCase() !== "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setModal({
                                row,
                                datePosted: today(),
                                link: row.link,
                                views: row.views,
                                likes: row.likes,
                                submitting: false,
                                error: null,
                              })
                            }
                          >
                            Mark posted
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Carousels (read-only)</CardTitle>
          <CardDescription>
            {snapshot.imageCarousels.length === 0
              ? "No carousel rows yet."
              : `${snapshot.imageCarousels.length} tracked.`}
          </CardDescription>
        </CardHeader>
        {snapshot.imageCarousels.length > 0 && (
          <CardContent>
            <ul className="space-y-1 text-sm">
              {snapshot.imageCarousels.map((r) => (
                <li key={r.rowIndex}>
                  <span className="font-medium">{r.topic}</span>
                  <span className="text-muted-foreground"> — {r.status || "no status"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Mark posted</CardTitle>
              <CardDescription>{modal.row.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Date posted</label>
                <Input
                  type="date"
                  value={modal.datePosted}
                  onChange={(e) => setModal({ ...modal, datePosted: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Link / notes</label>
                <Input
                  value={modal.link}
                  onChange={(e) => setModal({ ...modal, link: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Views</label>
                  <Input
                    value={modal.views}
                    onChange={(e) => setModal({ ...modal, views: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Likes</label>
                  <Input
                    value={modal.likes}
                    onChange={(e) => setModal({ ...modal, likes: e.target.value })}
                  />
                </div>
              </div>
              {modal.error && <p className="text-sm text-destructive">{modal.error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setModal(null)} disabled={modal.submitting}>
                  Cancel
                </Button>
                <Button onClick={submitMarkPosted} loading={modal.submitting}>
                  Save to xlsx
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
