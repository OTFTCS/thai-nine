import type {
  CarouselRow,
  LessonRow,
  PrioritiesRow,
  RecurringTaskRow,
  SectionSummaries,
  SocialsRow,
  TikTokEpisodeRow,
  TrackerSnapshot,
  WhatsNext,
  YouTubeInventory,
  YouTubeRow,
} from "@/types/creator";

function todayISODate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function parseDueDate(value: string): Date | null {
  if (!value) return null;
  // Accept YYYY-MM-DD or anything Date can parse.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dueRecurringTasks(
  tasks: RecurringTaskRow[],
  now: Date
): RecurringTaskRow[] {
  const today = new Date(todayISODate(now));
  return tasks.filter((t) => {
    const due = parseDueDate(t.nextDue);
    if (!due) return false;
    return due.getTime() <= today.getTime();
  });
}

function blockedPriority(priorities: PrioritiesRow[]): PrioritiesRow | null {
  for (const p of priorities) {
    const status = p.currentStatus.toLowerCase();
    const blocker = p.keyBlocker.toLowerCase();
    if (
      status.includes("blocker") ||
      status.includes("flaw") ||
      status.includes("needs review") ||
      blocker.length > 0
    ) {
      return p;
    }
  }
  return null;
}

function nextUnpostedSocial(socials: SocialsRow[]): SocialsRow | null {
  for (const row of socials) {
    if (row.kind !== "data") continue;
    const status = row.status.toLowerCase();
    if (!status) continue;
    if (status === "published" || status === "done") continue;
    if (
      status === "ready" ||
      status === "scripted" ||
      status === "queued" ||
      status.includes("rework")
    ) {
      return row;
    }
  }
  return null;
}

export function deriveWhatsNext(
  snapshot: TrackerSnapshot,
  youtube: YouTubeInventory,
  now = new Date(),
  youtubeRows: YouTubeRow[] = []
): WhatsNext {
  const supporting: WhatsNext["supporting"] = [
    {
      label: "Lessons in pipeline",
      value: String(snapshot.lessonPipeline.length),
      deepLink: "/admin/creator/tracker",
    },
    {
      label: "Social posts tracked",
      value: String(snapshot.socials.filter((s) => s.kind === "data").length),
      deepLink: "/admin/creator/tracker",
    },
    {
      label: "YouTube episodes recorded",
      value: String(youtube.recordedIds.length),
      deepLink: "/admin/creator/youtube",
    },
  ];

  // Rule 1: due recurring task
  const due = dueRecurringTasks(snapshot.recurringTasks, now);
  if (due.length > 0) {
    const first = due[0];
    return {
      headline: first.task,
      detail: `Recurring ${first.frequency.toLowerCase() || "task"} owned by ${first.owner || "you"} is due ${first.nextDue}.`,
      cta: "Open tracker",
      deepLink: "/admin/creator/tracker",
      supporting,
      reason: "recurring-due",
    };
  }

  // Rule 2: blocked / flagged priority
  const blocked = blockedPriority(snapshot.priorities);
  if (blocked) {
    return {
      headline: `${blocked.area}: ${blocked.nextMilestone || "address blocker"}`,
      detail: blocked.keyBlocker || blocked.currentStatus,
      cta: "Open tracker",
      deepLink: "/admin/creator/tracker",
      supporting,
      reason: "priority-blocked",
    };
  }

  // Rule 3: next unposted social
  const pending = nextUnpostedSocial(snapshot.socials);
  if (pending) {
    return {
      headline: `Finish and post: ${pending.title || "next social post"}`,
      detail: `${pending.status} on ${pending.platforms || "unspecified platform"}.`,
      cta: "Go to schedule",
      deepLink: "/admin/creator/schedule",
      supporting,
      reason: "social-pending",
    };
  }

  // Rule 4: next YouTube episode scripted but not recorded
  if (youtube.nextEpisode) {
    return {
      headline: `Record ${youtube.nextEpisode.episodeId}`,
      detail: "Next YouTube episode script is ready. Open the scene plan and film it.",
      cta: "Open YouTube view",
      deepLink: "/admin/creator/youtube",
      supporting,
      reason: "youtube-next",
    };
  }

  // Rule 5: next YouTube episode that still needs a script written
  const notStartedRow = [...youtubeRows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .find((row) => row.meta.scriptStatus === "NOT_STARTED");
  if (notStartedRow) {
    const topic = notStartedRow.meta.topic ?? notStartedRow.title;
    const level = notStartedRow.meta.level ?? "level TBD";
    return {
      headline: `Write next script: ${notStartedRow.id}`,
      detail: `${topic} (${level})`,
      cta: "Open episode",
      deepLink: `/admin/creator/youtube/${notStartedRow.id}`,
      supporting,
      reason: "next-script-to-write",
    };
  }

  return {
    headline: "All clear",
    detail: "Nothing urgent in the tracker. Pick a priority from the content table.",
    cta: "Open tracker",
    deepLink: "/admin/creator/tracker",
    supporting,
    reason: "idle",
  };
}

function isBlockedPriority(p: PrioritiesRow): boolean {
  const status = p.currentStatus.toLowerCase();
  return (
    status.includes("blocker") ||
    status.includes("flaw") ||
    status.includes("needs review") ||
    p.keyBlocker.trim().length > 0
  );
}

function isOverdueRecurring(t: RecurringTaskRow, today: Date): boolean {
  const due = parseDueDate(t.nextDue);
  if (!due) return false;
  return due.getTime() <= today.getTime();
}

function isDoneWebsiteTask(status: string): boolean {
  const s = status.toLowerCase();
  return s === "done" || s === "complete" || s === "completed" || s === "shipped";
}

function isPostedCarousel(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("posted") || s.includes("published");
}

export function deriveSectionSummaries(input: {
  snapshot: TrackerSnapshot;
  lessons: LessonRow[];
  youtube: YouTubeRow[];
  tiktok: TikTokEpisodeRow[];
  carousels: CarouselRow[];
  now?: Date;
}): SectionSummaries {
  const { snapshot, lessons, youtube, tiktok, carousels } = input;
  const now = input.now ?? new Date();
  const today = new Date(todayISODate(now));

  const lessonsByState = {
    readyToRecord: 0,
    draft: 0,
    planned: 0,
    backlog: 0,
  };
  for (const l of lessons) {
    switch (l.status) {
      case "READY_TO_RECORD":
        lessonsByState.readyToRecord++;
        break;
      case "DRAFT":
        lessonsByState.draft++;
        break;
      case "PLANNED":
        lessonsByState.planned++;
        break;
      case "BACKLOG":
        lessonsByState.backlog++;
        break;
    }
  }

  const socialsData = snapshot.socials.filter((s) => s.kind === "data");
  const socialsPublished = socialsData.filter(
    (s) => s.status.toLowerCase() === "published"
  ).length;

  return {
    priorities: {
      total: snapshot.priorities.length,
      blocked: snapshot.priorities.filter(isBlockedPriority).length,
    },
    lessons: {
      total: lessons.length,
      ...lessonsByState,
    },
    socials: {
      published: socialsPublished,
      pending: socialsData.length - socialsPublished,
    },
    website: {
      done: snapshot.websiteQuiz.filter((w) => isDoneWebsiteTask(w.status)).length,
      total: snapshot.websiteQuiz.length,
    },
    recurring: {
      overdue: snapshot.recurringTasks.filter((t) => isOverdueRecurring(t, today))
        .length,
      total: snapshot.recurringTasks.length,
    },
    carousels: {
      posted: carousels.filter((c) => isPostedCarousel(c.status)).length,
      total: carousels.length,
    },
    youtube: {
      recorded: youtube.filter((y) => y.meta.recorded).length,
      total: youtube.length,
    },
    tiktok: {
      published: tiktok.filter((t) => t.meta.published).length,
      total: tiktok.length,
    },
  };
}
