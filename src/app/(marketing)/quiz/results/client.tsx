"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlacementResults } from "@/components/quizzes/placement-results";
import type { AssessmentQuizKind } from "@/types/assessment";
import { loadLatestHistoryForQuiz } from "@/lib/quiz/persistence";
import { getQuestionsByIds } from "@/lib/quiz/question-banks";
import { buildPlacementRecommendation, scoreAssessment } from "@/lib/quiz/scoring";
import { shouldShowLearnerTransliteration } from "@/lib/quiz/display";
import type { PlacementRecommendationMap } from "@/lib/quiz/lesson-recommendations";

interface QuizResultsClientProps {
  recommendationMap: PlacementRecommendationMap;
}

function parseQuizKind(kind: string | null): AssessmentQuizKind {
  if (kind === "tones") {
    return "tones";
  }

  if (kind === "reader_tones" || kind === "reader-tones") {
    return "reader_tones";
  }

  return "placement";
}

function QuizResultsContent({ recommendationMap }: QuizResultsClientProps) {
  const searchParams = useSearchParams();
  const quizKind = parseQuizKind(searchParams.get("kind"));

  const latest = useMemo(() => loadLatestHistoryForQuiz(quizKind), [quizKind]);

  if (!latest) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card>
          <CardContent className="py-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              No {quizKind} result found yet.
            </p>
            <Link href={quizKind === "placement" ? "/quiz" : `/quiz/${quizKind === "tones" ? "tones" : "reader-tones"}`}>
              <Button>Take Quiz</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = getQuestionsByIds(quizKind, latest.attempt.questionIds);
  const summary = scoreAssessment(questions, latest.attempt.answers);
  const showLearnerTranslit = shouldShowLearnerTransliteration(
    quizKind,
    latest.attempt.track
  );

  if (quizKind === "placement") {
    const recommendation = buildPlacementRecommendation(summary, recommendationMap);
    const missedQuestions = questions.filter((question) =>
      summary.missedQuestionIds.includes(question.id)
    );

    return (
      <div className="max-w-4xl mx-auto py-10">
        <PlacementResults
          summary={summary}
          recommendation={recommendation}
          missedQuestions={missedQuestions}
          showLearnerTranslit={showLearnerTranslit}
        />
      </div>
    );
  }

  const missedQuestions = questions.filter((question) =>
    summary.missedQuestionIds.includes(question.id)
  );

  const retakeHref =
    quizKind === "tones" ? "/quiz/tones" : "/quiz/reader-tones";

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {quizKind === "tones"
              ? "Tone Recognition Result"
              : "Reader Tone + Script Result"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Score: <span className="font-semibold text-foreground">{summary.score}%</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Answered: {summary.answeredCount}/{summary.totalCount}
          </p>
          <p className="text-sm text-muted-foreground">
            Confidence: {summary.confidence}
          </p>
          <p className="text-sm text-muted-foreground">
            You chose &quot;I don&apos;t know&quot; {summary.totalIdk}{" "}
            {summary.totalIdk === 1 ? "time" : "times"}.
          </p>
          {summary.completionPercent < 100 && (
            <p className="text-xs text-accent">
              Advisory result from partial completion.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missed Items</CardTitle>
        </CardHeader>
        <CardContent>
          {missedQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No misses in answered items.</p>
          ) : (
            <ul className="space-y-2">
              {missedQuestions.map((question) => (
                <li key={question.id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{question.id}</span>
                  {" "}- {question.thai}
                  {showLearnerTranslit ? ` (${question.translit})` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href={retakeHref}>
          <Button variant="outline">Retake Quiz</Button>
        </Link>
        {quizKind === "tones" && (
          <Link href="/quiz/reader-tones">
            <Button>Take Reader Tone + Script Quiz</Button>
          </Link>
        )}
        <Link href="/quiz">
          <Button variant="ghost">Back to Placement Quiz</Button>
        </Link>
      </div>
    </div>
  );
}

export function QuizResultsClient({ recommendationMap }: QuizResultsClientProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto py-10">
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading results...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <QuizResultsContent recommendationMap={recommendationMap} />
    </Suspense>
  );
}
