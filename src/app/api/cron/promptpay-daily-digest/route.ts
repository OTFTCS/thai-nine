import { NextResponse } from "next/server";

// Vercel cron runs in UTC. 9am BKK = 02:00 UTC.
export async function GET() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
