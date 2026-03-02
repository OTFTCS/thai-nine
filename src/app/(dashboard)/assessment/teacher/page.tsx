"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { assessmentQuizzes } from "@/lib/assessment-data";
import { loadResult, loadHistory } from "@/lib/assessment-persistence";
import { TeacherPanel } from "@/components/assessment";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AssessmentResult, AssessmentSession } from "@/types/assessment";

export default function TeacherDashboardPage() {
  const [results, setResults] = useState<
    Array<{
      result: AssessmentResult;
      session: AssessmentSession;
      quizTitle: string;
    }>
  >([]);
  const [selectedResult, setSelectedResult] = useState<{
    result: AssessmentResult;
    session: AssessmentSession;
  } | null>(null);

  useEffect(() => {
    const loaded: typeof results = [];

    for (const quiz of Object.values(assessmentQuizzes)) {
      const history = loadHistory(quiz.kind, quiz.id);
      for (const result of history) {
        // Reconstruct a minimal session from the result for the teacher panel
        const session: AssessmentSession = {
          sessionId: result.sessionId,
          quizId: result.quizId,
          kind: result.kind,
          status: "completed",
          answers: [], // Teacher panel doesn't need full answers for notes
          currentQuestionIndex: 0,
          questionPath: quiz.questions.map((q) => q.id),
          startedAt: result.completedAt,
          completedAt: result.completedAt,
          updatedAt: result.completedAt,
        };
        loaded.push({
          result,
          session,
          quizTitle: quiz.title,
        });
      }
    }

    setResults(loaded);
  }, []);

  if (selectedResult) {
    const quiz = assessmentQuizzes[selectedResult.result.quizId];
    if (!quiz) return null;

    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        <button
          onClick={() => setSelectedResult(null)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Teacher Dashboard
        </button>

        <TeacherPanel
          result={selectedResult.result}
          session={selectedResult.session}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl" aria-hidden="true">
            👩‍🏫
          </span>
          <h1 className="text-2xl font-bold text-foreground">
            Nine&apos;s Teacher Dashboard
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review learner assessments, add notes, and override placements.
        </p>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No completed assessments yet.
            </p>
            <Link href="/assessment/placement">
              <Button variant="outline">Take Placement Quiz</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map(({ result, session, quizTitle }) => (
            <Card
              key={result.sessionId}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedResult({ result, session })}
            >
              <CardHeader>
                <CardTitle className="text-base">{quizTitle}</CardTitle>
                <CardDescription>
                  Score: {Math.round(result.overallScore)}% | Confidence:{" "}
                  {result.confidence.level} | Placement:{" "}
                  {result.placementBand?.label ?? "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Completed:{" "}
                  {new Date(result.completedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
