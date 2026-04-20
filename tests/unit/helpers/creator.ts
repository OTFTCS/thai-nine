import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type { ArtifactMap } from "@/types/creator";

const here = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURE_ROOT = path.resolve(here, "..", "..", "fixtures", "creator");

export function assertArtifact(
  map: ArtifactMap,
  key: string,
  shouldExist: boolean
): void {
  const artifact = map[key];
  assert.ok(artifact, `artifact '${key}' should be present in the map`);
  assert.equal(
    artifact.exists,
    shouldExist,
    `artifact '${key}' should have exists=${shouldExist}, got ${artifact.exists}`
  );
}
