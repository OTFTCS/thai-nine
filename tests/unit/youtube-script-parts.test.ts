import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  splitBlocksToParts,
  PART_LABELS,
  type Block,
  type SplitResult,
} from "../../src/lib/creator/youtube-script-parts.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, "..", "..");
const EXAMPLES_DIR = path.join(PROJECT_ROOT, "youtube", "examples");

function loadEpisode(episodeId: string): Block[] {
  const file = path.join(EXAMPLES_DIR, `${episodeId}.json`);
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = JSON.parse(raw) as { blocks: Block[] };
  return parsed.blocks;
}

function syntheticBlock(id: string, mode: string): Block {
  return { id, mode, lines: [] };
}

function totalCount(result: SplitResult): number {
  return (
    result.partRanges.p1.count +
    result.partRanges.p2.count +
    result.partRanges.p3.count +
    result.partRanges.p4.count
  );
}

function assertConsistency(blocks: Block[], result: SplitResult) {
  // Every block has exactly one part assignment.
  assert.equal(
    Object.keys(result.partOf).length,
    blocks.length,
    "partOf should have one entry per block",
  );
  // Sum of arrays equals input length.
  assert.equal(totalCount(result), blocks.length, "part counts must sum to input length");
  // Each block appears in exactly one of the four arrays.
  for (const b of blocks) {
    const inP1 = result.p1.some((x) => x.id === b.id);
    const inP2 = result.p2.some((x) => x.id === b.id);
    const inP3 = result.p3.some((x) => x.id === b.id);
    const inP4 = result.p4.some((x) => x.id === b.id);
    const count = [inP1, inP2, inP3, inP4].filter(Boolean).length;
    assert.equal(count, 1, `block ${b.id} should appear in exactly one part`);
    const expected = result.partOf[b.id];
    if (expected === "p1") assert.ok(inP1, `block ${b.id} expected in p1`);
    if (expected === "p2") assert.ok(inP2, `block ${b.id} expected in p2`);
    if (expected === "p3") assert.ok(inP3, `block ${b.id} expected in p3`);
    if (expected === "p4") assert.ok(inP4, `block ${b.id} expected in p4`);
  }
  // Order within each part preserves blueprint order.
  for (const part of [result.p1, result.p2, result.p3, result.p4]) {
    const indices = part.map((b) => blocks.findIndex((x) => x.id === b.id));
    for (let i = 1; i < indices.length; i++) {
      assert.ok(
        indices[i] > indices[i - 1],
        "part arrays must preserve original block order",
      );
    }
  }
  // partRanges align with arrays.
  for (const k of ["p1", "p2", "p3", "p4"] as const) {
    const arr = result[k];
    const range = result.partRanges[k];
    assert.equal(range.count, arr.length, `${k} count matches array length`);
    if (arr.length === 0) {
      assert.equal(range.start, null);
      assert.equal(range.end, null);
    } else {
      assert.equal(range.start, arr[0].id);
      assert.equal(range.end, arr[arr.length - 1].id);
    }
  }
}

test("PART_LABELS exposes the expected human-readable names", () => {
  assert.equal(PART_LABELS.p1, "Sketch");
  assert.equal(PART_LABELS.p2, "Context");
  assert.equal(PART_LABELS.p3, "Teaching");
  assert.equal(PART_LABELS.p4, "Practice");
});

test("E01 fixture: 1 / 1 / 3 / 9 split", () => {
  const blocks = loadEpisode("YT-S01-E01");
  assert.equal(blocks.length, 14);
  const result = splitBlocksToParts(blocks);

  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(result.partRanges.p3.count, 3);
  assert.equal(result.partRanges.p4.count, 9);

  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p2");
  assert.equal(result.partOf["b-003"], "p3");
  assert.equal(result.partOf["b-004"], "p3");
  assert.equal(result.partOf["b-005"], "p3");
  assert.equal(result.partOf["b-006"], "p4");
  assert.equal(result.partOf["b-014"], "p4");

  assert.equal(result.partRanges.p1.start, "b-001");
  assert.equal(result.partRanges.p1.end, "b-001");
  assert.equal(result.partRanges.p4.start, "b-006");
  assert.equal(result.partRanges.p4.end, "b-014");

  assertConsistency(blocks, result);
});

test("E02 fixture: section-intro and explain classifications", () => {
  const blocks = loadEpisode("YT-S01-E02");
  assert.equal(blocks.length, 42);
  const result = splitBlocksToParts(blocks);

  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(totalCount(result), 42);

  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p2");
  // explain check-in after natural-listen falls back to b-021.
  assert.equal(result.partOf["b-022"], "p3");
  // Tail explains after breakdowns stay in p3.
  assert.equal(result.partOf["b-025"], "p3");
  assert.equal(result.partOf["b-031"], "p3");
  // section-intro for drills peeks forward to b-033 (drill-prompt).
  assert.equal(result.partOf["b-032"], "p4");
  // section-intro for shadowing peeks forward to b-040 (shadowing).
  assert.equal(result.partOf["b-039"], "p4");
  assert.equal(result.partOf["b-042"], "p4");

  assertConsistency(blocks, result);
});

test("E03 fixture: structure mirrors E02", () => {
  const blocks = loadEpisode("YT-S01-E03");
  assert.equal(blocks.length, 42);
  const result = splitBlocksToParts(blocks);

  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(totalCount(result), 42);

  assert.equal(result.partOf["b-022"], "p3");
  assert.equal(result.partOf["b-025"], "p3");
  assert.equal(result.partOf["b-031"], "p3");
  assert.equal(result.partOf["b-032"], "p4");
  assert.equal(result.partOf["b-039"], "p4");
  assert.equal(result.partOf["b-042"], "p4");

  assertConsistency(blocks, result);
});

test("E04 fixture: critical b-036 explain falls back to breakdown (p3)", () => {
  const blocks = loadEpisode("YT-S01-E04");
  assert.equal(blocks.length, 51);
  const result = splitBlocksToParts(blocks);

  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(totalCount(result), 51);

  assert.equal(result.partOf["b-002"], "p2");
  // The critical edge case: tail explain (b-036) sits AFTER all breakdowns
  // and BEFORE the practice section-intro at b-037. Backward fallback skips
  // the b-035 explain and lands on b-034 (breakdown), so b-036 -> p3.
  assert.equal(result.partOf["b-036"], "p3");
  // section-intro for shadowing peeks forward to b-038 (shadowing).
  assert.equal(result.partOf["b-037"], "p4");
  // explain encouragement after shadowing falls back to b-038 (shadowing).
  assert.equal(result.partOf["b-039"], "p4");
  // section-intro for quiz peeks forward to b-041 (drill-prompt).
  assert.equal(result.partOf["b-040"], "p4");
  // Sign-off explain after recap falls back to b-049 (recap).
  assert.equal(result.partOf["b-050"], "p4");
  assert.equal(result.partOf["b-051"], "p4");

  assertConsistency(blocks, result);
});

test("synthetic 1: only hook -> single p1, others empty", () => {
  const blocks: Block[] = [syntheticBlock("b-001", "hook")];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 0);
  assert.equal(result.partRanges.p3.count, 0);
  assert.equal(result.partRanges.p4.count, 0);
  assert.equal(result.partRanges.p2.start, null);
  assert.equal(result.partRanges.p2.end, null);
  assert.equal(result.partRanges.p3.start, null);
  assert.equal(result.partRanges.p4.start, null);
  assertConsistency(blocks, result);
});

test("synthetic 2: hook + single explain (preamble) + breakdown -> 1/1/1/0", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "explain"),
    syntheticBlock("b-003", "breakdown"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p2");
  assert.equal(result.partOf["b-003"], "p3");
  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(result.partRanges.p3.count, 1);
  assert.equal(result.partRanges.p4.count, 0);
  assertConsistency(blocks, result);
});

test("synthetic 3: hook + breakdown + tail explain -> explain falls back to breakdown", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "breakdown"),
    syntheticBlock("b-003", "explain"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p3");
  assert.equal(result.partOf["b-003"], "p3");
  assert.equal(result.partRanges.p1.count, 1);
  assert.equal(result.partRanges.p2.count, 0);
  assert.equal(result.partRanges.p3.count, 2);
  assert.equal(result.partRanges.p4.count, 0);
  assertConsistency(blocks, result);
});

test("synthetic 4: section-intro peeks forward to recap (P4) when no P3 anchors exist", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "section-intro"),
    syntheticBlock("b-003", "recap"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p4");
  assert.equal(result.partOf["b-003"], "p4");
  assert.equal(result.partRanges.p4.count, 2);
  assertConsistency(blocks, result);
});

test("synthetic 5: multiple consecutive explains in preamble all land in p2", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "explain"),
    syntheticBlock("b-003", "explain"),
    syntheticBlock("b-004", "vocab-card"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-002"], "p2");
  assert.equal(result.partOf["b-003"], "p2");
  assert.equal(result.partOf["b-004"], "p3");
  assert.equal(result.partRanges.p2.count, 2);
  assert.equal(result.partRanges.p3.count, 1);
  assertConsistency(blocks, result);
});

test("synthetic 6: explain between hook and section-intro stays in preamble", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "explain"),
    syntheticBlock("b-003", "section-intro"),
    syntheticBlock("b-004", "vocab-card"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p2");
  assert.equal(result.partOf["b-003"], "p3");
  assert.equal(result.partOf["b-004"], "p3");
  assert.equal(result.partRanges.p2.count, 1);
  assert.equal(result.partRanges.p3.count, 2);
  assertConsistency(blocks, result);
});

test("synthetic 7: explain after a P4 section-intro inherits p4 via fallback", () => {
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "breakdown"),
    syntheticBlock("b-003", "section-intro"),
    syntheticBlock("b-004", "explain"),
    syntheticBlock("b-005", "drill-prompt"),
  ];
  const result = splitBlocksToParts(blocks);
  assert.equal(result.partOf["b-001"], "p1");
  assert.equal(result.partOf["b-002"], "p3");
  // section-intro peeks forward to drill-prompt -> p4.
  assert.equal(result.partOf["b-003"], "p4");
  // explain falls back to section-intro (already classified) -> p4.
  assert.equal(result.partOf["b-004"], "p4");
  assert.equal(result.partOf["b-005"], "p4");
  assert.equal(result.partRanges.p3.count, 1);
  assert.equal(result.partRanges.p4.count, 3);
  assertConsistency(blocks, result);
});

test("section-intro with no neighboring anchor throws", () => {
  // hook + section-intro alone, no P3/P4 anywhere.
  const blocks: Block[] = [
    syntheticBlock("b-001", "hook"),
    syntheticBlock("b-002", "section-intro"),
  ];
  assert.throws(
    () => splitBlocksToParts(blocks),
    /section-intro at id=b-002 has no neighboring anchor/,
  );
});

test("empty input yields four empty parts", () => {
  const result = splitBlocksToParts([]);
  assert.equal(result.p1.length, 0);
  assert.equal(result.p2.length, 0);
  assert.equal(result.p3.length, 0);
  assert.equal(result.p4.length, 0);
  assert.equal(result.partRanges.p1.count, 0);
  assert.equal(result.partRanges.p1.start, null);
  assert.equal(Object.keys(result.partOf).length, 0);
});
