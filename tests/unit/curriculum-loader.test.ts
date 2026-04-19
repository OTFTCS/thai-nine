import test from "node:test";
import assert from "node:assert/strict";
import {
  getBlueprintCurriculum,
  getBlueprintPlacementRecommendations,
} from "../../src/lib/curriculum/blueprint-loader.ts";

test("blueprint curriculum parses modules and lessons in CSV order", async () => {
  const curriculum = await getBlueprintCurriculum();

  assert.ok(curriculum.modules.length >= 18);
  assert.ok(curriculum.lessons.length >= 180);

  assert.equal(curriculum.modules[0].id, "M01");
  assert.equal(curriculum.modules[0].lessons[0].id, "M01-L001");
  assert.equal(curriculum.modules[0].lessons[1].id, "M01-L002");
  assert.equal(curriculum.lessons[0].id, "M01-L001");
  assert.equal(curriculum.lessons[9].id, "M01-L010");
  assert.equal(curriculum.lessons[10].id, "M02-L001");
});

test("blueprint loader preserves key lesson metadata fields", async () => {
  const curriculum = await getBlueprintCurriculum();
  const lesson = curriculum.lessonById["M01-L001"];

  assert.ok(lesson);
  assert.equal(lesson.id, "M01-L001");
  assert.equal(lesson.moduleId, "M01");
  assert.equal(lesson.trackId, "T01");
  assert.equal(lesson.cefrBand, "A0");
  assert.equal(lesson.availabilityState, "coming_soon");
  assert.ok(lesson.primaryOutcome.length > 0);
  assert.ok(lesson.secondaryOutcome.length > 0);
  assert.ok(lesson.quizFocus.length > 0);
});

test("placement recommendations are blueprint-backed lesson routes", async () => {
  const recommendationMap = await getBlueprintPlacementRecommendations();

  for (const recommendation of Object.values(recommendationMap)) {
    assert.match(recommendation.moduleId, /^M\d{2}$/);
    assert.ok(recommendation.lessonLinks.length > 0);
    for (const lessonLink of recommendation.lessonLinks) {
      assert.ok(lessonLink.href);
      assert.match(lessonLink.href ?? "", /^\/lessons\/M\d{2}-L\d{3}$/);
      assert.equal((lessonLink.href ?? "").includes("lesson-"), false);
    }
  }
});
