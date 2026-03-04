"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentAttempt,
  AssessmentQuestion,
  LearnerTrack,
} from "@/types/assessment";
import type { DiagnosticSubmission } from "@/types/diagnostic";
import {
  clearDiagnosticAttempt,
  createAttempt,
  loadDiagnosticAttempt,
  saveDiagnosticAttempt,
} from "@/lib/quiz/persistence";
import { QuizAudioPlayer } from "@/components/quizzes/quiz-audio-player";
import {
  shouldShowAudioPromptThai,
  shouldShowLearnerTransliteration,
} from "@/lib/quiz/display";

interface DiagnosticQuizRunnerProps {
  token: string;
  learnerName?: string;
  questionBank: AssessmentQuestion[];
  resolveQuestionIds: (track: LearnerTrack) => string[];
}

type Phase =
  | { kind: "track_select" }
  | { kind: "running"; attempt: AssessmentAttempt }
  | { kind: "submitting"; attempt: AssessmentAttempt }
  | { kind: "done"; submission: DiagnosticSubmission }
  | { kind: "error"; message: string };

function formatDuration(ms: number) {
  return `${Math.round(ms / 1000)}s`;
}

export function DiagnosticQuizRunner({
  token,
  learnerName,
  questionBank,
  resolveQuestionIds,
}: DiagnosticQuizRunnerProps) {
  const questionStartedAtMs = useRef<number>(0);

  const questionLookup = useMemo(
    () => Object.fromEntries(questionBank.map((q) => [q.id, q])),
    [questionBank]
  );

  const [phase, setPhase] = useState<Phase>(() => {
    // Try to restore an in-progress attempt from localStorage
    return { kind: "track_select" };
  });

  // Restore saved attempt on mount
  useEffect(() => {
    const saved = loadDiagnosticAttempt(token);
    if (saved && !saved.completedAt) {
      setPhase({ kind: "running", attempt: saved });
    }
  }, [token]);

  const startAttempt = useCallback(
    (track: LearnerTrack) => {
      const questionIds = resolveQuestionIds(track);
      const questions = questionIds
        .map((id) => questionLookup[id])
        .filter((q): q is AssessmentQuestion => Boolean(q));
      const attempt = createAttempt("placement", questions, track);
      saveDiagnosticAttempt(token, attempt);
      setPhase({ kind: "running", attempt });
    },
    [token, questionLookup, resolveQuestionIds]
  );

  const updateAttempt = useCallback(
    (updater: (prev: AssessmentAttempt) => AssessmentAttempt) => {
      setPhase((prev) => {
        if (prev.kind !== "running") return prev;
        const next = updater(prev.attempt);
        saveDiagnosticAttempt(token, next);
        return { kind: "running", attempt: next };
      });
    },
    [token]
  );

  const submitAttempt = useCallback(
    async (attempt: AssessmentAttempt) => {
      setPhase({ kind: "submitting", attempt });
      try {
        const res = await fetch("/api/diagnostic/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, attempt }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { submission: DiagnosticSubmission };
        clearDiagnosticAttempt(token);
        setPhase({ kind: "done", submission: json.submission });
      } catch (err) {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Submission failed",
        });
      }
    },
    [token]
  );

  if (phase.kind === "track_select") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Assessment{learnerName ? ` for ${learnerName}` : ""}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This is a short placement quiz (~10 min) so your teacher can plan your first lesson.
            Progress saves automatically — you can leave and return.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground font-medium">Can you read Thai script?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => startAttempt("reader")}>
              Yes — I can read Thai script
            </Button>
            <Button variant="outline" onClick={() => startAttempt("non_reader")}>
              No — I rely on transliteration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase.kind === "done") {
    const { submission } = phase;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Thanks{learnerName ? `, ${learnerName}` : ""}! Your results have been submitted.
            Your teacher will review them before your first session.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
            <p className="text-sm font-medium text-foreground">Your estimated level</p>
            <p className="text-2xl font-bold text-primary">{submission.band}</p>
            <p className="text-xs text-muted-foreground">
              Score: {submission.score}% &middot; Confidence: {submission.confidence}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            You can close this page. Your teacher has been notified.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase.kind === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{phase.message}</p>
          <Button
            onClick={() => {
              const saved = loadDiagnosticAttempt(token);
              if (saved) {
                void submitAttempt(saved);
              } else {
                setPhase({ kind: "track_select" });
              }
            }}
          >
            Retry Submission
          </Button>
        </CardContent>
      </Card>
    );
  }

  const attempt = phase.attempt;
  const questions = attempt.questionIds
    .map((id) => questionLookup[id])
    .filter((q): q is AssessmentQuestion => Boolean(q));

  const currentQuestion = questions[attempt.currentIndex];

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            {phase.kind === "submitting" ? "Submitting your results…" : "Loading quiz…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedAnswer = attempt.answers[currentQuestion.id];
  const selectedChoiceId = selectedAnswer?.selectedChoiceId;
  const isIdkSelected = selectedAnswer?.answerType === "idk";
  const replayCount = attempt.replayCounts[currentQuestion.id] || 0;
  const isLast = attempt.currentIndex === questions.length - 1;
  const answeredCount = Object.keys(attempt.answers).length;
  const activeTrack = attempt.track ?? "non_reader";
  const showLearnerTranslit = shouldShowLearnerTransliteration("placement", activeTrack);
  const showPromptThai = shouldShowAudioPromptThai("placement");

  const orderedChoiceIds =
    attempt.choiceOrderByQuestion[currentQuestion.id] ??
    currentQuestion.choices.map((c) => c.id);
  const orderedChoices = orderedChoiceIds
    .map((id) => currentQuestion.choices.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const incrementReplay = () => {
    updateAttempt((prev) => ({
      ...prev,
      replayCounts: {
        ...prev.replayCounts,
        [currentQuestion.id]: (prev.replayCounts[currentQuestion.id] || 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectChoice = (choiceId: string, ts: number) => {
    const existing = attempt.answers[currentQuestion.id];
    const elapsed = Math.max(300, ts - questionStartedAtMs.current);
    updateAttempt((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          answerType: "choice",
          selectedChoiceId: choiceId,
          isCorrect: choiceId === currentQuestion.correctChoiceId,
          timeToAnswerMs: existing?.timeToAnswerMs ?? elapsed,
          replayCount: prev.replayCounts[currentQuestion.id] ?? existing?.replayCount ?? 0,
          answeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectIdk = (ts: number) => {
    const existing = attempt.answers[currentQuestion.id];
    const elapsed = Math.max(300, ts - questionStartedAtMs.current);
    updateAttempt((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          answerType: "idk",
          selectedChoiceId: null,
          isCorrect: false,
          timeToAnswerMs: existing?.timeToAnswerMs ?? elapsed,
          replayCount: prev.replayCounts[currentQuestion.id] ?? existing?.replayCount ?? 0,
          answeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const goNext = () => {
    if (!attempt.answers[currentQuestion.id]) return;
    if (isLast) {
      const finalAttempt: AssessmentAttempt = {
        ...attempt,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      void submitAttempt(finalAttempt);
      return;
    }
    updateAttempt((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      updatedAt: new Date().toISOString(),
    }));
  };

  const goPrev = () => {
    if (attempt.currentIndex === 0) return;
    updateAttempt((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
      updatedAt: new Date().toISOString(),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          Diagnostic Assessment{learnerName ? ` — ${learnerName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Progress saves automatically. You can close this tab and return later.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Question {attempt.currentIndex + 1} of {questions.length}
            </p>
            <p className="text-xs text-muted-foreground">Answered: {answeredCount}</p>
          </div>

          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${((attempt.currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          <QuizAudioPlayer
            thai={currentQuestion.thai}
            translit={currentQuestion.translit}
            showThai={showPromptThai}
            showTranslit={showLearnerTranslit}
            audioSrc={currentQuestion.audioSrc}
            replayCount={replayCount}
            onReplay={incrementReplay}
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{currentQuestion.prompt}</p>
            <div className="space-y-2">
              {orderedChoices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={(e) => selectChoice(choice.id, e.timeStamp)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {choice.thai ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{choice.thai}</p>
                        {showLearnerTranslit && choice.translit && (
                          <p className="text-xs text-muted-foreground">{choice.translit}</p>
                        )}
                        {choice.english && (
                          <p className="text-xs text-muted-foreground">{choice.english}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{choice.english}</p>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={(e) => selectIdk(e.timeStamp)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  isIdkSelected
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium text-foreground">I don&apos;t know</p>
                <p className="text-xs text-muted-foreground">
                  Skip guessing and mark this as a gap.
                </p>
              </button>
            </div>
          </div>

          {selectedAnswer && (
            <p className="text-xs text-muted-foreground">
              Time to answer: {formatDuration(selectedAnswer.timeToAnswerMs)}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-between pt-2">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={attempt.currentIndex === 0 || phase.kind === "submitting"}
              >
                Previous
              </Button>
              <Button
                onClick={goNext}
                disabled={!attempt.answers[currentQuestion.id] || phase.kind === "submitting"}
              >
                {phase.kind === "submitting"
                  ? "Submitting…"
                  : isLast
                    ? "Submit Diagnostic"
                    : "Next"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
