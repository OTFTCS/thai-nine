import { NextRequest, NextResponse } from "next/server";
import { readMemory, writeMemory } from "@/lib/creator/writer-memory";

export const dynamic = "force-dynamic";

interface MemoryPutBody {
  body?: unknown;
}

export async function GET() {
  try {
    const body = readMemory();
    return NextResponse.json({ body });
  } catch (err) {
    console.error(
      "[GET /api/creator/youtube/script/memory] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    let payload: MemoryPutBody;
    try {
      payload = (await req.json()) as MemoryPutBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid json body" },
        { status: 400 }
      );
    }

    if (typeof payload.body !== "string") {
      return NextResponse.json(
        { ok: false, error: "body must be a string" },
        { status: 400 }
      );
    }

    writeMemory(payload.body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "[PUT /api/creator/youtube/script/memory] unexpected error",
      err
    );
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
