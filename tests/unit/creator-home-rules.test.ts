import test from "node:test";
import assert from "node:assert/strict";
import { deriveWhatsNext } from "../../src/lib/creator/home.ts";
import type {
  PrioritiesRow,
  RecurringTaskRow,
  SocialsRow,
  TrackerSnapshot,
  YouTubeInventory,
  YouTubeRow,
} from "../../src/types/creator.ts";

function makeYouTubeRow(
  id: string,
  overrides: Partial<YouTubeRow["meta"]> = {}
): YouTubeRow {
  return {
    id,
    title: id,
    status: "PENDING",
    folderPath: "",
    artifacts: {},
    meta: {
      recorded: false,
      scriptStatus: "NOT_STARTED",
      catalogueTitle: null,
      topic: null,
      level: null,
      lessonRef: null,
      hasScript: false,
      ...overrides,
    },
  };
}

function emptySnapshot(): TrackerSnapshot {
  return {
    priorities: [],
    lessonPipeline: [],
    socials: [],
    competitors: [],
    websiteQuiz: [],
    recurringTasks: [],
    imageCarousels: [],
    loadedAt: new Date().toISOString(),
  };
}

function emptyYouTube(): YouTubeInventory {
  return { episodes: [], recordedIds: [], nextEpisode: null };
}

test("home rules: due recurring task wins", () => {
  const snap = emptySnapshot();
  const due: RecurringTaskRow = {
    rowIndex: 2,
    task: "Weekly TikTok",
    area: "TikTok",
    frequency: "Weekly",
    automated: "No",
    lastRun: "",
    nextDue: "2026-04-10",
    owner: "Nine",
    notes: "",
  };
  snap.recurringTasks.push(due);

  const result = deriveWhatsNext(snap, emptyYouTube(), new Date("2026-04-19T12:00:00Z"));
  assert.equal(result.reason, "recurring-due");
  assert.equal(result.headline, "Weekly TikTok");
});

test("home rules: falls through to blocked priority when no recurring is due", () => {
  const snap = emptySnapshot();
  const p: PrioritiesRow = {
    rowIndex: 2,
    priority: "1",
    area: "Pipeline",
    currentStatus: "Has a blocker",
    keyBlocker: "Quality inconsistent",
    nextMilestone: "Finish gold standard",
    targetDate: "",
    notes: "",
  };
  snap.priorities.push(p);
  const result = deriveWhatsNext(snap, emptyYouTube(), new Date("2026-04-19"));
  assert.equal(result.reason, "priority-blocked");
  assert.match(result.headline, /Pipeline/);
});

test("home rules: next unposted social when priorities are clear", () => {
  const snap = emptySnapshot();
  const row: SocialsRow = {
    kind: "data",
    rowIndex: 10,
    num: "52",
    title: "Classifier rework EP01",
    contentType: "Reel",
    category: "Thai Classifiers",
    platforms: "IG, TT",
    status: "Script Rework",
    datePosted: "",
    views: "",
    likes: "",
    link: "",
  };
  snap.socials.push(row);
  const result = deriveWhatsNext(snap, emptyYouTube(), new Date("2026-04-19"));
  assert.equal(result.reason, "social-pending");
  assert.match(result.headline, /Classifier rework/);
});

test("home rules: next YouTube episode when nothing else is pending", () => {
  const snap = emptySnapshot();
  const yt: YouTubeInventory = {
    episodes: [],
    recordedIds: ["YT-S01-E01"],
    nextEpisode: {
      episodeId: "YT-S01-E04",
      dir: "/tmp",
      scenePath: "/tmp/scene.py",
      basePath: null,
      qaReportPath: null,
      qaReport: null,
      sceneSource: "pass",
      recorded: false,
    },
  };
  const result = deriveWhatsNext(snap, yt, new Date("2026-04-19"));
  assert.equal(result.reason, "youtube-next");
  assert.match(result.headline, /YT-S01-E04/);
});

test("home rules: idle state when nothing matches", () => {
  const snap = emptySnapshot();
  const result = deriveWhatsNext(snap, emptyYouTube(), new Date("2026-04-19"));
  assert.equal(result.reason, "idle");
});

test("home rules: surfaces next NOT_STARTED YouTube row when nothing else is pending", () => {
  const snap = emptySnapshot();
  const rows: YouTubeRow[] = [
    makeYouTubeRow("YT-S01-E07", {
      scriptStatus: "NOT_STARTED",
      topic: "What to wear",
      level: "A0",
    }),
  ];
  const result = deriveWhatsNext(
    snap,
    emptyYouTube(),
    new Date("2026-04-19"),
    rows
  );
  assert.equal(result.reason, "next-script-to-write");
  assert.match(result.headline, /^Write next script: /);
  assert.equal(result.headline, "Write next script: YT-S01-E07");
  assert.match(result.deepLink, /^\/admin\/creator\/youtube\//);
  assert.equal(result.deepLink, "/admin/creator/youtube/YT-S01-E07");
  assert.equal(result.detail, "What to wear (A0)");
});

test("home rules: NOT_STARTED rule picks the lowest episodeId", () => {
  const snap = emptySnapshot();
  const rows: YouTubeRow[] = [
    makeYouTubeRow("YT-S01-E07", { scriptStatus: "NOT_STARTED" }),
    makeYouTubeRow("YT-S01-E03", { scriptStatus: "NOT_STARTED" }),
    makeYouTubeRow("YT-S01-E12", { scriptStatus: "NOT_STARTED" }),
  ];
  const result = deriveWhatsNext(
    snap,
    emptyYouTube(),
    new Date("2026-04-19"),
    rows
  );
  assert.equal(result.reason, "next-script-to-write");
  assert.equal(result.headline, "Write next script: YT-S01-E03");
  assert.equal(result.deepLink, "/admin/creator/youtube/YT-S01-E03");
});

test("home rules: NOT_STARTED rule does not fire when no rows match", () => {
  const snap = emptySnapshot();
  const rows: YouTubeRow[] = [
    makeYouTubeRow("YT-S01-E03", { scriptStatus: "DRAFT" }),
    makeYouTubeRow("YT-S01-E04", { scriptStatus: "APPROVED" }),
    makeYouTubeRow("YT-S01-E05", { scriptStatus: "RECORDED", recorded: true }),
  ];
  const result = deriveWhatsNext(
    snap,
    emptyYouTube(),
    new Date("2026-04-19"),
    rows
  );
  assert.equal(result.reason, "idle");
});

test("home rules: higher-priority rule wins over NOT_STARTED rule", () => {
  const snap = emptySnapshot();
  const due: RecurringTaskRow = {
    rowIndex: 2,
    task: "Weekly TikTok",
    area: "TikTok",
    frequency: "Weekly",
    automated: "No",
    lastRun: "",
    nextDue: "2026-04-10",
    owner: "Nine",
    notes: "",
  };
  snap.recurringTasks.push(due);
  const rows: YouTubeRow[] = [
    makeYouTubeRow("YT-S01-E03", { scriptStatus: "NOT_STARTED" }),
  ];
  const result = deriveWhatsNext(
    snap,
    emptyYouTube(),
    new Date("2026-04-19T12:00:00Z"),
    rows
  );
  assert.equal(result.reason, "recurring-due");
  assert.notEqual(result.reason, "next-script-to-write");
});
