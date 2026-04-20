import { NextResponse } from "next/server";
import { readCarousels } from "@/lib/creator/carousels";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readCarousels();
  return NextResponse.json({ rows });
}
