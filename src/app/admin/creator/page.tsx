"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  WhatsNext,
  TikTokSeriesStatus,
  SectionSummaries,
} from "@/types/creator";

interface HomePayload {
  whatsNext: WhatsNext;
  tiktok: TikTokSeriesStatus[];
  youtube: { recordedIds: string[]; nextEpisodeId: string | null };
  socialApi: { dryRun: boolean; instagramConfigured: boolean; tiktokConfigured: boolean };
  scheduler: { processed: number; done: number; failed: number };
  counts: { priorities: number; lessonPipeline: number; socialsData: number; recurringTasks: number };
  sectionSummaries: SectionSummaries;
}

interface SummaryCardProps {
  title: string;
  href: string;
  icon: string;
  primary: { value: number; label: string };
  secondary?: { value: number; label: string };
  tone?: "default" | "warn" | "ok";
}

function SummaryCard({ title, href, icon, primary, secondary, tone }: SummaryCardProps) {
  const toneClass =
    tone === "warn"
      ? "text-amber-700"
      : tone === "ok"
      ? "text-green-700"
      : "text-foreground";
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/60 hover:bg-primary/5">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <span>{icon}</span>
            <span>{title}</span>
          </CardDescription>
          <CardTitle className={`text-3xl ${toneClass}`}>{primary.value}</CardTitle>
          <CardDescription className="text-xs">{primary.label}</CardDescription>
        </CardHeader>
        {secondary && (
          <CardContent className="pt-0">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{secondary.value}</span>{" "}
              {secondary.label}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}

export default function CreatorHomePage() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/creator/home", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HomePayload;
        if (!cancelled) setData(json);
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

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load dashboard</CardTitle>
          <CardDescription>{error ?? "Unknown error"}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { whatsNext, socialApi, sectionSummaries: s } = data;

  return (
    <div className="space-y-6">
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardDescription>What&apos;s next</CardDescription>
          <CardTitle className="text-2xl">{whatsNext.headline}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{whatsNext.detail}</p>
          <Link href={whatsNext.deepLink}>
            <Button size="lg">{whatsNext.cta}</Button>
          </Link>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tracker sections</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Priorities"
            href="/admin/creator/tracker"
            icon="🎯"
            primary={{ value: s.priorities.total, label: "items" }}
            secondary={{ value: s.priorities.blocked, label: "blocked" }}
            tone={s.priorities.blocked > 0 ? "warn" : "default"}
          />
          <SummaryCard
            title="Lessons"
            href="/admin/creator/lessons"
            icon="🎓"
            primary={{ value: s.lessons.total, label: "on disk" }}
            secondary={{ value: s.lessons.readyToRecord, label: "ready to record" }}
            tone={s.lessons.readyToRecord > 0 ? "ok" : "default"}
          />
          <SummaryCard
            title="Socials"
            href="/admin/creator/schedule"
            icon="📣"
            primary={{ value: s.socials.published, label: "published" }}
            secondary={{ value: s.socials.pending, label: "pending" }}
          />
          <SummaryCard
            title="Website / quiz"
            href="/admin/creator/tracker"
            icon="🌐"
            primary={{ value: s.website.done, label: `of ${s.website.total} done` }}
          />
          <SummaryCard
            title="Recurring"
            href="/admin/creator/tracker"
            icon="🔁"
            primary={{ value: s.recurring.total, label: "tasks" }}
            secondary={{ value: s.recurring.overdue, label: "overdue" }}
            tone={s.recurring.overdue > 0 ? "warn" : "default"}
          />
          <SummaryCard
            title="Carousels"
            href="/admin/creator/carousels"
            icon="🖼"
            primary={{ value: s.carousels.posted, label: `of ${s.carousels.total} posted` }}
          />
          <SummaryCard
            title="YouTube"
            href="/admin/creator/youtube"
            icon="🎬"
            primary={{ value: s.youtube.recorded, label: `of ${s.youtube.total} recorded` }}
          />
          <SummaryCard
            title="TikTok"
            href="/admin/creator/tiktok"
            icon="📱"
            primary={{ value: s.tiktok.published, label: `of ${s.tiktok.total} published` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Posting mode</CardTitle>
          <CardDescription>
            Publishing is{" "}
            <Badge variant={socialApi.dryRun ? "in_progress" : "free"}>
              {socialApi.dryRun ? "DRY RUN" : "LIVE"}
            </Badge>{" "}
            — flip <code>SOCIAL_DRY_RUN=false</code> once credentials are set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            Instagram creds:{" "}
            <Badge variant={socialApi.instagramConfigured ? "free" : "locked"}>
              {socialApi.instagramConfigured ? "set" : "missing"}
            </Badge>
          </div>
          <div>
            TikTok creds:{" "}
            <Badge variant={socialApi.tiktokConfigured ? "free" : "locked"}>
              {socialApi.tiktokConfigured ? "set" : "missing"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
