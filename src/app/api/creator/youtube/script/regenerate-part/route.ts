import { NextRequest, NextResponse } from "next/server";
import {
  ScriptInFlightError,
  withEpisodeLock,
} from "@/lib/creator/script-locks";
import {
  regeneratePart,
  type RegenerateOutcome,
} from "@/lib/creator/youtube-script";
import type { PartKey } from "@/lib/creator/youtube-script-parts";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;
const VALID_PART_KEYS: ReadonlySet<PartKey> = new Set([
  "p1",
  "p2",
  "p3",
  "p4",
]);

interface RegenerateBody {
  episodeId?: string;
  partKey?: string;
  instruction?: string;
  reason?: string;
}

type RegenerateFailureReason = Extract<
  RegenerateOutcome,
  { ok: false }
>["reason"];

function statusForFailure(reason: RegenerateFailureReason): number {
  if (reason === "claude-cli-missing" || reason === "unsupported-platform") {
    return 503;
  }
  if (reason === "no-script") {
    return 404;
  }
  return 500;
}

function isPartKey(value: unknown): value is PartKey {
  return (
    typeof value === "string" && VALID_PART_KEYS.has(value as PartKey)
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: RegenerateBody;
    try {
      body = (await req.json()) as RegenerateBody;
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

    const partKey = body.partKey;
    if (!isPartKey(partKey)) {
      return NextResponse.json(
        { ok: false, error: "partKey must be one of p1, p2, p3, p4" },
        { status: 400 }
      );
    }

    const instruction = (body.instruction ?? "").trim();
    if (instruction.length === 0) {
      return NextResponse.json(
        { ok: false, error: "instruction is required" },
        { status: 400 }
      );
    }

    const reason = (body.reason ?? "").trim();
    if (reason.length === 0) {
      return NextResponse.json(
        { ok: false, error: "reason is required" },
        { status: 400 }
      );
    }

    let outcome: RegenerateOutcome;
    try {
      outcome = await withEpisodeLock(episodeId, () =>
        regeneratePart({
          episodeId,
          partKey,
          instruction,
          reason,
        })
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
        snapshotPath: outcome.snapshotPath,
        diff: outcome.diff,
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
      "[POST /api/creator/youtube/script/regenerate-part] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
