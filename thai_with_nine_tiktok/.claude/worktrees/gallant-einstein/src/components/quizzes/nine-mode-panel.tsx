"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentAnswer,
  AssessmentHistoryRecord,
  NineModeReviewState,
  PlacementBand,
} from "@/types/assessment";
import {
  loadAssessmentHistory,
  loadNineModeReview,
  saveNineModeReview,
} from "@/lib/quiz/persistence";
import { getQuestionsByIds, topicLabelMap } from "@/lib/quiz/question-banks";
import {
  buildPlacementRecommendation,
  scoreAssessment,
} from "@/lib/quiz/scoring";
import { mockLessons } from "@/lib/mock-data";

const placementBands: PlacementBand[] = [
  "A1.0",
  "A1.1",
  "A1.2",
  "A2.0",
  "A2.1",
  "B1-ish",
];

function formatAttemptDate(date: string) {
  return new Date(date).toLocaleString();
}

function renderChoiceText(
  question: ReturnType<typeof getQuestionsByIds>[number],
  choiceId: string | undefined,
  answerType: AssessmentAnswer["answerType"]
) {
  if (answerType === "idk") {
    return "I don't know";
  }

  if (!choiceId || choiceId === "__idk__") {
    return "(no answer)";
  }

  const choice = question?.choices.find((item) => item.id === choiceId);

  if (!choice) {
    return "(choice not found)";
  }

  if (choice.thai) {
    return `${choice.thai}${choice.translit ? ` (${choice.translit})` : ""}`;
  }

  return choice.english || "(no label)";
}

export function NineModePanel() {
  const [history] = useState<AssessmentHistoryRecord[]>(() =>
    loadAssessmentHistory()
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    () => history[0]?.attempt.attemptId || null
  );
  const [draftReview, setDraftReview] = useState<
    Pick<NineModeReviewState, "notes" | "manualBandOverride" | "assignedLessonIds">
  >(() => {
    const attemptId = history[0]?.attempt.attemptId;

    if (!attemptId) {
      return {
        notes: "",
        manualBandOverride: undefined,
        assignedLessonIds: [],
      };
    }

    const existing = loadNineModeReview(attemptId);

    return {
      notes: existing?.notes || "",
      manualBandOverride: existing?.manualBandOverride,
      assignedLessonIds: existing?.assignedLessonIds || [],
    };
  });

  const selectedRecord = useMemo(
    () => history.find((record) => record.attempt.attemptId === selectedAttemptId) || null,
    [history, selectedAttemptId]
  );

  const selectAttempt = (attemptId: string) => {
    setSelectedAttemptId(attemptId);

    const existing = loadNineModeReview(attemptId);
    setDraftReview({
      notes: existing?.notes || "",
      manualBandOverride: existing?.manualBandOverride,
      assignedLessonIds: existing?.assignedLessonIds || [],
    });
  };

  const selectedMetrics = useMemo(() => {
    if (!selectedRecord) {
      return null;
    }

    const questions = getQuestionsByIds(
      selectedRecord.attempt.quizKind,
      selectedRecord.attempt.questionIds
    );

    const summary = scoreAssessment(questions, selectedRecord.attempt.answers);
    const placementRecommendation =
      selectedRecord.attempt.quizKind === "placement"
        ? buildPlacementRecommendation(summary)
        : null;

    const misses: Array<{
      question: (typeof questions)[number];
      answer: AssessmentAnswer;
      missType: "wrong" | "idk";
    }> = [];

    questions.forEach((question) => {
      const answer = selectedRecord.attempt.answers[question.id];
      if (answer && !answer.isCorrect) {
        misses.push({
          question,
          answer,
          missType: answer.answerType === "idk" ? "idk" : "wrong",
        });
      }
    });

    return {
      questions,
      summary,
      placementRecommendation,
      misses,
    };
  }, [selectedRecord]);

  const saveReview = () => {
    if (!selectedRecord) {
      return;
    }

    saveNineModeReview({
      attemptId: selectedRecord.attempt.attemptId,
      notes: draftReview.notes,
      manualBandOverride: draftReview.manualBandOverride,
      assignedLessonIds: draftReview.assignedLessonIds,
    });
  };

  const toggleLessonAssignment = (lessonId: string) => {
    setDraftReview((prev) => {
      const exists = prev.assignedLessonIds.includes(lessonId);
      return {
        ...prev,
        assignedLessonIds: exists
          ? prev.assignedLessonIds.filter((id) => id !== lessonId)
          : [...prev.assignedLessonIds, lessonId],
      };
    });
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            No assessment attempts yet. Complete a quiz to populate Nine mode.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((record) => {
            const questions = getQuestionsByIds(
              record.attempt.quizKind,
              record.attempt.questionIds
            );
            const summary = scoreAssessment(questions, record.attempt.answers);

            return (
              <button
                key={record.attempt.attemptId}
                type="button"
                onClick={() => selectAttempt(record.attempt.attemptId)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedAttemptId === record.attempt.attemptId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <p className="text-xs text-muted-foreground">
                  {record.attempt.quizKind} - {formatAttemptDate(record.attempt.completedAt || record.attempt.updatedAt)}
                </p>
                <p className="text-sm font-medium text-foreground mt-1">
                  Score {summary.score}% ({summary.answeredCount}/{summary.totalCount})
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {selectedRecord && selectedMetrics && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Attempt Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Quiz: <span className="text-foreground font-medium">{selectedRecord.attempt.quizKind}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: <span className="text-foreground font-medium">{selectedMetrics.summary.score}%</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Completion: <span className="text-foreground font-medium">{selectedMetrics.summary.completionPercent}%</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Misses:{" "}
                  <span className="text-foreground font-medium">
                    {selectedMetrics.summary.totalWrong} wrong / {selectedMetrics.summary.totalIdk} idk
                  </span>
                </p>
                {selectedMetrics.placementRecommendation && (
                  <p className="text-sm text-muted-foreground">
                    Auto placement: <span className="text-foreground font-medium">{selectedMetrics.placementRecommendation.band}</span>
                    {" "}(Module {selectedMetrics.placementRecommendation.moduleNumber})
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Misses</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedMetrics.misses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No missed items in answered questions.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedMetrics.misses.map(({ question, answer, missType }) => (
                      <div key={question.id} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium text-foreground">
                          {question.id} - {question.thai} ({question.translit})
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Topic: {topicLabelMap[question.topic]} | Replay count: {answer.replayCount} | Time: {Math.round(answer.timeToAnswerMs / 1000)}s
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Miss type:{" "}
                          <span className="font-medium text-foreground">
                            {missType === "idk" ? "I don't know" : "Incorrect choice"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Selected:{" "}
                          {renderChoiceText(
                            question,
                            answer.selectedChoiceId || undefined,
                            answer.answerType
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Correct:{" "}
                          {renderChoiceText(question, question.correctChoiceId, "choice")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Teacher Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedRecord.attempt.quizKind === "placement" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Manual placement override
                    </label>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={draftReview.manualBandOverride || ""}
                      onChange={(event) =>
                        setDraftReview((prev) => ({
                          ...prev,
                          manualBandOverride:
                            (event.target.value as PlacementBand) || undefined,
                        }))
                      }
                    >
                      <option value="">Use auto placement</option>
                      {placementBands.map((band) => (
                        <option key={band} value={band}>
                          {band}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Assign lessons</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {mockLessons.map((lesson) => (
                      <label key={lesson.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={draftReview.assignedLessonIds.includes(lesson.id)}
                          onChange={() => toggleLessonAssignment(lesson.id)}
                        />
                        <span>{lesson.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Notes
                  </label>
                  <textarea
                    className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    value={draftReview.notes}
                    onChange={(event) =>
                      setDraftReview((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Add coaching notes, intervention plan, or comments..."
                  />
                </div>

                <Button onClick={saveReview}>Save Nine Mode Review</Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
