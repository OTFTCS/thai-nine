import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readYouTubeInventory,
  readYouTubeRows,
} from "../../src/lib/creator/youtube-pipeline.ts";
import { assertArtifact } from "./helpers/creator.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(here, "..", "fixtures", "creator");

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
  const rows = await readYouTubeRows(FIXTURE_ROOT);
  assert.equal(rows.length, 2);
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
