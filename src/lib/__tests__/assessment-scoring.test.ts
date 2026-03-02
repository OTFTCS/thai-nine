import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSectionScores,
  computeOverallScore,
  determinePlacementBand,
  assessConfidence,
  identifyTopicGaps,
  computeAssessmentResult,
  getRunningSectionScore,
} from "../assessment-scoring";
import { placementQuiz, toneQuiz } from "../assessment-data";
import type {
  AssessmentSession,
  PlacementBand,
  QuestionAnswer,
} from "../../types/assessment";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeAnswer(
  questionId: string,
  selectedOptionId: string,
  correct: boolean,
  timeSpentMs = 5000,
): QuestionAnswer {
  return { questionId, selectedOptionId, timeSpentMs, correct };
}

function makeSession(
  quiz: typeof placementQuiz,
  answers: QuestionAnswer[],
): AssessmentSession {
  return {
    sessionId: "test-session",
    quizId: quiz.id,
    kind: quiz.kind,
    status: "completed",
    answers,
    currentQuestionIndex: quiz.questions.length,
    questionPath: quiz.questions.map((q) => q.id),
    startedAt: "2026-03-02T00:00:00Z",
    completedAt: "2026-03-02T00:10:00Z",
    updatedAt: "2026-03-02T00:10:00Z",
  };
}

// ── Section Scores ──────────────────────────────────────────────────────────

test("computeSectionScores: all correct", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true),
  );
  const scores = computeSectionScores(placementQuiz, answers);

  assert.equal(scores.length, 3);
  for (const s of scores) {
    assert.equal(s.rawPercent, 100);
  }
});

test("computeSectionScores: all wrong", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, "wrong", false),
  );
  const scores = computeSectionScores(placementQuiz, answers);

  for (const s of scores) {
    assert.equal(s.rawPercent, 0);
    assert.equal(s.weightedScore, 0);
  }
});

test("computeSectionScores: partial (1 of 3 correct in listening-basics)", () => {
  const answers = [
    makeAnswer("P01", placementQuiz.questions[0].correctOptionId, true),
    makeAnswer("P02", "wrong", false),
    makeAnswer("P03", "wrong", false),
  ];
  const scores = computeSectionScores(placementQuiz, answers);
  const listening = scores.find((s) => s.sectionId === "listening-basics");

  assert.ok(listening);
  assert.equal(listening.correct, 1);
  assert.equal(listening.total, 3);
  // 1/3 = 33.33%
  assert.ok(listening.rawPercent > 33 && listening.rawPercent < 34);
  // Weighted: 33.33 * 0.35 ≈ 11.67
  assert.ok(listening.weightedScore > 11 && listening.weightedScore < 12);
});

// ── Overall Score ───────────────────────────────────────────────────────────

test("computeOverallScore: perfect score sums to 100", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true),
  );
  const scores = computeSectionScores(placementQuiz, answers);
  const overall = computeOverallScore(scores);

  assert.equal(overall, 100);
});

test("computeOverallScore: zero score is 0", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, "wrong", false),
  );
  const scores = computeSectionScores(placementQuiz, answers);
  const overall = computeOverallScore(scores);

  assert.equal(overall, 0);
});

// ── Placement Bands ─────────────────────────────────────────────────────────

test("determinePlacementBand: beginner start (0-39)", () => {
  const band = determinePlacementBand(20, placementQuiz.placementBands!);
  assert.ok(band);
  assert.equal(band.label, "Beginner Start");
  assert.equal(band.startLessonId, "M01-L001");
});

test("determinePlacementBand: fast beginner (40-69)", () => {
  const band = determinePlacementBand(55, placementQuiz.placementBands!);
  assert.ok(band);
  assert.equal(band.label, "Fast Beginner");
  assert.equal(band.startLessonId, "M01-L003");
});

test("determinePlacementBand: bridge level (70-100)", () => {
  const band = determinePlacementBand(85, placementQuiz.placementBands!);
  assert.ok(band);
  assert.equal(band.label, "Bridge Level");
  assert.equal(band.startLessonId, "M01-L006");
});

test("determinePlacementBand: exact boundary 40", () => {
  const band = determinePlacementBand(40, placementQuiz.placementBands!);
  assert.ok(band);
  assert.equal(band.label, "Fast Beginner");
});

// ── Confidence ──────────────────────────────────────────────────────────────

test("assessConfidence: high confidence with consistent answers", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true, 8000),
  );
  const result = assessConfidence(answers, placementQuiz.questions.length);
  assert.equal(result.level, "high");
});

test("assessConfidence: low confidence with many fast wrong answers", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, "wrong", false, 1000),
  );
  const result = assessConfidence(answers, placementQuiz.questions.length);
  assert.equal(result.level, "low");
});

test("assessConfidence: low confidence with no answers", () => {
  const result = assessConfidence([], 9);
  assert.equal(result.level, "low");
});

test("assessConfidence: medium confidence with some rushed answers", () => {
  const answers = [
    makeAnswer("P01", "b", true, 8000),
    makeAnswer("P02", "c", true, 7000),
    makeAnswer("P03", "b", true, 6000),
    makeAnswer("P04", "wrong", false, 2000), // fast wrong
    makeAnswer("P05", "c", true, 5000),
    makeAnswer("P06", "c", true, 9000),
    makeAnswer("P07", "a", true, 6000),
    makeAnswer("P08", "c", true, 4000),
    makeAnswer("P09", "a", true, 5000),
  ];
  const result = assessConfidence(answers, 9);
  // 1 fast wrong out of 9 = ~11% guess ratio → should be high or medium
  assert.ok(result.level === "high" || result.level === "medium");
});

// ── Topic Gaps ──────────────────────────────────────────────────────────────

test("identifyTopicGaps: no gaps when all correct", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true),
  );
  const gaps = identifyTopicGaps(placementQuiz, answers);
  assert.equal(gaps.length, 0);
});

test("identifyTopicGaps: flags tones when all tone questions missed", () => {
  const answers = placementQuiz.questions.map((q) => {
    if (q.tags.includes("tones")) {
      return makeAnswer(q.id, "wrong", false);
    }
    return makeAnswer(q.id, q.correctOptionId, true);
  });
  const gaps = identifyTopicGaps(placementQuiz, answers);
  const toneGap = gaps.find((g) => g.tag === "tones");
  assert.ok(toneGap);
  assert.ok(toneGap.recommendedLessonIds.length > 0);
});

// ── Running Section Score (for branching) ───────────────────────────────────

test("getRunningSectionScore: 0 with no answers", () => {
  const score = getRunningSectionScore(placementQuiz, [], "listening-basics");
  assert.equal(score, 0);
});

test("getRunningSectionScore: 100 when all section answers correct", () => {
  const answers = [
    makeAnswer("P01", "b", true),
    makeAnswer("P02", "c", true),
    makeAnswer("P03", "b", true),
  ];
  const score = getRunningSectionScore(
    placementQuiz,
    answers,
    "listening-basics",
  );
  assert.equal(score, 100);
});

// ── Full Assessment Result ──────────────────────────────────────────────────

test("computeAssessmentResult: placement quiz perfect score", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true, 6000),
  );
  const session = makeSession(placementQuiz, answers);
  const result = computeAssessmentResult(placementQuiz, session);

  assert.equal(result.overallScore, 100);
  assert.ok(result.placementBand);
  assert.equal(result.placementBand.label, "Bridge Level");
  assert.equal(result.confidence.level, "high");
  assert.equal(result.topicGaps.length, 0);
  assert.equal(result.recommendedDeepLink, "/lessons/M01-L006");
});

test("computeAssessmentResult: placement quiz zero score", () => {
  const answers = placementQuiz.questions.map((q) =>
    makeAnswer(q.id, "wrong", false, 1000),
  );
  const session = makeSession(placementQuiz, answers);
  const result = computeAssessmentResult(placementQuiz, session);

  assert.equal(result.overallScore, 0);
  assert.ok(result.placementBand);
  assert.equal(result.placementBand.label, "Beginner Start");
  assert.equal(result.recommendedDeepLink, "/lessons/M01-L001");
});

test("computeAssessmentResult: tone quiz with CTA threshold", () => {
  // Get all correct for CTA pass
  const answers = toneQuiz.questions.map((q) =>
    makeAnswer(q.id, q.correctOptionId, true, 5000),
  );
  const session: AssessmentSession = {
    sessionId: "test-tone",
    quizId: toneQuiz.id,
    kind: toneQuiz.kind,
    status: "completed",
    answers,
    currentQuestionIndex: toneQuiz.questions.length,
    questionPath: toneQuiz.questions.map((q) => q.id),
    startedAt: "2026-03-02T00:00:00Z",
    completedAt: "2026-03-02T00:05:00Z",
    updatedAt: "2026-03-02T00:05:00Z",
  };
  const result = computeAssessmentResult(toneQuiz, session);

  assert.equal(result.overallScore, 100);
  assert.equal(result.passedCtaThreshold, true);
});

test("computeAssessmentResult: tone quiz below CTA threshold", () => {
  // Get all wrong
  const answers = toneQuiz.questions.map((q) =>
    makeAnswer(q.id, "wrong", false, 3000),
  );
  const session: AssessmentSession = {
    sessionId: "test-tone-fail",
    quizId: toneQuiz.id,
    kind: toneQuiz.kind,
    status: "completed",
    answers,
    currentQuestionIndex: toneQuiz.questions.length,
    questionPath: toneQuiz.questions.map((q) => q.id),
    startedAt: "2026-03-02T00:00:00Z",
    completedAt: "2026-03-02T00:05:00Z",
    updatedAt: "2026-03-02T00:05:00Z",
  };
  const result = computeAssessmentResult(toneQuiz, session);

  assert.equal(result.overallScore, 0);
  assert.equal(result.passedCtaThreshold, false);
});

// ── Transliteration Compliance (data integrity) ─────────────────────────────

test("all assessment questions have valid PTM transliteration in triplets", () => {
  const allQuizzes = [placementQuiz, toneQuiz];

  // PTM tone mark chars
  const toneMarkRegex = /[àáâǎèéêěìíîǐòóôǒùúûǔ]/;
  // Forbidden IPA
  const forbiddenRegex = /[ʉəɯɤœɨɪʊŋɲɕʔː]/;

  for (const quiz of allQuizzes) {
    for (const q of quiz.questions) {
      if (q.prompt.triplet) {
        const { thai, translit } = q.prompt.triplet;

        // Thai script must be present
        assert.ok(thai.length > 0, `Question ${q.id}: Thai script is empty`);

        // Translit must not contain forbidden IPA
        assert.ok(
          !forbiddenRegex.test(translit),
          `Question ${q.id}: Translit contains forbidden IPA: ${translit}`,
        );
      }

      // Check option triplets too
      for (const opt of q.options) {
        if (opt.triplet) {
          assert.ok(
            !forbiddenRegex.test(opt.triplet.translit),
            `Question ${q.id} option ${opt.id}: Forbidden IPA in translit`,
          );
        }
      }
    }
  }
});

test("placement quiz section weights sum to 1.0", () => {
  const totalWeight = placementQuiz.sections.reduce(
    (sum, s) => sum + s.weight,
    0,
  );
  assert.ok(
    Math.abs(totalWeight - 1.0) < 0.001,
    `Weights sum to ${totalWeight}, expected 1.0`,
  );
});

test("tone quiz section weights sum to 1.0", () => {
  const totalWeight = toneQuiz.sections.reduce(
    (sum, s) => sum + s.weight,
    0,
  );
  assert.ok(
    Math.abs(totalWeight - 1.0) < 0.001,
    `Weights sum to ${totalWeight}, expected 1.0`,
  );
});

test("all question IDs in sections exist in questions array", () => {
  for (const quiz of [placementQuiz, toneQuiz]) {
    const questionIds = new Set(quiz.questions.map((q) => q.id));
    for (const section of quiz.sections) {
      for (const qId of section.questionIds) {
        assert.ok(
          questionIds.has(qId),
          `Section ${section.id} references missing question ${qId}`,
        );
      }
    }
  }
});

test("audio paths follow naming convention", () => {
  for (const quiz of [placementQuiz, toneQuiz]) {
    for (const q of quiz.questions) {
      if (q.audioSrc) {
        const expectedPattern = `/audio/assessment/${quiz.id}/${q.id}.mp3`;
        assert.equal(
          q.audioSrc,
          expectedPattern,
          `Question ${q.id}: Audio path should be ${expectedPattern}`,
        );
      }
    }
  }
});
