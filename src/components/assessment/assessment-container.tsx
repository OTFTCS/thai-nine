"use client";

import { useState } from "react";
import type { AssessmentQuiz } from "@/types/assessment";
import { useAssessment } from "@/hooks/use-assessment";
import { AssessmentQuestion } from "./assessment-question";
import { AssessmentResults } from "./assessment-results";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

interface AssessmentContainerProps {
  quiz: AssessmentQuiz;
}

export function AssessmentContainer({ quiz }: AssessmentContainerProps) {
  const {
    session,
    currentQuestion,
    currentIndex,
    totalQuestions,
    progressPercent,
    isComplete,
    result,
    start,
    answer,
    goBack,
    canGoBack,
    abandon,
    retake,
    hasResumableSession,
  } = useAssessment(quiz);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // ── Not started / Resume prompt ───────────────────────────────────────────

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8">
        <div className="text-5xl mb-6" aria-hidden="true">
          {quiz.kind === "placement" && "🎯"}
          {quiz.kind === "tone" && "🎵"}
          {quiz.kind === "reader-tones" && "📖"}
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {quiz.title}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {quiz.instructions}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={start} size="lg">
            {hasResumableSession ? "Resume Quiz" : "Start Quiz"}
          </Button>
          {hasResumableSession && (
            <Button
              variant="outline"
              onClick={() => {
                abandon();
                // Small delay so state clears, then start fresh
                setTimeout(start, 50);
              }}
            >
              Start Over
            </Button>
          )}
        </div>

        <div className="mt-8 text-left max-w-md mx-auto">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            What to expect:
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              {quiz.questions.length} questions across{" "}
              {quiz.sections.length} sections
            </li>
            {quiz.kind === "placement" && (
              <li>
                Your answers determine your starting lesson
              </li>
            )}
            {quiz.ctaThresholdPercent && (
              <li>
                Score {quiz.ctaThresholdPercent}%+ to unlock tone lessons
              </li>
            )}
            <li>You can go back to previous questions</li>
            <li>Your progress is saved automatically</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Completed — show results ──────────────────────────────────────────────

  if (isComplete && result) {
    return (
      <AssessmentResults
        quiz={quiz}
        result={result}
        session={session}
        onRetake={retake}
      />
    );
  }

  // ── In progress ───────────────────────────────────────────────────────────

  if (!currentQuestion) return null;

  // Check if the current question has been previously answered (going back)
  const previousAnswer = session.answers.find(
    (a) => a.questionId === currentQuestion.id,
  );
  const effectiveSelection = selectedOption ?? previousAnswer?.selectedOptionId ?? null;

  const handleAnswer = () => {
    if (!effectiveSelection) return;
    answer(effectiveSelection);
    setSelectedOption(null);
  };

  const handleGoBack = () => {
    setSelectedOption(null);
    goBack();
  };

  // Find the current section for display
  const currentSection = quiz.sections.find(
    (s) => s.id === currentQuestion.sectionId,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wider">
              {currentSection?.title}
            </p>
            <p className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {totalQuestions}
            </p>
          </div>
          <button
            onClick={abandon}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Abandon quiz"
          >
            Exit
          </button>
        </div>
        <ProgressBar value={progressPercent} />

        {/* Question dots */}
        <div className="flex gap-1 flex-wrap" aria-hidden="true">
          {session.questionPath.map((qId, i) => {
            const wasAnswered = session.answers.some(
              (a) => a.questionId === qId,
            );
            return (
              <div
                key={qId}
                className={cn(
                  "w-6 h-1.5 rounded-full transition-colors",
                  i === currentIndex
                    ? "bg-primary"
                    : wasAnswered
                      ? "bg-primary/40"
                      : "bg-muted",
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Question */}
      <AssessmentQuestion
        question={currentQuestion}
        selectedOptionId={effectiveSelection ?? undefined}
        onSelect={setSelectedOption}
      />

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleGoBack}
          disabled={!canGoBack}
        >
          Previous
        </Button>
        <Button
          onClick={handleAnswer}
          disabled={!effectiveSelection}
        >
          {currentIndex === totalQuestions - 1 ? "Submit" : "Next"}
        </Button>
      </div>
    </div>
  );
}
