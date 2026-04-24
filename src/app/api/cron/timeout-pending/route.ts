import { NextResponse } from "next/server";

// Vercel cron runs in UTC.
export async function GET() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
