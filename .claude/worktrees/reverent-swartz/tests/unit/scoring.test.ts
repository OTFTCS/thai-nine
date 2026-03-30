import test from "node:test";
import assert from "node:assert/strict";
import { scoreAssessment, derivePlacementBand, buildPlacementRecommendation } from "../../src/lib/quiz/scoring.ts";
import { getQuestionsByIds } from "../../src/lib/quiz/question-banks.ts";

function makeChoiceAnswer(questionId: string, selectedChoiceId: string, isCorrect: boolean) {
  return {
    questionId,
    answerType: "choice" as const,
    selectedChoiceId,
    isCorrect,
    timeToAnswerMs: 1200,
    replayCount: 1,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };
}

function makeIdkAnswer(questionId: string) {
  return {
    questionId,
    answerType: "idk" as const,
    selectedChoiceId: null,
    isCorrect: false,
    timeToAnswerMs: 900,
    replayCount: 0,
    answeredAt: new Date("2026-03-02T00:00:00.000Z").toISOString(),
  };
}

test("weighted scoring uses difficulty weights", () => {
  const questions = getQuestionsByIds("placement", ["G01", "D14"]);

  const answers = {
    G01: makeChoiceAnswer("G01", questions[0].correctChoiceId, true),
    D14: makeChoiceAnswer("D14", questions[1].choices[1].id, false),
  };

  const summary = scoreAssessment(questions, answers);

  assert.equal(summary.score, 17);
  assert.equal(summary.answeredCount, 2);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.totalCorrect, 1);
  assert.equal(summary.totalWrong, 1);
  assert.equal(summary.totalIdk, 0);
});

test("placement band mapping and recommendation are returned", () => {
  const questions = getQuestionsByIds("placement", [
    "G01",
    "N06",
    "F02",
    "Q01",
    "D06",
    "T11",
  ]);

  const answers = {
    G01: makeChoiceAnswer("G01", questions[0].correctChoiceId, true),
    N06: makeChoiceAnswer("N06", questions[1].correctChoiceId, true),
    F02: makeChoiceAnswer("F02", questions[2].correctChoiceId, true),
    Q01: makeChoiceAnswer("Q01", questions[3].correctChoiceId, true),
    D06: makeChoiceAnswer("D06", questions[4].correctChoiceId, true),
    T11: makeChoiceAnswer("T11", questions[5].correctChoiceId, true),
  };

  const summary = scoreAssessment(questions, answers);
  const band = derivePlacementBand(summary);
  const recommendation = buildPlacementRecommendation(summary);

  assert.equal(summary.score, 100);
  assert.equal(band, "B1-ish");
  assert.equal(recommendation.band, "B1-ish");
  assert.ok(recommendation.lessonLinks.length > 0);
});

test("idk answers are scored as incorrect and tracked separately", () => {
  const questions = getQuestionsByIds("placement", ["N06", "Q01", "D01"]);

  const answers = {
    N06: makeIdkAnswer("N06"),
    Q01: makeChoiceAnswer("Q01", questions[1].correctChoiceId, true),
    D01: makeChoiceAnswer("D01", questions[2].choices[1].id, false),
  };

  const summary = scoreAssessment(questions, answers);

  assert.equal(summary.answeredCount, 3);
  assert.equal(summary.totalCorrect, 1);
  assert.equal(summary.totalWrong, 1);
  assert.equal(summary.totalIdk, 1);
  assert.equal(summary.missedQuestionIds.includes("N06"), true);
  assert.equal(summary.missedQuestionIds.includes("D01"), true);
});
