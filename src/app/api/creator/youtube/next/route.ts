import { NextResponse } from "next/server";
import { readYouTubeInventory } from "@/lib/creator/youtube-pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const inventory = await readYouTubeInventory();
  return NextResponse.json({
    episodes: inventory.episodes.map((ep) => ({
      episodeId: ep.episodeId,
      recorded: ep.recorded,
      hasScene: ep.scenePath !== null,
      hasQa: ep.qaReportPath !== null,
    })),
    recordedIds: inventory.recordedIds,
    nextEpisode: inventory.nextEpisode,
  });
}
