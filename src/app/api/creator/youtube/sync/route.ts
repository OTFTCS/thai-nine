import { NextResponse } from "next/server";
import { readYouTubeRows } from "@/lib/creator/youtube-pipeline";
import { invalidateTrackerCache } from "@/lib/creator/tracker-xlsx";

export const dynamic = "force-dynamic";

// Forces a fresh YouTube Data API fetch + tracker re-read. Wired to the
// "Sync from API" button on /admin/creator/youtube.
export async function GET() {
  invalidateTrackerCache();
  try {
    const rows = await readYouTubeRows();
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
