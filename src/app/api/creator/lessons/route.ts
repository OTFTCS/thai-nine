import { NextResponse } from "next/server";
import { readLessons } from "@/lib/creator/lessons";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readLessons();
  return NextResponse.json({ rows });
}
