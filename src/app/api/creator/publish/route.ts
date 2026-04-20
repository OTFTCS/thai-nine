import { NextResponse } from "next/server";
import {
  publishToInstagram,
  publishToTikTok,
  socialApiStatus,
} from "@/lib/creator/social-api";

export const dynamic = "force-dynamic";

interface PublishBody {
  platforms: string[];
  caption: string;
  mediaUrl?: string | null;
}

export async function POST(request: Request) {
  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.platforms) || typeof body.caption !== "string") {
    return NextResponse.json(
      { error: "platforms[] and caption are required" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};
  for (const platform of body.platforms) {
    const p = platform.toLowerCase();
    try {
      if (p === "ig") {
        results[p] = await publishToInstagram({
          caption: body.caption,
          mediaUrl: body.mediaUrl ?? null,
        });
      } else if (p === "tt") {
        results[p] = await publishToTikTok({
          caption: body.caption,
          videoUrl: body.mediaUrl ?? null,
        });
      } else {
        results[p] = { error: `Unsupported platform: ${platform}` };
      }
    } catch (err) {
      results[p] = { error: (err as Error).message };
    }
  }

  return NextResponse.json({
    socialApi: socialApiStatus(),
    results,
  });
}
