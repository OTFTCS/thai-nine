import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readYouTubeInventory,
  readYouTubeRows,
} from "../../src/lib/creator/youtube-pipeline.ts";
import { assertArtifact } from "./helpers/creator.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(here, "..", "fixtures", "creator");

const MINIMAL_CATALOGUE = [
  "# Test catalogue",
  "",
  "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
  "|---|---|---|---|---|---|---|---|",
  "| 7 | mock-topic-7 | grammar | A2 | counter-intuitive | Mock catalogue-only entry | terminal-node | queued |",
  "",
].join("\n");

async function makeTmpRoot(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "youtube-pipeline-test-"));
}

function writeFile(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, "utf8");
}

function writeStatusJson(
  root: string,
  episodeId: string,
  payload: Record<string, unknown>
): void {
  const filePath = path.join(
    root,
    "youtube",
    "episodes",
    episodeId,
    "status.json"
  );
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeScriptJson(
  root: string,
  episodeId: string,
  fields: Record<string, unknown> = {}
): void {
  const filePath = path.join(
    root,
    "youtube",
    "examples",
    `${episodeId}.json`
  );
  const body = {
    schemaVersion: 2,
    episodeId,
    title: `Stub title for ${episodeId}`,
    ...fields,
  };
  writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`);
}

test("youtube-pipeline: detects next unrecorded episode with scene file", async () => {
  const inventory = await readYouTubeInventory(FIXTURE_ROOT);
  assert.equal(inventory.episodes.length, 2);
  assert.deepEqual(inventory.recordedIds, ["YT-S01-E01"]);
  assert.ok(inventory.nextEpisode, "next episode should be found");
  assert.equal(inventory.nextEpisode!.episodeId, "YT-S01-E04");
  assert.match(inventory.nextEpisode!.sceneSource ?? "", /SceneE04/);
});

test("youtube-pipeline: returns null nextEpisode when fixture root is empty", async () => {
  const emptyRoot = path.resolve(here, "..", "fixtures");
  const inventory = await readYouTubeInventory(emptyRoot);
  assert.equal(inventory.nextEpisode, null);
});

test("youtube-pipeline: exposes extended path fields on YouTubeEpisode", async () => {
  const inventory = await readYouTubeInventory(FIXTURE_ROOT);
  const e01 = inventory.episodes.find((e) => e.episodeId === "YT-S01-E01")!;
  assert.ok(e01.recordingPath, "E01 has a stub .m4a recording");
  assert.match(e01.recordingPath!, /recordings\/YT-S01-E01\.m4a$/);
  assert.ok(e01.imagesDirPath, "E01 has a stub images dir");
  assert.match(e01.imagesDirPath!, /images\/YT-S01-E01$/);
  assert.equal(e01.backgroundPath, null, "no background stub in fixture");
  assert.equal(e01.finalPath, null, "no final-mp4 stub in fixture");
});

test("youtube-pipeline: readYouTubeRows returns ContentRow shape for ArtifactSpreadsheet", async () => {
  // The fixture catalogue (tests/fixtures/creator/youtube/episode-catalogue.md)
  // adds one catalogue-only row (YT-S01-E07) on top of the two on-disk rows
  // (E01 recorded, E04 pending). Total 3 rows.
  const rows = await readYouTubeRows(FIXTURE_ROOT);
  assert.equal(rows.length, 3);
  const e01 = rows.find((r) => r.id === "YT-S01-E01")!;
  assert.equal(e01.status, "RECORDED");
  assert.equal(e01.meta.recorded, true);
  assertArtifact(e01.artifacts, "scene", true);
  assertArtifact(e01.artifacts, "recording", true);
  assertArtifact(e01.artifacts, "imagesDir", true);
  assertArtifact(e01.artifacts, "background", false);
  assertArtifact(e01.artifacts, "final", false);
  const e04 = rows.find((r) => r.id === "YT-S01-E04")!;
  assert.equal(e04.status, "PENDING");
  assert.equal(e04.meta.recorded, false);
});

test("youtube-pipeline: catalogue-only entry produces a row with empty artifacts", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  writeFile(
    path.join(root, "youtube", "episode-catalogue.md"),
    MINIMAL_CATALOGUE
  );

  const rows = await readYouTubeRows(root);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.id, "YT-S01-E07");
  assert.equal(row.folderPath, "");
  assert.equal(row.meta.hasScript, false);
  assert.equal(row.meta.scriptStatus, "NOT_STARTED");
  assert.equal(row.meta.recorded, false);

  // Every artifact slot is present in the map but exists is false.
  for (const key of [
    "scene",
    "sceneBase",
    "background",
    "final",
    "recording",
    "imagesDir",
    "qaReport",
  ]) {
    assertArtifact(row.artifacts, key, false);
  }
});

test("youtube-pipeline: scriptStatus from status.json wins over derived value", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // Make the episode discoverable via the catalogue, then add a script JSON
  // (so derived would be "DRAFT") and a status.json declaring "APPROVED".
  // The merged row should report "APPROVED".
  const episodeId = "YT-S01-E11";
  const catalogue = [
    "# Catalogue",
    "",
    "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
    "|---|---|---|---|---|---|---|---|",
    "| 11 | no-articles-no-plurals | grammar | A1 | counter-intuitive | Why Thai has no the | yes-no-questions-with-mai | queued |",
    "",
  ].join("\n");
  writeFile(path.join(root, "youtube", "episode-catalogue.md"), catalogue);
  writeScriptJson(root, episodeId);
  writeStatusJson(root, episodeId, {
    episodeId,
    scriptStatus: "APPROVED",
    updatedAt: "2026-04-25T00:00:00.000Z",
    lastError: null,
  });

  const rows = await readYouTubeRows(root);
  const row = rows.find((r) => r.id === episodeId);
  assert.ok(row, "expected a row for the catalogue + scripted episode");
  assert.equal(row!.meta.hasScript, true);
  assert.equal(row!.meta.scriptStatus, "APPROVED");
});

test("youtube-pipeline: rows are sorted by episodeId ascending", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // Mix of catalogue-only and on-disk in deliberately non-sorted order.
  const catalogue = [
    "# Catalogue",
    "",
    "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
    "|---|---|---|---|---|---|---|---|",
    "| 5 | five-topic | grammar | A1 | counter-intuitive | Five angle | terminal | queued |",
    "| 2 | two-topic | food | A0 | upgrade-offer | Two angle | terminal | queued |",
    "",
  ].join("\n");
  writeFile(path.join(root, "youtube", "episode-catalogue.md"), catalogue);
  // Add an on-disk episode with id between the two catalogue entries.
  fs.mkdirSync(path.join(root, "youtube", "out", "YT-S01-E03"), {
    recursive: true,
  });

  const rows = await readYouTubeRows(root);
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids, ["YT-S01-E02", "YT-S01-E03", "YT-S01-E05"]);
});

test("youtube-pipeline: catalogue meta fields populate (topic, level, titleBucket)", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const catalogue = [
    "# Catalogue",
    "",
    "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
    "|---|---|---|---|---|---|---|---|",
    "| 9 | thai-numbers-1-10 | vocabulary | A0 | upgrade-offer | Say any price | telling-clock-time | queued |",
    "",
  ].join("\n");
  writeFile(path.join(root, "youtube", "episode-catalogue.md"), catalogue);

  const rows = await readYouTubeRows(root);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.id, "YT-S01-E09");
  assert.equal(row.meta.topic, "thai-numbers-1-10");
  assert.equal(row.meta.level, "A0");
  assert.equal(row.meta.catalogueTitle, "upgrade-offer");
  assert.equal(row.meta.lessonRef, "telling-clock-time");
});
