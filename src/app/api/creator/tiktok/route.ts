import { NextResponse } from "next/server";
import { readTikTokEpisodes } from "@/lib/creator/tiktok-pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readTikTokEpisodes();
  return NextResponse.json({ rows });
}
