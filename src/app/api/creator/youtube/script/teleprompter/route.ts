import { NextRequest, NextResponse } from "next/server";
import { readScript } from "@/lib/creator/youtube-script";
import { formatTeleprompter } from "@/lib/creator/youtube-teleprompter";

export const dynamic = "force-dynamic";

const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const episodeId = req.nextUrl.searchParams.get("episodeId") ?? "";
    if (!episodeId || !EPISODE_ID_PATTERN.test(episodeId)) {
      return NextResponse.json(
        { ok: false, error: "episodeId must match YT-S\\d{2}-E\\d{2}" },
        { status: 400 }
      );
    }

    const script = readScript(episodeId);
    if (!script) {
      return NextResponse.json(
        { ok: false, error: `no script for ${episodeId}` },
        { status: 404 }
      );
    }

    const body = formatTeleprompter(script);
    return NextResponse.json({ body });
  } catch (err) {
    console.error(
      "[GET /api/creator/youtube/script/teleprompter] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
