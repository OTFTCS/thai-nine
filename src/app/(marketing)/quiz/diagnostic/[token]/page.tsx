import { notFound } from "next/navigation";
import { getInviteByToken } from "@/lib/diagnostic/store";
import { DiagnosticQuizClient } from "./client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DiagnosticQuizPage({ params }: Props) {
  const { token } = await params;
  const invite = getInviteByToken(token);

  if (!invite) {
    notFound();
  }

  if (invite.status === "completed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 space-y-4 text-center">
          <p className="text-4xl">✓</p>
          <h1 className="text-xl font-bold text-foreground">Already submitted</h1>
          <p className="text-sm text-muted-foreground">
            {invite.learnerName ? `${invite.learnerName}, your` : "Your"} diagnostic is complete.
            Your teacher will review the results before your session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <DiagnosticQuizClient token={token} learnerName={invite.learnerName} />
      </div>
    </div>
  );
}
