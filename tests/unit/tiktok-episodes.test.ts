import test from "node:test";
import assert from "node:assert/strict";
import { readTikTokEpisodes } from "../../src/lib/creator/tiktok-pipeline.ts";
import { FIXTURE_ROOT, assertArtifact } from "./helpers/creator.ts";

test("tiktok-episodes: enumerates scripts across a series", async () => {
  const rows = await readTikTokEpisodes(FIXTURE_ROOT);
  assert.equal(rows.length, 2, "fixture has two episode scripts");
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "thai-classifiers::1::overview",
    "thai-classifiers::2::khon",
  ]);
  const ep01 = rows.find((r) => r.meta.epNum === 1)!;
  assert.equal(ep01.meta.series, "thai-classifiers");
  assertArtifact(ep01.artifacts, "script", true);
});

test("tiktok-episodes: newest-version wins when multiple out/tiktok-ep*-v* dirs exist", async () => {
  const rows = await readTikTokEpisodes(FIXTURE_ROOT);
  const ep01 = rows.find((r) => r.meta.epNum === 1)!;
  const ep02 = rows.find((r) => r.meta.epNum === 2)!;

  // ep01: two version dirs (v1, v2). v2 must win for scene.
  assertArtifact(ep01.artifacts, "scene", true);
  assert.match(
    ep01.artifacts.scene.path,
    /tiktok-ep01-v2/,
    "ep01 scene should resolve to newest v2 dir"
  );

  // ep02: v1 and v10; numeric sort must pick v10, not lexicographic.
  assertArtifact(ep02.artifacts, "final", true);
  assert.match(
    ep02.artifacts.final.path,
    /tiktok-ep02-v10/,
    "ep02 final should resolve to v10 (numeric newest), not v1"
  );
});
