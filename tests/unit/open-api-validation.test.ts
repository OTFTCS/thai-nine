import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { isPathAllowed } from "../../src/lib/creator/path-safety.ts";

const ROOT = "/Users/test/project";

test("open-api: paths inside the repo root are allowed", () => {
  assert.equal(isPathAllowed(`${ROOT}/course/modules/M01/L001`, ROOT), true);
  assert.equal(isPathAllowed(`${ROOT}/youtube/out/YT-S01-E01/scene.py`, ROOT), true);
});

test("open-api: rejects paths outside the repo root", () => {
  assert.equal(isPathAllowed("/etc/passwd", ROOT), false);
  assert.equal(isPathAllowed("/Users/test/other/thing", ROOT), false);
});

test("open-api: rejects parent-dir traversal even when path starts with root prefix", () => {
  assert.equal(isPathAllowed(`${ROOT}/../escape`, ROOT), false);
  assert.equal(isPathAllowed(`${ROOT}/subdir/../../outside`, ROOT), false);
});

test("open-api: rejects the repo root itself and empty / missing input", () => {
  assert.equal(isPathAllowed(ROOT, ROOT), false);
  assert.equal(isPathAllowed("", ROOT), false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal(isPathAllowed(undefined as any, ROOT), false);
});

test("open-api: rejects lookalike paths that share a prefix with root", () => {
  // `${ROOT}-evil` shares the string prefix but is NOT inside root.
  assert.equal(isPathAllowed(`${ROOT}-evil/file`, ROOT), false);
});
