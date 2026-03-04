import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken, getSubmissionByToken } from "@/lib/diagnostic/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invite = getInviteByToken(token);

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const submission =
      invite.status === "completed" ? getSubmissionByToken(token) : null;

    return NextResponse.json({ invite, submission });
  } catch (error) {
    console.error("[diagnostic/invites/[token] GET]", error);
    return NextResponse.json(
      { error: "Failed to load invite" },
      { status: 500 }
    );
  }
}
