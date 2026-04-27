import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendMemoryEntry,
  readMemory,
  selectMemoryForPrompt,
  writeMemory,
  type MemoryEntry,
} from "../../src/lib/creator/writer-memory.ts";

async function makeTmpRoot(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "writer-memory-test-"));
}

function memoryFilePath(root: string): string {
  return path.join(root, "youtube", "writer-memory.md");
}

function entry(
  episodeId: string,
  reason: string,
  diffSummary: string,
  timestamp: string,
  partKey: MemoryEntry["partKey"] = "p3",
  partLabel = "Teaching"
): MemoryEntry {
  return {
    episodeId,
    timestamp,
    partKey,
    partLabel,
    reason,
    diffSummary,
  };
}

test("readMemory on missing file creates default header and returns it", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const filePath = memoryFilePath(root);
  assert.equal(fs.existsSync(filePath), false, "precondition: file missing");

  const body = readMemory(root);

  assert.match(body, /^# Writer Memory\n/, "starts with the writer memory heading");
  assert.match(body, /## Standing notes/, "contains standing notes section");
  assert.equal(fs.existsSync(filePath), true, "header was written to disk");
  assert.equal(fs.readFileSync(filePath, "utf8"), body, "disk matches return value");
});

test("readMemory on existing file returns contents verbatim", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  await fsp.mkdir(path.join(root, "youtube"), { recursive: true });
  const custom = "# Custom Memory\n\nHand-edited body line 1.\nLine 2.\n";
  await fsp.writeFile(memoryFilePath(root), custom, "utf8");

  assert.equal(readMemory(root), custom);
});

test("writeMemory writes atomically and overwrites existing contents", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  writeMemory("first body\n", root);
  assert.equal(fs.readFileSync(memoryFilePath(root), "utf8"), "first body\n");

  writeMemory("second body\n", root);
  assert.equal(fs.readFileSync(memoryFilePath(root), "utf8"), "second body\n");

  // No leftover .tmp files in the youtube dir.
  const siblings = fs.readdirSync(path.join(root, "youtube"));
  assert.deepEqual(
    siblings.filter((s) => s.includes(".tmp")),
    [],
    "no temp files left on disk"
  );
});

test("appendMemoryEntry appends new section with heading, reason, and diff", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // Initialise default header on disk.
  readMemory(root);

  const e1 = entry(
    "YT-S01-E05",
    "Hook felt slow; tighten setup.",
    "kept 12 of 16 blocks; added 4 (b-005, b-007); removed 0.",
    "2026-04-25T14:32:00Z"
  );
  appendMemoryEntry(e1, { repoRoot: root });

  const body = fs.readFileSync(memoryFilePath(root), "utf8");
  assert.match(body, /^# Writer Memory/, "preserves original header");
  assert.match(body, /## YT-S01-E05 - 2026-04-25T14:32:00Z/, "entry heading present");
  assert.match(body, /\*\*Part:\*\* P3 \(Teaching\)/, "part line present");
  assert.match(body, /Hook felt slow; tighten setup\./, "reason text present");
  assert.match(body, /kept 12 of 16 blocks/, "diff summary present");
});

test("appendMemoryEntry appends multiple entries in chronological order", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  readMemory(root);

  const entries = [
    entry("YT-S01-E05", "first reason", "first diff", "2026-04-25T10:00:00Z", "p1", "Sketch"),
    entry("YT-S01-E05", "second reason", "second diff", "2026-04-25T11:00:00Z", "p2", "Context"),
    entry("YT-S01-E05", "third reason", "third diff", "2026-04-25T12:00:00Z", "p3", "Teaching"),
  ];

  for (const e of entries) appendMemoryEntry(e, { repoRoot: root });

  const body = fs.readFileSync(memoryFilePath(root), "utf8");
  const idxFirst = body.indexOf("first reason");
  const idxSecond = body.indexOf("second reason");
  const idxThird = body.indexOf("third reason");
  assert.ok(idxFirst >= 0 && idxSecond >= 0 && idxThird >= 0, "all reasons present");
  assert.ok(
    idxFirst < idxSecond && idxSecond < idxThird,
    "reasons appear in append order"
  );
});

test("selectMemoryForPrompt filters by episodeId without leaking other episodes", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  readMemory(root);
  appendMemoryEntry(
    entry("YT-S01-E05", "e5 reason a", "e5 diff a", "2026-04-25T10:00:00Z"),
    { repoRoot: root }
  );
  appendMemoryEntry(
    entry("YT-S01-E06", "e6 reason a", "e6 diff a", "2026-04-25T10:30:00Z"),
    { repoRoot: root }
  );
  appendMemoryEntry(
    entry("YT-S01-E05", "e5 reason b", "e5 diff b", "2026-04-25T11:00:00Z"),
    { repoRoot: root }
  );

  const out = selectMemoryForPrompt({ episodeId: "YT-S01-E05", repoRoot: root });

  assert.match(out, /^# Recent feedback for YT-S01-E05/, "prefixes heading");
  assert.match(out, /e5 reason a/, "includes first E05 entry");
  assert.match(out, /e5 reason b/, "includes second E05 entry");
  assert.equal(out.includes("YT-S01-E06"), false, "E06 heading not present");
  assert.equal(out.includes("e6 reason"), false, "E06 reason not leaked");
});

test("selectMemoryForPrompt caps at maxEntries returning the most recent", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  readMemory(root);
  for (let i = 0; i < 12; i += 1) {
    const stamp = `2026-04-25T${String(i).padStart(2, "0")}:00:00Z`;
    appendMemoryEntry(
      entry("YT-S01-E05", `reason number ${i}`, `diff number ${i}`, stamp),
      { repoRoot: root }
    );
  }

  const out = selectMemoryForPrompt({
    episodeId: "YT-S01-E05",
    maxEntries: 5,
    repoRoot: root,
  });

  for (let i = 7; i < 12; i += 1) {
    assert.match(out, new RegExp(`reason number ${i}\\b`), `keeps reason ${i}`);
  }
  for (let i = 0; i < 7; i += 1) {
    assert.doesNotMatch(
      out,
      new RegExp(`reason number ${i}\\b`),
      `drops earlier reason ${i}`
    );
  }
});

test("selectMemoryForPrompt returns empty string when no entries match", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // Default header only; no entries appended.
  readMemory(root);
  const out = selectMemoryForPrompt({ episodeId: "YT-S01-E99", repoRoot: root });
  assert.equal(out, "");
});
