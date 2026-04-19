import { NextRequest, NextResponse } from "next/server";
import {
  createInvite,
  listInvitesWithSubmissions,
} from "@/lib/diagnostic/store";

export async function GET() {
  try {
    const invites = listInvitesWithSubmissions();
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("[diagnostic/invites GET]", error);
    return NextResponse.json(
      { error: "Failed to load invites" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      learnerName?: string;
      email?: string;
      note?: string;
    };

    const invite = createInvite({
      learnerName: typeof body.learnerName === "string" ? body.learnerName.trim() || undefined : undefined,
      email: typeof body.email === "string" ? body.email.trim() || undefined : undefined,
      note: typeof body.note === "string" ? body.note.trim() || undefined : undefined,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("[diagnostic/invites POST]", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
