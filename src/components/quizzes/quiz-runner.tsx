"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentQuestion,
  AssessmentQuizKind,
  LearnerTrack,
} from "@/types/assessment";
import {
  clearAttempt,
  createAttempt,
  loadAttemptState,
  saveAttempt,
  saveHistoryRecord,
} from "@/lib/quiz/persistence";
import { QuizAudioPlayer } from "@/components/quizzes/quiz-audio-player";
import {
  shouldShowAudioPromptThai,
  shouldShowLearnerTransliteration,
} from "@/lib/quiz/display";

interface QuizRunnerProps {
  quizKind: AssessmentQuizKind;
  title: string;
  description: string;
  questionBank: AssessmentQuestion[];
  resultHref: string;
  requireTrackSelection?: boolean;
  defaultTrack?: LearnerTrack;
  resolveQuestionIds?: (track?: LearnerTrack) => string[];
  minimumAnswersForAdvisory?: number;
}

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

export function QuizRunner({
  quizKind,
  title,
  description,
  questionBank,
  resultHref,
  requireTrackSelection,
  defaultTrack,
  resolveQuestionIds,
  minimumAnswersForAdvisory = 6,
}: QuizRunnerProps) {
  const router = useRouter();
  const questionStartedAtMs = useRef<number>(0);

  const questionLookup = useMemo(
    () => Object.fromEntries(questionBank.map((question) => [question.id, question])),
    [questionBank]
  );

  const resolveQuestionsFromTrack = useCallback(
    (track?: LearnerTrack) => {
      const questionIds =
        resolveQuestionIds?.(track) ?? questionBank.map((question) => question.id);

      return questionIds
        .map((questionId) => questionLookup[questionId])
        .filter((question): question is AssessmentQuestion => Boolean(question));
    },
    [questionBank, questionLookup, resolveQuestionIds]
  );

  const initialLoad = useMemo(() => loadAttemptState(quizKind), [quizKind]);

  const [migrationNotice, setMigrationNotice] = useState<string | null>(
    initialLoad.notice || null
  );

  const [attempt, setAttempt] = useState(() => {
    if (initialLoad.attempt) {
      return initialLoad.attempt;
    }

    if (requireTrackSelection) {
      return null;
    }

    const questions = resolveQuestionsFromTrack(defaultTrack);
    const nextAttempt = createAttempt(quizKind, questions, defaultTrack);
    saveAttempt(nextAttempt);
    return nextAttempt;
  });

  const [restoredProgress, setRestoredProgress] = useState(() =>
    Boolean(initialLoad.attempt && !initialLoad.attempt.completedAt)
  );

  const questions = useMemo(() => {
    if (!attempt) {
      return [];
    }

    return attempt.questionIds
      .map((questionId) => questionLookup[questionId])
      .filter((question): question is AssessmentQuestion => Boolean(question));
  }, [attempt, questionLookup]);

  const currentQuestion =
    attempt && questions.length > 0 ? questions[attempt.currentIndex] : undefined;

  const answeredCount = attempt ? Object.keys(attempt.answers).length : 0;

  useEffect(() => {
    if (currentQuestion) {
      questionStartedAtMs.current =
        typeof window !== "undefined" ? window.performance.now() : 0;
    }
  }, [currentQuestion]);

  const startNewAttempt = useCallback(
    (track?: LearnerTrack) => {
      const nextTrack = track || defaultTrack;
      const selectedQuestions = resolveQuestionsFromTrack(nextTrack);
      const nextAttempt = createAttempt(quizKind, selectedQuestions, nextTrack);
      saveAttempt(nextAttempt);
      setAttempt(nextAttempt);
      setMigrationNotice(null);
      setRestoredProgress(false);
    },
    [defaultTrack, quizKind, resolveQuestionsFromTrack]
  );

  const updateAttempt = (
    updater: (prev: NonNullable<typeof attempt>) => NonNullable<typeof attempt>
  ) => {
    if (!attempt) {
      return;
    }

    const next = updater(attempt);
    saveAttempt(next);
    setAttempt(next);
  };

  const incrementReplay = () => {
    if (!attempt || !currentQuestion) {
      return;
    }

    updateAttempt((prev) => ({
      ...prev,
      replayCounts: {
        ...prev.replayCounts,
        [currentQuestion.id]: (prev.replayCounts[currentQuestion.id] || 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectChoice = (choiceId: string, interactionTimestamp: number) => {
    if (!attempt || !currentQuestion) {
      return;
    }

    const existingAnswer = attempt.answers[currentQuestion.id];
    const elapsed = Math.max(300, interactionTimestamp - questionStartedAtMs.current);

    updateAttempt((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          answerType: "choice",
          selectedChoiceId: choiceId,
          isCorrect: choiceId === currentQuestion.correctChoiceId,
          timeToAnswerMs: existingAnswer?.timeToAnswerMs ?? elapsed,
          replayCount:
            prev.replayCounts[currentQuestion.id] ?? existingAnswer?.replayCount ?? 0,
          answeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectIdk = (interactionTimestamp: number) => {
    if (!attempt || !currentQuestion) {
      return;
    }

    const existingAnswer = attempt.answers[currentQuestion.id];
    const elapsed = Math.max(300, interactionTimestamp - questionStartedAtMs.current);

    updateAttempt((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          answerType: "idk",
          selectedChoiceId: null,
          isCorrect: false,
          timeToAnswerMs: existingAnswer?.timeToAnswerMs ?? elapsed,
          replayCount:
            prev.replayCounts[currentQuestion.id] ?? existingAnswer?.replayCount ?? 0,
          answeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const completeAttempt = (advisory: boolean) => {
    if (!attempt) {
      return;
    }

    const completedAttempt = {
      ...attempt,
      completedAt: new Date().toISOString(),
      advisory,
      updatedAt: new Date().toISOString(),
    };

    saveAttempt(completedAttempt);
    saveHistoryRecord({ attempt: completedAttempt });
    setAttempt(completedAttempt);

    router.push(`${resultHref}?kind=${quizKind}`);
  };

  const goPrev = () => {
    if (!attempt || attempt.currentIndex === 0) {
      return;
    }

    updateAttempt((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
      updatedAt: new Date().toISOString(),
    }));
  };

  const goNext = () => {
    if (!attempt || !currentQuestion || !attempt.answers[currentQuestion.id]) {
      return;
    }

    if (attempt.currentIndex >= questions.length - 1) {
      completeAttempt(false);
      return;
    }

    updateAttempt((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      updatedAt: new Date().toISOString(),
    }));
  };

  const resetAttempt = () => {
    clearAttempt(quizKind);
    if (requireTrackSelection) {
      setAttempt(null);
    } else {
      startNewAttempt(defaultTrack);
    }
    setMigrationNotice(null);
    setRestoredProgress(false);
  };

  if (!attempt?.completedAt && requireTrackSelection && !attempt) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              Choose your track so we can branch the quiz early.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={() => startNewAttempt("reader")}>
                Reader track (I can read Thai script)
              </Button>
              <Button variant="outline" onClick={() => startNewAttempt("non_reader")}>
                Non-reader track (I rely on transliteration)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (attempt?.completedAt) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your latest attempt is complete. Review the results or start a fresh run.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => router.push(`${resultHref}?kind=${quizKind}`)}>
                View Latest Results
              </Button>
              <Button variant="outline" onClick={resetAttempt}>
                Start New Attempt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!attempt || !currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Unable to load quiz questions. Try restarting your attempt.
            </p>
            <Button className="mt-4" onClick={resetAttempt}>
              Restart
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedAnswer = attempt.answers[currentQuestion.id];
  const selectedChoiceId = selectedAnswer?.selectedChoiceId;
  const isIdkSelected = selectedAnswer?.answerType === "idk";
  const replayCount = attempt.replayCounts[currentQuestion.id] || 0;
  const isLast = attempt.currentIndex === questions.length - 1;
  const activeTrack = attempt.track || defaultTrack;
  const showLearnerTranslit = shouldShowLearnerTransliteration(
    quizKind,
    activeTrack
  );
  const showPromptThai = shouldShowAudioPromptThai(quizKind);

  const orderedChoiceIds =
    attempt.choiceOrderByQuestion[currentQuestion.id] ||
    currentQuestion.choices.map((choice) => choice.id);
  const orderedChoices = orderedChoiceIds
    .map((choiceId) =>
      currentQuestion.choices.find((choice) => choice.id === choiceId)
    )
    .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {restoredProgress && (
          <p className="text-xs text-primary">
            Resumed from saved progress. You can leave and return later.
          </p>
        )}
        {migrationNotice && (
          <p className="text-xs text-accent">{migrationNotice}</p>
        )}
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
              style={{ width: `${((attempt.currentIndex + 1) / questions.length) * 100}%` }}
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
                    onClick={(event) => selectChoice(choice.id, event.timeStamp)}
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
                onClick={(event) => selectIdk(event.timeStamp)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  isIdkSelected
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium text-foreground">I don&apos;t know</p>
                <p className="text-xs text-muted-foreground">Skip guessing and mark this as a gap.</p>
              </button>
            </div>
          </div>

          {attempt.answers[currentQuestion.id] && (
            <p className="text-xs text-muted-foreground">
              Time to answer: {formatDuration(attempt.answers[currentQuestion.id].timeToAnswerMs)}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-between pt-2">
            <div className="flex gap-3">
              <Button variant="outline" onClick={goPrev} disabled={attempt.currentIndex === 0}>
                Previous
              </Button>
              <Button onClick={goNext} disabled={!attempt.answers[currentQuestion.id]}>
                {isLast ? "Finish Quiz" : "Next"}
              </Button>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => completeAttempt(true)}
                disabled={answeredCount < minimumAnswersForAdvisory}
              >
                Get Advisory Result Now
              </Button>
              <Button variant="ghost" onClick={resetAttempt}>
                Start Over
              </Button>
            </div>
          </div>
          {answeredCount < minimumAnswersForAdvisory && (
            <p className="text-xs text-muted-foreground">
              Answer at least {minimumAnswersForAdvisory} questions to unlock advisory results.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
