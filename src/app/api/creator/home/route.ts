import { NextResponse } from "next/server";
import { getTracker } from "@/lib/creator/tracker-xlsx";
import {
  readYouTubeInventory,
  readYouTubeRows,
} from "@/lib/creator/youtube-pipeline";
import {
  readTikTokEpisodes,
  readTikTokPipeline,
} from "@/lib/creator/tiktok-pipeline";
import { readLessons } from "@/lib/creator/lessons";
import { readCarousels } from "@/lib/creator/carousels";
import { deriveSectionSummaries, deriveWhatsNext } from "@/lib/creator/home";
import { runDuePosts } from "@/lib/creator/scheduler";
import { socialApiStatus } from "@/lib/creator/social-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const schedulerResult = await runDuePosts().catch((err) => ({
    processed: 0,
    done: 0,
    failed: 0,
    error: (err as Error).message,
  }));

  const [snapshot, inventory, lessons, youtubeRows, tiktokRows, carousels] =
    await Promise.all([
      getTracker(),
      readYouTubeInventory(),
      readLessons(),
      readYouTubeRows(),
      readTikTokEpisodes(),
      readCarousels(),
    ]);
  const tiktokLegacy = await readTikTokPipeline(snapshot.socials);
  const whatsNext = deriveWhatsNext(snapshot, inventory, new Date(), youtubeRows);
  const sectionSummaries = deriveSectionSummaries({
    snapshot,
    lessons,
    youtube: youtubeRows,
    tiktok: tiktokRows,
    carousels,
  });

  return NextResponse.json({
    whatsNext,
    tiktok: tiktokLegacy,
    youtube: {
      recordedIds: inventory.recordedIds,
      nextEpisodeId: inventory.nextEpisode?.episodeId ?? null,
    },
    socialApi: socialApiStatus(),
    scheduler: schedulerResult,
    counts: {
      priorities: snapshot.priorities.length,
      lessonPipeline: snapshot.lessonPipeline.length,
      socialsData: snapshot.socials.filter((s) => s.kind === "data").length,
      recurringTasks: snapshot.recurringTasks.length,
    },
    sectionSummaries,
  });
}
