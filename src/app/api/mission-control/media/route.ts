import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ALLOWED_BASES = [
  path.join(ROOT, "thaiwith-nine-remotion", "out"),
  path.join(ROOT, "course"),
];

function resolveCandidates(relPath: string) {
  const cleaned = relPath.replace(/^\/+/, "");
  const out: string[] = [];

  for (const base of ALLOWED_BASES) {
    const resolved = path.resolve(base, cleaned);
    if (resolved.startsWith(base)) out.push(resolved);
  }

  if (out.length === 0) throw new Error("Blocked path");
  return out;
}

function contentTypeFor(file: string) {
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".mov")) return "video/quicktime";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (file.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  try {
    const candidates = resolveCandidates(rel);
    let fullPath: string | null = null;

    for (const c of candidates) {
      try {
        await fs.access(c);
        fullPath = c;
        break;
      } catch {
        // try next candidate
      }
    }

    if (!fullPath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const stat = await fs.stat(fullPath);
    const total = stat.size;
    const range = req.headers.get("range");
    const contentType = contentTypeFor(fullPath);

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : total - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }

      const file = await fs.open(fullPath, "r");
      const chunkSize = end - start + 1;
      const buffer = Buffer.alloc(chunkSize);
      await file.read(buffer, 0, chunkSize, start);
      await file.close();

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(chunkSize),
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await fs.readFile(fullPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(total),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
