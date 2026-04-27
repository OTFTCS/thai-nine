import { NextRequest, NextResponse } from "next/server";
import {
  readEpisodeStatus,
  SCRIPT_STATUSES,
  writeEpisodeStatus,
  type ScriptStatus,
} from "@/lib/creator/episode-status";

export const dynamic = "force-dynamic";

const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;

interface StatusPatchBody {
  episodeId?: string;
  scriptStatus?: string;
}

function isScriptStatus(value: unknown): value is ScriptStatus {
  return (
    typeof value === "string" &&
    (SCRIPT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export async function GET(req: NextRequest) {
  try {
    const episodeId = req.nextUrl.searchParams.get("episodeId") ?? "";
    if (!episodeId || !EPISODE_ID_PATTERN.test(episodeId)) {
      return NextResponse.json(
        { ok: false, error: "episodeId must match YT-S\\d{2}-E\\d{2}" },
        { status: 400 }
      );
    }
    const status = readEpisodeStatus(episodeId);
    return NextResponse.json({ status });
  } catch (err) {
    console.error(
      "[GET /api/creator/youtube/script/status] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: StatusPatchBody;
    try {
      body = (await req.json()) as StatusPatchBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid json body" },
        { status: 400 }
      );
    }

    const episodeId = body.episodeId ?? "";
    if (!episodeId || !EPISODE_ID_PATTERN.test(episodeId)) {
      return NextResponse.json(
        { ok: false, error: "episodeId must match YT-S\\d{2}-E\\d{2}" },
        { status: 400 }
      );
    }

    if (!isScriptStatus(body.scriptStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `scriptStatus must be one of ${SCRIPT_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const status = writeEpisodeStatus(episodeId, {
      scriptStatus: body.scriptStatus,
    });
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error(
      "[PATCH /api/creator/youtube/script/status] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
