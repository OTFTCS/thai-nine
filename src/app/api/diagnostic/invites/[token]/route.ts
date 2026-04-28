import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/diagnostic/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({
      invite: {
        token: invite.token,
        learnerName: invite.learnerName,
        status: invite.status,
      },
      submission: null,
    });
  } catch (error) {
    console.error("[diagnostic/invites/[token] GET]", error);
    return NextResponse.json(
      { error: "Failed to load invite" },
      { status: 500 }
    );
  }
}
