import { NextResponse } from "next/server";
import { readTikTokEpisodes } from "@/lib/creator/tiktok-pipeline";
import { invalidateTrackerCache } from "@/lib/creator/tracker-xlsx";

export const dynamic = "force-dynamic";

// Forces a fresh TikTok API fetch + tracker re-read. Wired to the "Sync from
// API" button on /admin/creator/tiktok. Status for each episode is derived
// from the API set inside tiktokSpec(), so simply re-invoking the scanner
// pulls the freshest data.
export async function GET() {
  invalidateTrackerCache();
  try {
    const rows = await readTikTokEpisodes();
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
