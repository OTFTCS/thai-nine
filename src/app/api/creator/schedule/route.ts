import { NextResponse } from "next/server";
import {
  listScheduledPosts,
  schedulePost,
  type ScheduleInput,
} from "@/lib/creator/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await listScheduledPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  let body: ScheduleInput;
  try {
    body = (await request.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.title !== "string" ||
    !Array.isArray(body.platforms) ||
    typeof body.caption !== "string" ||
    typeof body.scheduledFor !== "string"
  ) {
    return NextResponse.json(
      { error: "title, platforms[], caption, scheduledFor are required" },
      { status: 400 }
    );
  }

  const due = new Date(body.scheduledFor);
  if (Number.isNaN(due.getTime())) {
    return NextResponse.json(
      { error: "scheduledFor must be an ISO datetime" },
      { status: 400 }
    );
  }

  const post = await schedulePost(body);
  return NextResponse.json({ ok: true, post });
}
