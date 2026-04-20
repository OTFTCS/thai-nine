import { NextResponse } from "next/server";
import { readYouTubeRows } from "@/lib/creator/youtube-pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readYouTubeRows();
  return NextResponse.json({ rows });
}
