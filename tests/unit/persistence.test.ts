import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttempt,
  saveAttempt,
  loadAttempt,
  loadAttemptState,
  clearAttempt,
} from "../../src/lib/quiz/persistence.ts";
import { getQuestionsByIds } from "../../src/lib/quiz/question-banks.ts";
import { scoreAssessment } from "../../src/lib/quiz/scoring.ts";

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("attempt persistence restores partial progress", () => {
  const localStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });

  clearAttempt("placement");
  const questions = getQuestionsByIds("placement", ["G01", "N06", "T01"]);

  const attempt = createAttempt("placement", questions, "non_reader");
  const questionId = attempt.questionIds[0];
  const questionOrder = attempt.choiceOrderByQuestion[questionId];
  const selectedChoiceId = questionOrder[1];
  attempt.currentIndex = 1;
  attempt.answers[questionId] = {
    questionId,
    answerType: "choice",
    selectedChoiceId,
    isCorrect: selectedChoiceId === questions[0].correctChoiceId,
    timeToAnswerMs: 1100,
    replayCount: 2,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };

  saveAttempt(attempt);

  const restored = loadAttempt("placement");

  assert.ok(restored);
  assert.equal(restored?.currentIndex, 1);
  assert.equal(restored?.track, "non_reader");
  assert.equal(restored?.questionIds.length, 3);
  assert.deepEqual(restored?.choiceOrderByQuestion[questionId], questionOrder);
  assert.equal(restored?.answers[questionId].selectedChoiceId, selectedChoiceId);

  clearAttempt("placement");
  assert.equal(loadAttempt("placement"), null);
});

test("idk answers persist as idk and remain incorrect in scoring", () => {
  const localStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });

  clearAttempt("placement");
  const questions = getQuestionsByIds("placement", ["N06", "Q01"]);
  const attempt = createAttempt("placement", questions, "non_reader");

  attempt.answers.N06 = {
    questionId: "N06",
    answerType: "idk",
    selectedChoiceId: null,
    isCorrect: false,
    timeToAnswerMs: 1200,
    replayCount: 1,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };

  attempt.answers.Q01 = {
    questionId: "Q01",
    answerType: "choice",
    selectedChoiceId: questions[1].correctChoiceId,
    isCorrect: true,
    timeToAnswerMs: 1200,
    replayCount: 0,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };

  saveAttempt(attempt);

  const restoredResult = loadAttemptState("placement");
  assert.equal(restoredResult.notice, undefined);
  assert.ok(restoredResult.attempt);
  assert.equal(restoredResult.attempt?.answers.N06.answerType, "idk");
  assert.equal(restoredResult.attempt?.answers.N06.selectedChoiceId, null);
  assert.equal(restoredResult.attempt?.answers.N06.isCorrect, false);

  const summary = scoreAssessment(questions, restoredResult.attempt?.answers || {});
  assert.equal(summary.totalIdk, 1);
  assert.equal(summary.totalWrong, 0);
  assert.equal(summary.totalCorrect, 1);

  clearAttempt("placement");
});
