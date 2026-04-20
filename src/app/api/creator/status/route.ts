import { NextResponse } from "next/server";
import {
  getTracker,
  invalidateTrackerCache,
  patchImageCarouselRow,
  patchSocialsRow,
  readTracker,
} from "@/lib/creator/tracker-xlsx";

export const dynamic = "force-dynamic";

type Kind = "tiktok" | "youtube" | "carousel" | "social";

interface StatusPatchBody {
  kind: Kind;
  id: string;
  rowIndex?: number;
  status: string;
}

function parseId(id: string): {
  series?: string;
  epNum?: number;
  slug?: string;
  raw: string;
} {
  const parts = id.split("::");
  if (parts.length >= 3) {
    return {
      series: parts[0],
      epNum: Number(parts[1]),
      slug: parts.slice(2).join("::"),
      raw: id,
    };
  }
  return { raw: id };
}

async function findSocialRowIndexForTikTok(
  id: string
): Promise<number | null> {
  const { series, epNum, slug } = parseId(id);
  if (!series || !epNum || !slug) return null;
  const snapshot = await getTracker();
  const categoryMatch = /classifiers/i.test(series)
    ? "thai classifiers"
    : series.toLowerCase();
  const epTag = `EP${String(epNum).padStart(2, "0")}`;
  const match = snapshot.socials.find(
    (row) =>
      row.kind === "data" &&
      row.category.toLowerCase().includes(categoryMatch) &&
      (row.title.toLowerCase().includes(slug.toLowerCase()) ||
        row.title.includes(epTag))
  );
  return match?.rowIndex ?? null;
}

async function findSocialRowIndexForYouTube(
  id: string
): Promise<number | null> {
  const snapshot = await getTracker();
  const match = snapshot.socials.find(
    (row) =>
      row.kind === "data" &&
      (row.title.includes(id) || row.link.includes(id))
  );
  return match?.rowIndex ?? null;
}

async function findCarouselRowIndex(id: string): Promise<number | null> {
  const snapshot = await getTracker();
  const lower = id.toLowerCase();
  const match = snapshot.imageCarousels.find((row) => {
    const topic = row.topic.toLowerCase();
    return (
      topic === lower ||
      lower.includes(topic) ||
      topic.includes(lower.replace(/-carousel.*$/, ""))
    );
  });
  return match?.rowIndex ?? null;
}

export async function PATCH(request: Request) {
  let body: StatusPatchBody;
  try {
    body = (await request.json()) as StatusPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.kind || !body.id || typeof body.status !== "string") {
    return NextResponse.json(
      { error: "kind, id, and status are required" },
      { status: 400 }
    );
  }

  try {
    invalidateTrackerCache();

    if (body.kind === "social") {
      if (typeof body.rowIndex !== "number") {
        return NextResponse.json(
          { error: "rowIndex is required for kind=social" },
          { status: 400 }
        );
      }
      await patchSocialsRow(body.rowIndex, { status: body.status });
    } else if (body.kind === "carousel") {
      const rowIndex =
        body.rowIndex ?? (await findCarouselRowIndex(body.id));
      if (!rowIndex) {
        return NextResponse.json(
          {
            error: `No Image Carousels row for '${body.id}'. Add one on the Tracker page first.`,
          },
          { status: 404 }
        );
      }
      await patchImageCarouselRow(rowIndex, { status: body.status });
    } else if (body.kind === "tiktok") {
      const rowIndex =
        body.rowIndex ?? (await findSocialRowIndexForTikTok(body.id));
      if (!rowIndex) {
        return NextResponse.json(
          {
            error: `No Socials row for TikTok episode '${body.id}'. Add one on the Tracker page first.`,
          },
          { status: 404 }
        );
      }
      await patchSocialsRow(rowIndex, { status: body.status });
    } else if (body.kind === "youtube") {
      const rowIndex =
        body.rowIndex ?? (await findSocialRowIndexForYouTube(body.id));
      if (!rowIndex) {
        return NextResponse.json(
          {
            error: `No Socials row for YouTube episode '${body.id}'. Add one on the Tracker page first.`,
          },
          { status: 404 }
        );
      }
      await patchSocialsRow(rowIndex, { status: body.status });
    } else {
      return NextResponse.json(
        { error: `Unsupported kind: ${body.kind}` },
        { status: 400 }
      );
    }

    const snapshot = await readTracker();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
