import type { ScriptStatus } from "@/lib/creator/episode-status";

// Re-export for convenience to consumers that import only from types.
export type { ScriptStatus };

export type TrackerRowKind = "data" | "section" | "blank";

export interface SocialsRow {
  kind: TrackerRowKind;
  rowIndex: number;
  sectionLabel?: string;
  num: string;
  title: string;
  contentType: string;
  category: string;
  platforms: string;
  status: string;
  datePosted: string;
  views: string;
  likes: string;
  link: string;
}

export interface PrioritiesRow {
  rowIndex: number;
  priority: string;
  area: string;
  currentStatus: string;
  keyBlocker: string;
  nextMilestone: string;
  targetDate: string;
  notes: string;
}

export interface LessonPipelineRow {
  rowIndex: number;
  lessonId: string;
  module: string;
  title: string;
  stage: string;
  status: string;
  scriptQuality: string;
  deckBuilt: string;
  qaPass: string;
  blocker: string;
  lastUpdated: string;
}

export interface RecurringTaskRow {
  rowIndex: number;
  task: string;
  area: string;
  frequency: string;
  automated: string;
  lastRun: string;
  nextDue: string;
  owner: string;
  notes: string;
}

export interface CompetitorRow {
  rowIndex: number;
  account: string;
  platform: string;
  followers: string;
  posts: string;
  style: string;
  works: string;
  ideas: string;
}

export interface WebsiteQuizRow {
  rowIndex: number;
  task: string;
  area: string;
  status: string;
  priority: string;
  dependsOn: string;
  notes: string;
}

export interface ImageCarouselRow {
  rowIndex: number;
  topic: string;
  lessonLink: string;
  status: string;
  imagesCreated: string;
  postedTo: string;
  datePosted: string;
  notes: string;
}

export interface TrackerSnapshot {
  priorities: PrioritiesRow[];
  lessonPipeline: LessonPipelineRow[];
  socials: SocialsRow[];
  competitors: CompetitorRow[];
  websiteQuiz: WebsiteQuizRow[];
  recurringTasks: RecurringTaskRow[];
  imageCarousels: ImageCarouselRow[];
  loadedAt: string;
}

export interface YouTubeEpisode {
  episodeId: string;
  dir: string;
  scenePath: string | null;
  basePath: string | null;
  backgroundPath: string | null;
  finalPath: string | null;
  recordingPath: string | null;
  imagesDirPath: string | null;
  qaReportPath: string | null;
  qaReport: unknown;
  sceneSource: string | null;
  recorded: boolean;
}

export interface YouTubeInventory {
  episodes: YouTubeEpisode[];
  recordedIds: string[];
  nextEpisode: YouTubeEpisode | null;
}

export interface TikTokSeriesStatus {
  series: string;
  episodesOnDisk: number;
  scripted: number;
  rendered: number;
  published: number;
}

export type ScheduledPostStatus = "pending" | "done" | "failed";

export interface ScheduledPost {
  id: string;
  socialsRowIndex: number | null;
  title: string;
  platforms: string[];
  caption: string;
  mediaRef: string | null;
  scheduledFor: string;
  status: ScheduledPostStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WhatsNext {
  headline: string;
  detail: string;
  cta: string;
  deepLink: string;
  supporting: Array<{ label: string; value: string; deepLink?: string }>;
  reason: string;
}

export interface Artifact {
  path: string;
  exists: boolean;
  label: string;
  icon: string;
}

export type ArtifactMap = Record<string, Artifact>;

export interface ContentRow<TMeta = Record<string, never>> {
  id: string;
  title: string;
  status: string;
  folderPath: string;
  artifacts: ArtifactMap;
  meta: TMeta;
}

export type LessonRow = ContentRow<{
  module: string;
  cefrBand: string;
  updatedAt: string;
}>;

export type YouTubeRow = ContentRow<{
  recorded: boolean;
  scriptStatus: ScriptStatus;
  catalogueTitle: string | null;
  topic: string | null;
  level: string | null;
  lessonRef: string | null;
  hasScript: boolean;
}>;

export type TikTokEpisodeRow = ContentRow<{
  series: string;
  epNum: number;
  published: boolean;
}>;

export type CarouselRow = ContentRow<{ xlsxPath: string }>;

export interface SectionSummaries {
  priorities: { total: number; blocked: number };
  lessons: {
    total: number;
    readyToRecord: number;
    draft: number;
    planned: number;
    backlog: number;
  };
  socials: { published: number; pending: number };
  website: { done: number; total: number };
  recurring: { overdue: number; total: number };
  carousels: { posted: number; total: number };
  youtube: { recorded: number; total: number };
  tiktok: { published: number; total: number };
}
