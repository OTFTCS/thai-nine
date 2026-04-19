import test from "node:test";
import assert from "node:assert/strict";
import { loadMissionControlLessonReview } from "../../src/lib/mission-control/lesson-review.ts";
import { renderMissionControlMarkdown } from "../../src/lib/mission-control/render-markdown.ts";

test("lesson review loader returns complete lesson data for rebuilt lesson", async () => {
  const review = await loadMissionControlLessonReview("M01-L001");

  assert.ok(review);
  assert.equal(review.lesson.id, "M01-L001");
  assert.equal(review.lesson.title, "Hello and Basic Courtesy");
  assert.equal(review.status.state, "READY_TO_RECORD");
  assert.equal(review.checks.qaPass, true);
  assert.equal(review.checks.editorialQaPass, true);
  assert.equal(review.checks.visualQaPass, true);
  assert.equal(review.checks.assessmentQaPass, true);
  assert.equal(review.previews.deckExists, true);
  assert.equal(review.previews.pdfExists, true);
  assert.ok(review.checks.slideCount > 0);
  assert.ok(review.content.briefMd);
  assert.ok(review.content.scriptSpokenMd);
  assert.ok(review.content.scriptVisualMd);
});

test("lesson review loader degrades gracefully for partial lesson", async () => {
  const review = await loadMissionControlLessonReview("M02-L001");

  assert.ok(review);
  assert.equal(review.lesson.id, "M02-L001");
  assert.equal(review.status.state, "BACKLOG");
  assert.equal(review.content.briefMd, null);
  assert.equal(review.content.scriptSpokenMd, null);
  assert.equal(review.content.editorialQaReportMd, null);
  assert.equal(review.content.visualQaReportMd, null);
  assert.equal(review.content.assessmentQaReportMd, null);
  assert.equal(review.previews.pdfExists, false);
  assert.ok(review.checks.missingArtifacts.includes("brief.md"));
  assert.ok(review.checks.missingArtifacts.includes("pdf.pdf"));
});

test("lesson review loader returns null for invalid lesson id", async () => {
  const review = await loadMissionControlLessonReview("lesson-1");
  assert.equal(review, null);
});

test("mission control markdown renderer formats headings, lists, code, and tables", () => {
  const html = renderMissionControlMarkdown(`# Title\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| x | y |\n\n\`\`\`ts\nconst x = 1;\n\`\`\``);

  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<table/);
  assert.match(html, /const x = 1;/);
});
