import { NextRequest, NextResponse } from "next/server";
import {
  ScriptInFlightError,
  withEpisodeLock,
} from "@/lib/creator/script-locks";
import {
  generateScript,
  type GenerateOutcome,
} from "@/lib/creator/youtube-script";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;

interface GenerateBody {
  episodeId?: string;
}

type GenerateFailureReason = Extract<GenerateOutcome, { ok: false }>["reason"];

function statusForFailure(reason: GenerateFailureReason): number {
  if (reason === "claude-cli-missing" || reason === "unsupported-platform") {
    return 503;
  }
  if (reason === "no-catalogue-entry") {
    return 404;
  }
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    let body: GenerateBody;
    try {
      body = (await req.json()) as GenerateBody;
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

    let outcome: GenerateOutcome;
    try {
      outcome = await withEpisodeLock(episodeId, () =>
        generateScript({ episodeId })
      );
    } catch (err) {
      if (err instanceof ScriptInFlightError) {
        return NextResponse.json(
          {
            ok: false,
            reason: "in-flight",
            message: err.message,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    if (outcome.ok) {
      return NextResponse.json({
        ok: true,
        scriptPath: outcome.scriptPath,
        status: outcome.status,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        reason: outcome.reason,
        message: outcome.message,
        details: outcome.details,
      },
      { status: statusForFailure(outcome.reason) }
    );
  } catch (err) {
    console.error(
      "[POST /api/creator/youtube/script/generate] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
