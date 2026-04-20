import test from "node:test";
import assert from "node:assert/strict";
import { readCarousels } from "../../src/lib/creator/carousels.ts";
import { FIXTURE_ROOT, assertArtifact } from "./helpers/creator.ts";

test("carousels-pipeline: scans 'Thai images/' for both carousel-data.json and manifest.json", async () => {
  const rows = await readCarousels(FIXTURE_ROOT);
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["legacy-carousel", "test-carousel"]);

  const legacy = rows.find((r) => r.id === "legacy-carousel")!;
  assertArtifact(legacy.artifacts, "manifest", true);
  assert.match(legacy.artifacts.manifest.path, /manifest\.json$/);

  const modern = rows.find((r) => r.id === "test-carousel")!;
  assertArtifact(modern.artifacts, "manifest", true);
  assert.match(modern.artifacts.manifest.path, /carousel-data\.json$/);
});

test("carousels-pipeline: xlsx artifact points at the tracker file in the same root", async () => {
  const rows = await readCarousels(FIXTURE_ROOT);
  const row = rows[0];
  assertArtifact(row.artifacts, "xlsx", true);
  assert.match(row.artifacts.xlsx.path, /thai-nine-project-tracker\.xlsx$/);
});
