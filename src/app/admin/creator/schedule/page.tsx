"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ScheduledPost, SocialsRow, TrackerSnapshot } from "@/types/creator";

interface ComposeState {
  row: SocialsRow | null;
  caption: string;
  platformsIG: boolean;
  platformsTT: boolean;
  platformsYT: boolean;
  mediaUrl: string;
  scheduledFor: string;
  busy: boolean;
  message: string | null;
  error: string | null;
}

function defaultTimeFromNow(minutes = 60): string {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

const BASE_HASHTAGS = ["#LearnThai", "#ThaiLanguage", "#ภาษาไทย"];

function suggestCaption(row: SocialsRow | null): string {
  if (!row) return "";
  const cat = row.category.toLowerCase();
  const tags = [...BASE_HASHTAGS];
  if (cat.includes("classifier")) tags.push("#ThaiClassifiers", "#ThaiGrammar");
  if (cat.includes("vocab")) tags.push("#ThaiVocabulary");
  const tail = row.contentType ? `\n\n(${row.contentType})` : "";
  return `${row.title || "New Thai lesson"}${tail}\n\n${tags.join(" ")}`;
}

export default function SchedulePage() {
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [pending, setPending] = useState<ScheduledPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>({
    row: null,
    caption: "",
    platformsIG: true,
    platformsTT: true,
    platformsYT: false,
    mediaUrl: "",
    scheduledFor: defaultTimeFromNow(),
    busy: false,
    message: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const [trackerRes, schedRes] = await Promise.all([
        fetch("/api/creator/tracker", { cache: "no-store" }),
        fetch("/api/creator/schedule", { cache: "no-store" }),
      ]);
      if (!trackerRes.ok) throw new Error(`tracker HTTP ${trackerRes.status}`);
      if (!schedRes.ok) throw new Error(`schedule HTTP ${schedRes.status}`);
      setSnapshot((await trackerRes.json()) as TrackerSnapshot);
      const { posts } = (await schedRes.json()) as { posts: ScheduledPost[] };
      setPending(posts);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const candidates = useMemo(() => {
    if (!snapshot) return [] as SocialsRow[];
    return snapshot.socials.filter((row) => {
      if (row.kind !== "data") return false;
      const s = row.status.toLowerCase();
      return (
        s === "scripted" ||
        s === "ready" ||
        s === "queued" ||
        s.includes("rework") ||
        s === "idea"
      );
    });
  }, [snapshot]);

  function selectRow(row: SocialsRow) {
    setCompose((c) => ({
      ...c,
      row,
      caption: suggestCaption(row),
      platformsIG: row.platforms.toUpperCase().includes("IG"),
      platformsTT: row.platforms.toUpperCase().includes("TT"),
      platformsYT: row.platforms.toUpperCase().includes("YT"),
      message: null,
      error: null,
    }));
  }

  function selectedPlatforms(): string[] {
    const out: string[] = [];
    if (compose.platformsIG) out.push("IG");
    if (compose.platformsTT) out.push("TT");
    if (compose.platformsYT) out.push("YT");
    return out;
  }

  async function submitSchedule() {
    setCompose((c) => ({ ...c, busy: true, message: null, error: null }));
    try {
      const res = await fetch("/api/creator/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialsRowIndex: compose.row?.rowIndex ?? null,
          title: compose.row?.title ?? "Untitled",
          platforms: selectedPlatforms(),
          caption: compose.caption,
          mediaRef: compose.mediaUrl || null,
          scheduledFor: new Date(compose.scheduledFor).toISOString(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCompose((c) => ({ ...c, busy: false, message: "Scheduled." }));
      await refresh();
    } catch (err) {
      setCompose((c) => ({ ...c, busy: false, error: (err as Error).message }));
    }
  }

  async function submitPublishNow() {
    setCompose((c) => ({ ...c, busy: true, message: null, error: null }));
    try {
      const res = await fetch("/api/creator/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms(),
          caption: compose.caption,
          mediaUrl: compose.mediaUrl || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      const modeNote = (body as { socialApi?: { dryRun?: boolean } }).socialApi?.dryRun
        ? "Dry-run: nothing actually posted."
        : "Live post dispatched.";
      setCompose((c) => ({ ...c, busy: false, message: modeNote }));
    } catch (err) {
      setCompose((c) => ({ ...c, busy: false, error: (err as Error).message }));
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Could not load</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Pick content</CardTitle>
            <CardDescription>
              Rows in the Socials sheet with status Scripted, Ready, Queued, Idea or Rework.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] space-y-1 overflow-auto">
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing ready to schedule.</p>
              )}
              {candidates.map((row) => (
                <button
                  key={row.rowIndex}
                  onClick={() => selectRow(row)}
                  className={
                    "w-full rounded-md border p-3 text-left text-sm transition-colors " +
                    (compose.row?.rowIndex === row.rowIndex
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted")
                  }
                >
                  <div className="font-medium">{row.title || "(untitled)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.status} · {row.platforms} · {row.category}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Compose</CardTitle>
            <CardDescription>
              Edit the caption, pick platforms, then schedule or publish.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Caption</label>
              <textarea
                className="h-40 w-full rounded-lg border border-border bg-background p-3 text-sm"
                value={compose.caption}
                onChange={(e) => setCompose({ ...compose, caption: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Media URL (optional)</label>
              <Input
                value={compose.mediaUrl}
                placeholder="https://…"
                onChange={(e) => setCompose({ ...compose, mediaUrl: e.target.value })}
              />
            </div>
            <fieldset className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={compose.platformsIG}
                  onChange={(e) => setCompose({ ...compose, platformsIG: e.target.checked })}
                />
                Instagram
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={compose.platformsTT}
                  onChange={(e) => setCompose({ ...compose, platformsTT: e.target.checked })}
                />
                TikTok
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={compose.platformsYT}
                  onChange={(e) => setCompose({ ...compose, platformsYT: e.target.checked })}
                />
                YouTube
              </label>
            </fieldset>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Scheduled time</label>
              <Input
                type="datetime-local"
                value={compose.scheduledFor}
                onChange={(e) => setCompose({ ...compose, scheduledFor: e.target.value })}
              />
            </div>
            {compose.message && <p className="text-sm text-primary">{compose.message}</p>}
            {compose.error && <p className="text-sm text-destructive">{compose.error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={submitPublishNow} loading={compose.busy}>
                Publish now
              </Button>
              <Button onClick={submitSchedule} loading={compose.busy}>
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>
            {pending.length} scheduled posts. Due posts run the next time the What&apos;s Next
            page loads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          )}
          <div className="space-y-2">
            {pending.map((post) => (
              <div
                key={post.id}
                className="flex items-start justify-between rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{post.title}</div>
                  <div className="text-muted-foreground">
                    {post.platforms.join(", ")} · {new Date(post.scheduledFor).toLocaleString()}
                  </div>
                  {post.lastError && (
                    <div className="text-destructive text-xs mt-1">{post.lastError}</div>
                  )}
                </div>
                <Badge
                  variant={
                    post.status === "done"
                      ? "free"
                      : post.status === "failed"
                        ? "locked"
                        : "in_progress"
                  }
                >
                  {post.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
