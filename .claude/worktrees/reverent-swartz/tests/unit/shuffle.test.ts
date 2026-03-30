import test from "node:test";
import assert from "node:assert/strict";
import { buildChoiceOrderForQuestion } from "../../src/lib/quiz/choice-order.ts";
import { getQuestionsByIds } from "../../src/lib/quiz/question-banks.ts";
import { scoreAssessment } from "../../src/lib/quiz/scoring.ts";

function makeAnswer(questionId: string, selectedChoiceId: string, isCorrect: boolean) {
  return {
    questionId,
    answerType: "choice" as const,
    selectedChoiceId,
    isCorrect,
    timeToAnswerMs: 1000,
    replayCount: 0,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };
}

test("shuffled option order preserves correctness by choice id", () => {
  const [question] = getQuestionsByIds("placement", ["G01"]);
  const orderA = buildChoiceOrderForQuestion("attempt-a", question);
  const orderB = buildChoiceOrderForQuestion("attempt-b", question);

  assert.equal(orderA.length, 4);
  assert.equal(orderB.length, 4);
  assert.equal(new Set(orderA).size, 4);
  assert.equal(new Set(orderB).size, 4);

  // Different attempts should not always see the same order.
  assert.notDeepEqual(orderA, orderB);

  const summary = scoreAssessment(
    [question],
    {
      [question.id]: makeAnswer(question.id, question.correctChoiceId, true),
    }
  );

  assert.equal(summary.score, 100);
  assert.equal(summary.totalCorrect, 1);
});
