import test from "node:test";
import assert from "node:assert/strict";
import { readLessons } from "../../src/lib/creator/lessons.ts";
import { FIXTURE_ROOT, assertArtifact } from "./helpers/creator.ts";

test("lessons-pipeline: scans M*/L* dirs and joins blueprint by lesson_id", async () => {
  const rows = await readLessons(FIXTURE_ROOT);
  assert.equal(rows.length, 1, "fixture has exactly one lesson on disk");
  const row = rows[0];
  assert.equal(row.id, "M01-L001");
  assert.equal(row.title, "Greetings & Politeness");
  assert.equal(row.status, "READY_TO_RECORD");
  assert.equal(row.meta.module, "M01");
  assert.equal(row.meta.cefrBand, "A1");
  assert.equal(row.meta.updatedAt, "2026-04-10T12:00:00Z");
});

test("lessons-pipeline: reports existing vs missing artifacts per lesson", async () => {
  const rows = await readLessons(FIXTURE_ROOT);
  const row = rows[0];
  assertArtifact(row.artifacts, "scriptSpoken", true);
  assertArtifact(row.artifacts, "deck", true);
  assertArtifact(row.artifacts, "quiz", true);
  assertArtifact(row.artifacts, "scriptVisual", false);
  assertArtifact(row.artifacts, "pdf", false);
  assertArtifact(row.artifacts, "canvaDeck", false);
  assertArtifact(row.artifacts, "flashcards", false);
});
