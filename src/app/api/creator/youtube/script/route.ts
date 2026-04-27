import { NextRequest, NextResponse } from "next/server";
import { findCatalogueEntry } from "@/lib/creator/youtube-catalogue";
import { readEpisodeStatus } from "@/lib/creator/episode-status";
import { readScriptParts } from "@/lib/creator/youtube-script";

export const dynamic = "force-dynamic";

const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const episodeId = req.nextUrl.searchParams.get("episodeId") ?? "";
    if (!episodeId) {
      return NextResponse.json(
        { ok: false, error: "episodeId is required" },
        { status: 400 }
      );
    }
    if (!EPISODE_ID_PATTERN.test(episodeId)) {
      return NextResponse.json(
        { ok: false, error: `episodeId must match YT-S\\d{2}-E\\d{2}` },
        { status: 400 }
      );
    }

    const catalogue = findCatalogueEntry(episodeId);
    const status = readEpisodeStatus(episodeId);
    const scriptAndParts = readScriptParts(episodeId);
    const hasScript = scriptAndParts !== null;

    return NextResponse.json({
      episodeId,
      catalogue,
      status,
      hasScript,
      parts: scriptAndParts ? scriptAndParts.parts : null,
      script: scriptAndParts ? scriptAndParts.script : null,
    });
  } catch (err) {
    console.error("[GET /api/creator/youtube/script] unexpected error", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
