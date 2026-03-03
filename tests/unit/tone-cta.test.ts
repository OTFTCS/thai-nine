import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowToneQuizCta } from "../../src/lib/quiz/scoring.ts";

test("tone CTA triggers at >= 70%", () => {
  const lowSummary = {
    score: 69,
    answeredCount: 10,
    totalCount: 10,
    completionPercent: 100,
    confidence: "high" as const,
    totalCorrect: 7,
    totalWrong: 3,
    totalIdk: 0,
    idkRate: 0,
    topicSubscores: [],
    missedQuestionIds: [],
  };

  const highSummary = {
    ...lowSummary,
    score: 70,
  };

  assert.equal(shouldShowToneQuizCta(lowSummary), false);
  assert.equal(shouldShowToneQuizCta(highSummary), true);
});
