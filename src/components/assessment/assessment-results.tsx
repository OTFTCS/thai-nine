"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  AssessmentQuiz,
  AssessmentResult,
  AssessmentSession,
} from "@/types/assessment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentQuestion } from "./assessment-question";

interface AssessmentResultsProps {
  quiz: AssessmentQuiz;
  result: AssessmentResult;
  session: AssessmentSession;
  onRetake: () => void;
}

export function AssessmentResults({
  quiz,
  result,
  session,
  onRetake,
}: AssessmentResultsProps) {
  const isPassed =
    quiz.passingScorePercent !== undefined
      ? result.overallScore >= quiz.passingScorePercent
      : true;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Score Hero ────────────────────────────────────────────────── */}
      <div className="text-center py-6">
        <div className="text-5xl mb-4" aria-hidden="true">
          {result.overallScore >= 70
            ? "🎉"
            : result.overallScore >= 40
              ? "👍"
              : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {quiz.kind === "placement"
            ? result.placementBand?.label ?? "Result"
            : isPassed
              ? "Great job!"
              : "Keep practicing!"}
        </h2>

        {/* Score circle */}
        <div
          className="w-28 h-28 rounded-full border-4 mx-auto flex items-center justify-center my-6"
          style={{
            borderColor:
              result.overallScore >= 70
                ? "var(--success)"
                : result.overallScore >= 40
                  ? "var(--primary)"
                  : "var(--accent)",
          }}
          role="img"
          aria-label={`Score: ${Math.round(result.overallScore)}%`}
        >
          <span className="text-3xl font-bold text-foreground">
            {Math.round(result.overallScore)}%
          </span>
        </div>

        {/* Placement description */}
        {result.placementBand && (
          <p className="text-muted-foreground max-w-md mx-auto">
            {result.placementBand.description}
          </p>
        )}

        {/* CTA threshold message (tone quiz) */}
        {result.passedCtaThreshold !== undefined && (
          <p
            className={cn(
              "text-sm mt-2",
              result.passedCtaThreshold
                ? "text-success"
                : "text-muted-foreground",
            )}
          >
            {result.passedCtaThreshold
              ? `You scored above ${quiz.ctaThresholdPercent}% — tone lessons unlocked!`
              : `Score ${quiz.ctaThresholdPercent}%+ to unlock tone-focused lessons.`}
          </p>
        )}
      </div>

      {/* ── Confidence Badge ──────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
            result.confidence.level === "high" &&
              "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
            result.confidence.level === "medium" &&
              "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
            result.confidence.level === "low" &&
              "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
          )}
          role="status"
          aria-label={`Confidence: ${result.confidence.level}`}
        >
          <span aria-hidden="true">
            {result.confidence.level === "high" && "●"}
            {result.confidence.level === "medium" && "●"}
            {result.confidence.level === "low" && "●"}
          </span>
          {result.confidence.level.charAt(0).toUpperCase() +
            result.confidence.level.slice(1)}{" "}
          confidence — {result.confidence.reason}
        </div>
      </div>

      {/* ── Section Breakdown ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Section Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {result.sectionScores.map((ss) => {
              const section = quiz.sections.find(
                (s) => s.id === ss.sectionId,
              );
              return (
                <div key={ss.sectionId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">
                      {section?.title ?? ss.sectionId}
                    </span>
                    <span className="text-muted-foreground">
                      {ss.correct}/{ss.total} ({Math.round(ss.rawPercent)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        ss.rawPercent >= 70
                          ? "bg-success"
                          : ss.rawPercent >= 40
                            ? "bg-primary"
                            : "bg-accent",
                      )}
                      style={{ width: `${ss.rawPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Topic Gaps ────────────────────────────────────────────────── */}
      {result.topicGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Areas to Focus On</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.topicGaps.map((gap) => (
                <li key={gap.tag} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs mt-0.5"
                    aria-hidden="true"
                  >
                    !
                  </span>
                  <div>
                    <p className="text-sm text-foreground font-medium">
                      {gap.tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Missed {gap.missedCount} of {gap.totalCount} question
                      {gap.totalCount !== 1 ? "s" : ""}
                    </p>
                    {gap.recommendedLessonIds.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {gap.recommendedLessonIds.map((lessonId) => (
                          <Link
                            key={lessonId}
                            href={`/lessons/${lessonId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {lessonId}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Recommendation CTA ────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <Link href={result.recommendedDeepLink}>
          <Button size="lg">
            {quiz.kind === "placement"
              ? `Start at ${result.placementBand?.label ?? "your level"}`
              : "Continue Learning"}
          </Button>
        </Link>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onRetake}>
            Retake Quiz
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* ── Review Answers ────────────────────────────────────────────── */}
      <div className="border-t border-border pt-8">
        <h3 className="text-lg font-semibold text-foreground mb-6">
          Review Your Answers
        </h3>
        <div className="space-y-6">
          {session.questionPath.map((qId) => {
            const question = quiz.questions.find((q) => q.id === qId);
            const answer = session.answers.find(
              (a) => a.questionId === qId,
            );
            if (!question) return null;
            return (
              <AssessmentQuestion
                key={qId}
                question={question}
                selectedOptionId={answer?.selectedOptionId}
                onSelect={() => {}}
                showResult
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
