import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findCatalogueEntry,
  nextNotStartedEpisode,
  parseCatalogueMarkdown,
  readCatalogue,
} from "../../src/lib/creator/youtube-catalogue.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const EPISODE_ID = /^YT-S\d{2}-E\d{2}$/;
const DONE_STATUSES = new Set(["RECORDED", "WRITTEN", "QUEUED"]);

test("readCatalogue returns at least 10 entries from the on-disk file", () => {
  const entries = readCatalogue(REPO_ROOT);
  assert.ok(
    entries.length >= 10,
    `expected ten or more entries, got ${entries.length}`
  );
});

test("every parsed entry has a well-formed episodeId", () => {
  const entries = readCatalogue(REPO_ROOT);
  for (const entry of entries) {
    assert.match(entry.episodeId, EPISODE_ID);
  }
});

test("findCatalogueEntry resolves YT-S01-E01", () => {
  const entry = findCatalogueEntry("YT-S01-E01", REPO_ROOT);
  assert.ok(entry, "E01 should exist in the catalogue");
  assert.equal(entry!.episodeId, "YT-S01-E01");
});

test("episodeIds are unique across the parsed result", () => {
  const entries = readCatalogue(REPO_ROOT);
  const seen = new Set<string>();
  for (const entry of entries) {
    assert.equal(
      seen.has(entry.episodeId),
      false,
      `duplicate episodeId: ${entry.episodeId}`
    );
    seen.add(entry.episodeId);
  }
});

test("nextNotStartedEpisode never returns a recorded, written, or queued entry", () => {
  const entry = nextNotStartedEpisode(REPO_ROOT);
  if (entry) {
    const status = (entry.status ?? "").toUpperCase();
    assert.equal(
      DONE_STATUSES.has(status),
      false,
      `nextNotStartedEpisode returned ${entry.episodeId} with status ${status}`
    );
  }
});

test("parseCatalogueMarkdown handles a synthetic minimal table", () => {
  const md = [
    "## Foo",
    "| Episode | Topic | Level | Status |",
    "| --- | --- | --- | --- |",
    "| YT-S01-E99 | Test topic | A0 | NOT_STARTED |",
    "",
  ].join("\n");
  const entries = parseCatalogueMarkdown(md);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].episodeId, "YT-S01-E99");
  assert.equal(entries[0].topic, "Test topic");
  assert.equal(entries[0].level, "A0");
  assert.equal(entries[0].status, "NOT_STARTED");
});

test("parseCatalogueMarkdown merges entries from multiple tables in one document", () => {
  const md = [
    "## A",
    "| Episode | Topic |",
    "| --- | --- |",
    "| YT-S01-E10 | Alpha |",
    "",
    "## B",
    "| Episode | Topic |",
    "| --- | --- |",
    "| YT-S01-E11 | Beta |",
    "| YT-S01-E12 | Gamma |",
    "",
  ].join("\n");
  const entries = parseCatalogueMarkdown(md);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.episodeId),
    ["YT-S01-E10", "YT-S01-E11", "YT-S01-E12"]
  );
});

test("parseCatalogueMarkdown skips non-episode rows", () => {
  const md = [
    "| Episode | Topic |",
    "| --- | --- |",
    "| (example) | not a real episode |",
    "| placeholder | also not real |",
    "| YT-S01-E20 | Real one |",
    "",
  ].join("\n");
  const entries = parseCatalogueMarkdown(md);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].episodeId, "YT-S01-E20");
});

test("parseCatalogueMarkdown skips rows whose ids look malformed", () => {
  const md = [
    "| Episode | Topic |",
    "| --- | --- |",
    "| YT-S1-E01 | single-digit series, malformed |",
    "| YT-S01-E1 | single-digit episode, malformed |",
    "| YT-S01-E04 | well-formed |",
    "",
  ].join("\n");
  const entries = parseCatalogueMarkdown(md);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].episodeId, "YT-S01-E04");
});

test("parseCatalogueMarkdown synthesises episodeId from a # column when no YT-id cell is present", () => {
  const md = [
    "| # | working_topic | level | status |",
    "| --- | --- | --- | --- |",
    "| 1 | foo | A0 | recorded |",
    "| 12 | bar | A1 | queued |",
    "",
  ].join("\n");
  const entries = parseCatalogueMarkdown(md);
  assert.deepEqual(
    entries.map((e) => e.episodeId),
    ["YT-S01-E01", "YT-S01-E12"]
  );
  assert.equal(entries[0].topic, "foo");
  assert.equal(entries[0].status, "RECORDED");
  assert.equal(entries[1].status, "QUEUED");
});

test("parseCatalogueMarkdown raw map preserves all original headers", () => {
  const md = [
    "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 7 | thai-tones | grammar | A0 | counter-intuitive | felt promise | next-thing | queued |",
    "",
  ].join("\n");
  const [entry] = parseCatalogueMarkdown(md);
  assert.equal(entry.episodeId, "YT-S01-E07");
  assert.equal(entry.titleBucket, "counter-intuitive");
  assert.equal(entry.topic, "thai-tones");
  assert.equal(entry.lessonRef, "next-thing");
  assert.equal(entry.raw["category"], "grammar");
  assert.equal(entry.raw["angle"], "felt promise");
});
