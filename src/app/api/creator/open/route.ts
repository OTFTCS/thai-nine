import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { isPathAllowed } from "@/lib/creator/path-safety";

export { isPathAllowed };

export const dynamic = "force-dynamic";

function runOpen(argv: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("open", argv, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function POST(req: Request) {
  const REPO_ROOT = path.resolve(process.cwd());
  let body: { path?: string; reveal?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json body" },
      { status: 400 }
    );
  }
  const raw = body.path ?? "";
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "path missing" },
      { status: 400 }
    );
  }
  if (!isPathAllowed(raw, REPO_ROOT)) {
    return NextResponse.json(
      { ok: false, error: "path outside repo root" },
      { status: 400 }
    );
  }
  const resolved = path.resolve(raw);
  try {
    await runOpen(body.reveal ? ["-R", resolved] : [resolved]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
