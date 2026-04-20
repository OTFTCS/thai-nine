import { NextResponse } from "next/server";
import { patchSocialsRow, readTracker } from "@/lib/creator/tracker-xlsx";
import type { SocialsPatch } from "@/lib/creator/tracker-xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await readTracker();
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

interface TrackerPatchBody {
  sheet: "socials";
  rowIndex: number;
  patch: SocialsPatch;
}

export async function POST(request: Request) {
  let body: TrackerPatchBody;
  try {
    body = (await request.json()) as TrackerPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.sheet !== "socials") {
    return NextResponse.json(
      { error: `Unsupported sheet: ${body.sheet}` },
      { status: 400 }
    );
  }
  if (typeof body.rowIndex !== "number" || !body.patch) {
    return NextResponse.json(
      { error: "rowIndex (number) and patch are required" },
      { status: 400 }
    );
  }

  try {
    await patchSocialsRow(body.rowIndex, body.patch);
    const snapshot = await readTracker();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
