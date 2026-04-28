import Link from "next/link";
import { notFound } from "next/navigation";
import { getInviteByToken, getSubmissionByToken } from "@/lib/diagnostic/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DiagnosticSubmissionPage({ params }: Props) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) notFound();

  const submission = invite.status === "completed" ? await getSubmissionByToken(token) : null;

  if (!submission) {
    return (
      <div className="space-y-4">
        <Link href="/admin/quizzes">
          <Button variant="ghost" size="sm">
            &larr; Back to Quizzes
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              No submission yet for this invite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lessonBrief } = submission;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/quizzes">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {invite.learnerName ?? "Unnamed learner"} — Diagnostic Result
          </h1>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(submission.submittedAt).toLocaleString()}
            {invite.email ? ` · ${invite.email}` : ""}
          </p>
        </div>
      </div>

      {/* Score summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Estimated Band", value: submission.band, accent: true },
          { label: "Score", value: `${submission.score}%` },
          { label: "Confidence", value: submission.confidence },
          {
            label: "Completion",
            value: `${submission.completionPercent}%`,
          },
        ].map(({ label, value, accent }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Topic breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {submission.topicResults
              .sort((a, b) => a.score - b.score)
              .map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground capitalize">
                    {t.topic.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.score >= 70 ? "bg-green-500" : t.score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${t.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-10 text-right">
                    {t.score}%
                  </span>
                  <span className="text-xs text-muted-foreground w-28 shrink-0">
                    {t.correct}✓ {t.wrong}✗ {t.idk} IDK
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Lesson brief */}
      <Card>
        <CardHeader>
          <CardTitle>Lesson Brief</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date(lessonBrief.generatedAt).toLocaleString()}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strengths
              </p>
              <ul className="space-y-1">
                {lessonBrief.strengths.map((s) => (
                  <li key={s} className="text-sm text-foreground">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Priority Gaps
              </p>
              <ul className="space-y-1">
                {lessonBrief.priorityGaps.map((s) => (
                  <li key={s} className="text-sm text-foreground">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Teach First
            </p>
            <ul className="space-y-1.5">
              {lessonBrief.teachFirst.map((s, i) => (
                <li key={i} className="text-sm text-foreground leading-relaxed">
                  {i + 1}. {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Avoid For Now
            </p>
            <ul className="space-y-1.5">
              {lessonBrief.avoidForNow.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {i + 1}. {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              60-Minute Lesson Plan
            </p>
            {lessonBrief.lessonPlan.map((block, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">
                    {block.timeMinutes} min
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {block.activity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{block.focus}</p>
                {block.quickCheck && (
                  <p className="text-xs text-accent italic">
                    Quick check: {block.quickCheck}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick Checks
            </p>
            <ul className="space-y-1.5">
              {lessonBrief.quickChecks.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
