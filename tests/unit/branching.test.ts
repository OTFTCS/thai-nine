import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuestionsByIds,
  placementQuestionBank,
} from "../../src/lib/quiz/question-banks.ts";
import {
  assemblePlacementQuestionIds,
  getPlacementTargetCount,
} from "../../src/lib/quiz/assembler.ts";
import {
  shouldShowAudioPromptThai,
  shouldShowLearnerTransliteration,
} from "../../src/lib/quiz/display.ts";

test("placement assembler builds balanced question sets at target size", () => {
  const targetCount = getPlacementTargetCount();
  const readerFlow = assemblePlacementQuestionIds({
    track: "reader",
    targetCount,
    seed: "reader-test-seed",
  });
  const nonReaderFlow = assemblePlacementQuestionIds({
    track: "non_reader",
    targetCount,
    seed: "non-reader-test-seed",
  });
  const validIds = new Set(placementQuestionBank.map((question) => question.id));

  assert.equal(readerFlow.length, targetCount);
  assert.equal(nonReaderFlow.length, targetCount);

  readerFlow.forEach((id) => assert.ok(validIds.has(id), `Missing reader ID: ${id}`));
  nonReaderFlow.forEach((id) =>
    assert.ok(validIds.has(id), `Missing non-reader ID: ${id}`)
  );

  assert.equal(new Set(readerFlow).size, readerFlow.length);
  assert.equal(new Set(nonReaderFlow).size, nonReaderFlow.length);

  const readerQuestions = getQuestionsByIds("placement", readerFlow);
  const readerTopicCounts = new Map<string, number>();
  readerQuestions.forEach((question) => {
    readerTopicCounts.set(
      question.topic,
      (readerTopicCounts.get(question.topic) || 0) + 1
    );
  });

  const maxPerTopic = Math.max(...readerTopicCounts.values());
  assert.ok(maxPerTopic <= 3, `Topic imbalance detected: ${maxPerTopic}`);
  assert.ok(readerTopicCounts.size >= 12, "Not enough topic coverage");
});

test("reader track hides transliteration in learner UI", () => {
  assert.equal(shouldShowLearnerTransliteration("placement", "reader"), false);
  assert.equal(shouldShowLearnerTransliteration("reader_tones", "reader"), false);
  assert.equal(shouldShowLearnerTransliteration("placement", "non_reader"), true);
});


test("reader and tone quizzes hide source Thai prompt text", () => {
  assert.equal(shouldShowAudioPromptThai("reader_tones", "reader"), false);
  assert.equal(shouldShowAudioPromptThai("tones", "non_reader"), false);
  assert.equal(shouldShowAudioPromptThai("placement", "reader"), true);
});
