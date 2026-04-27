import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  diffBlocksById,
  extractJson,
  formatDiffSummary,
  generateScript,
  regeneratePart,
  scriptPath as resolveScriptPath,
  snapshotDir,
  spliceBlocks,
} from "../../src/lib/creator/youtube-script.ts";
import type { Block } from "../../src/lib/creator/youtube-script-parts.ts";
import type { RunClaudeOptions, RunClaudeResult } from "../../src/lib/creator/run-claude.ts";

// ---------- Helpers ----------

async function makeTmpRoot(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "yt-script-splice-test-"));
}

function block(id: string, mode = "explain"): Block {
  return { id, mode, lines: [] };
}

function makeBlocks(ids: string[]): Block[] {
  return ids.map((id) => block(id));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeFile(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, "utf8");
}

const MINIMAL_CATALOGUE = [
  "## Catalogue",
  "| # | working_topic | category | level | title_bucket | angle | recommended_next | status |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  "| 99 | test-topic | general | A0 | upgrade-offer | test angle | — | not_started |",
  "",
].join("\n");

function makeMinimalScript(episodeId: string) {
  // P3 = b-003..b-005 (vocab-card, breakdown, breakdown).
  // P4 = b-006..b-008 (drill-prompt, drill-answer, recap).
  return {
    schemaVersion: 2,
    episodeId,
    seriesId: "S01",
    seriesName: "Standalone",
    title: "Test Episode",
    topic: "test-topic",
    level: "A0",
    blocks: [
      {
        id: "b-001",
        mode: "hook",
        lines: [{ id: "l-001", lang: "en", english: "hi", speaker: "A" }],
      },
      {
        id: "b-002",
        mode: "explain",
        lines: [{ id: "l-002", lang: "en", english: "intro" }],
      },
      {
        id: "b-003",
        mode: "vocab-card",
        vocabRefs: ["v-001"],
        lines: [{ id: "l-003", lang: "en", english: "card v-001" }],
      },
      {
        id: "b-004",
        mode: "breakdown",
        lines: [{ id: "l-004", lang: "th", thai: "ทดสอบ", translit: "thót-sàawp" }],
      },
      {
        id: "b-005",
        mode: "breakdown",
        lines: [{ id: "l-005", lang: "th", thai: "อีก", translit: "ìik" }],
      },
      {
        id: "b-006",
        mode: "drill-prompt",
        lines: [{ id: "l-006", lang: "en", english: "your turn" }],
      },
      {
        id: "b-007",
        mode: "drill-answer",
        lines: [{ id: "l-007", lang: "th", thai: "ตอบ", translit: "tàawp" }],
      },
      {
        id: "b-008",
        mode: "recap",
        lines: [{ id: "l-008", lang: "en", english: "wrap" }],
      },
    ],
    vocab: [{ id: "v-001", thai: "ทดสอบ", translit: "thót-sàawp", english: "test" }],
  };
}

// Simulate a minimal runClaude type, return value matches RunClaudeResult.
type MockRunClaude = (opts: RunClaudeOptions) => RunClaudeResult;

function captureRunClaudeArgs(
  result: RunClaudeResult
): { mock: MockRunClaude; calls: RunClaudeOptions[] } {
  const calls: RunClaudeOptions[] = [];
  const mock: MockRunClaude = (opts) => {
    calls.push(opts);
    return result;
  };
  return { mock, calls };
}

// ---------- spliceBlocks ----------

test("spliceBlocks replaces a single-block range", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003", "b-004", "b-005"]);
  const replacement = [block("new")];
  const out = spliceBlocks(
    original,
    { start: "b-002", end: "b-002" },
    replacement
  );
  assert.deepEqual(
    out.map((b) => b.id),
    ["b-001", "new", "b-003", "b-004", "b-005"]
  );
});

test("spliceBlocks replaces a multi-block range", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003", "b-004", "b-005"]);
  const replacement = [block("x"), block("y")];
  const out = spliceBlocks(
    original,
    { start: "b-002", end: "b-004" },
    replacement
  );
  assert.deepEqual(
    out.map((b) => b.id),
    ["b-001", "x", "y", "b-005"]
  );
});

test("spliceBlocks replaces with longer array (total grows)", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003"]);
  const replacement = [block("x"), block("y"), block("z")];
  const out = spliceBlocks(
    original,
    { start: "b-002", end: "b-002" },
    replacement
  );
  assert.deepEqual(
    out.map((b) => b.id),
    ["b-001", "x", "y", "z", "b-003"]
  );
  assert.equal(out.length, 5);
});

test("spliceBlocks replaces with empty array (total shrinks)", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003"]);
  const out = spliceBlocks(original, { start: "b-002", end: "b-002" }, []);
  assert.deepEqual(
    out.map((b) => b.id),
    ["b-001", "b-003"]
  );
  assert.equal(out.length, 2);
});

test("spliceBlocks throws on missing start id", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003"]);
  assert.throws(
    () =>
      spliceBlocks(
        original,
        { start: "b-999", end: "b-002" },
        [block("new")]
      ),
    /start id not found/
  );
});

test("spliceBlocks throws on missing end id", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003"]);
  assert.throws(
    () =>
      spliceBlocks(
        original,
        { start: "b-002", end: "b-999" },
        [block("new")]
      ),
    /end id not found/
  );
});

test("spliceBlocks does not mutate the original input", () => {
  const original = makeBlocks(["b-001", "b-002", "b-003"]);
  const snapshot = original.map((b) => b.id);
  spliceBlocks(original, { start: "b-002", end: "b-002" }, [block("new")]);
  assert.deepEqual(
    original.map((b) => b.id),
    snapshot
  );
});

test("spliceBlocks with both nulls inserts replacement at end", () => {
  const original = makeBlocks(["b-001", "b-002"]);
  const out = spliceBlocks(
    original,
    { start: null, end: null },
    [block("x")]
  );
  assert.deepEqual(
    out.map((b) => b.id),
    ["b-001", "b-002", "x"]
  );
});

test("spliceBlocks with one null throws", () => {
  const original = makeBlocks(["b-001", "b-002"]);
  assert.throws(
    () =>
      spliceBlocks(original, { start: "b-001", end: null }, [block("x")]),
    /requires both start and end/
  );
});

// ---------- diffBlocksById ----------

test("diffBlocksById computes kept / added / removed", () => {
  const prev = [block("a"), block("b"), block("c")];
  const next = [block("b"), block("d"), block("c")];
  const diff = diffBlocksById(prev, next);
  assert.deepEqual(diff.kept.sort(), ["b", "c"]);
  assert.deepEqual(diff.added, ["d"]);
  assert.deepEqual(diff.removed, ["a"]);
});

// ---------- formatDiffSummary ----------

test("formatDiffSummary truncates long added id lists", () => {
  const added = Array.from({ length: 10 }, (_, i) => `n-${i}`);
  const summary = formatDiffSummary(
    { kept: [], added, removed: [] },
    16
  );
  // Should mention "added 10" and only show the first 5 ids before "...".
  assert.match(summary, /added 10/);
  assert.match(summary, /n-0, n-1, n-2, n-3, n-4, \.\.\./);
  // Should not include n-5+ in the parenthetical id list.
  assert.equal(summary.includes("n-5"), false);
});

test("formatDiffSummary on a clean replace reads naturally", () => {
  const summary = formatDiffSummary(
    { kept: ["b-001"], added: ["b-002"], removed: ["b-003"] },
    2
  );
  assert.match(summary, /kept 1 of 2 blocks/);
  assert.match(summary, /added 1 \(b-002\)/);
  assert.match(summary, /removed 1 \(b-003\)/);
});

// ---------- extractJson ----------

test("extractJson parses raw JSON", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson("[1,2,3]"), [1, 2, 3]);
});

test("extractJson strips ```json fences", () => {
  const input = '```json\n{"a":1}\n```';
  assert.deepEqual(extractJson(input), { a: 1 });
});

test("extractJson strips bare ``` fences", () => {
  const input = '```\n{"b":2}\n```';
  assert.deepEqual(extractJson(input), { b: 2 });
});

test("extractJson surrounding whitespace and bare fence around array", () => {
  const input = '   ```\n[1,2,3]\n```   ';
  assert.deepEqual(extractJson(input), [1, 2, 3]);
});

test("extractJson throws with offending snippet", () => {
  assert.throws(
    () => extractJson("not json {{{"),
    /failed to parse JSON.*not json/
  );
});

// ---------- regeneratePart happy path ----------

test("regeneratePart happy path: writes script, takes snapshot, appends memory, sets DRAFT", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const episodeId = "YT-S01-E99";
  writeFile(
    path.join(root, "youtube", "episode-catalogue.md"),
    MINIMAL_CATALOGUE
  );
  writeJson(resolveScriptPath(episodeId, root), makeMinimalScript(episodeId));
  // Provide a placeholder system prompt file so the orchestration can resolve
  // it, although our mocked runClaude does not consume it.
  writeFile(
    path.join(root, "youtube", "prompts", "script-writing.prompt.md"),
    "system prompt placeholder"
  );

  const replacementBlocks: Block[] = [
    {
      id: "b-003",
      mode: "vocab-card",
      vocabRefs: ["v-001"],
      lines: [{ id: "l-003", lang: "en", english: "regenerated card" }],
    },
    {
      id: "b-009",
      mode: "breakdown",
      lines: [
        { id: "l-009", lang: "th", thai: "ใหม่", translit: "mài" },
      ],
    },
  ];
  const claudeResult: RunClaudeResult = {
    ok: true,
    text: JSON.stringify(replacementBlocks),
  };
  const { mock: runClaudeImpl, calls: runCalls } =
    captureRunClaudeArgs(claudeResult);

  const validateCalls: string[] = [];
  const validateImpl = (filePath: string) => {
    validateCalls.push(filePath);
    return { ok: true, output: "ok" };
  };

  const outcome = await regeneratePart({
    episodeId,
    partKey: "p3",
    instruction: "make it punchier",
    reason: "card felt flat",
    repoRoot: root,
    runClaudeImpl,
    validateImpl,
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  // Script file updated.
  const stored = JSON.parse(
    fs.readFileSync(resolveScriptPath(episodeId, root), "utf8")
  ) as { blocks: { id: string }[] };
  const ids = stored.blocks.map((b) => b.id);
  // P3 was b-003..b-005, replaced with b-003 + b-009. So new full list:
  // b-001, b-002, b-003, b-009, b-006, b-007, b-008.
  assert.deepEqual(ids, [
    "b-001",
    "b-002",
    "b-003",
    "b-009",
    "b-006",
    "b-007",
    "b-008",
  ]);

  // Snapshot file exists.
  assert.ok(
    fs.existsSync(outcome.snapshotPath),
    "snapshot file should exist on disk"
  );
  const snapDir = snapshotDir(episodeId, root);
  const snapEntries = fs.readdirSync(snapDir);
  assert.equal(snapEntries.length, 1);

  // Memory entry appended.
  const memory = fs.readFileSync(
    path.join(root, "youtube", "writer-memory.md"),
    "utf8"
  );
  assert.match(memory, /## YT-S01-E99 - /);
  assert.match(memory, /\*\*Part:\*\* P3 \(Teaching\)/);
  assert.match(memory, /\*\*Reason:\*\* card felt flat/);

  // Status updated to DRAFT.
  const statusPath = path.join(
    root,
    "youtube",
    "episodes",
    episodeId,
    "status.json"
  );
  const status = JSON.parse(fs.readFileSync(statusPath, "utf8")) as {
    scriptStatus: string;
    lastError: string | null;
  };
  assert.equal(status.scriptStatus, "DRAFT");
  assert.equal(status.lastError, null);

  // Diff fields are sane: kept = b-003, added = b-009, removed = b-004,b-005.
  assert.deepEqual(outcome.diff.kept, ["b-003"]);
  assert.deepEqual(outcome.diff.added, ["b-009"]);
  assert.deepEqual(outcome.diff.removed.sort(), ["b-004", "b-005"]);

  // Sanity: claude was called once with the expected system prompt.
  assert.equal(runCalls.length, 1);
  assert.match(
    runCalls[0]!.systemPromptFile,
    /script-writing\.prompt\.md$/
  );
  assert.equal(validateCalls.length, 1);
});

// ---------- regeneratePart validation failure ----------

test("regeneratePart validation failure preserves original and snapshot", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const episodeId = "YT-S01-E99";
  writeFile(
    path.join(root, "youtube", "episode-catalogue.md"),
    MINIMAL_CATALOGUE
  );
  const original = makeMinimalScript(episodeId);
  writeJson(resolveScriptPath(episodeId, root), original);
  writeFile(
    path.join(root, "youtube", "prompts", "script-writing.prompt.md"),
    "system prompt placeholder"
  );

  const replacementBlocks: Block[] = [
    {
      id: "b-003",
      mode: "vocab-card",
      vocabRefs: ["v-001"],
      lines: [{ id: "l-003", lang: "en", english: "bad" }],
    },
  ];
  const claudeResult: RunClaudeResult = {
    ok: true,
    text: JSON.stringify(replacementBlocks),
  };
  const { mock: runClaudeImpl } = captureRunClaudeArgs(claudeResult);

  const validateImpl = () => ({
    ok: false,
    output: "schema error: missing required field xyz",
  });

  const outcome = await regeneratePart({
    episodeId,
    partKey: "p3",
    instruction: "x",
    reason: "y",
    repoRoot: root,
    runClaudeImpl,
    validateImpl,
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, "validation");
  assert.match(String(outcome.details), /schema error/);

  // Original script untouched.
  const storedOriginal = JSON.parse(
    fs.readFileSync(resolveScriptPath(episodeId, root), "utf8")
  );
  assert.deepEqual(storedOriginal, original);

  // Snapshot was taken before the attempt.
  const snapEntries = fs.readdirSync(snapshotDir(episodeId, root));
  assert.equal(snapEntries.length, 1);

  // Draft remains for debugging.
  const draftPath = `${resolveScriptPath(episodeId, root)}.draft.json`;
  assert.ok(
    fs.existsSync(draftPath),
    "draft file should remain on validation failure"
  );

  // Status was NOT updated to DRAFT (file should not exist or remain prior).
  const statusFile = path.join(
    root,
    "youtube",
    "episodes",
    episodeId,
    "status.json"
  );
  if (fs.existsSync(statusFile)) {
    const status = JSON.parse(fs.readFileSync(statusFile, "utf8")) as {
      scriptStatus: string;
    };
    assert.notEqual(status.scriptStatus, "DRAFT");
  }
});

// ---------- regeneratePart claude-cli-missing propagates ----------

test("regeneratePart propagates claude-cli-missing", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const episodeId = "YT-S01-E99";
  writeFile(
    path.join(root, "youtube", "episode-catalogue.md"),
    MINIMAL_CATALOGUE
  );
  const original = makeMinimalScript(episodeId);
  writeJson(resolveScriptPath(episodeId, root), original);
  writeFile(
    path.join(root, "youtube", "prompts", "script-writing.prompt.md"),
    "system prompt placeholder"
  );

  const claudeResult: RunClaudeResult = {
    ok: false,
    reason: "claude-cli-missing",
    message: "no claude binary",
  };
  const { mock: runClaudeImpl } = captureRunClaudeArgs(claudeResult);

  const validateImpl = () => ({ ok: true, output: "ok" });

  const outcome = await regeneratePart({
    episodeId,
    partKey: "p3",
    instruction: "x",
    reason: "y",
    repoRoot: root,
    runClaudeImpl,
    validateImpl,
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, "claude-cli-missing");

  // Script unchanged.
  const stored = JSON.parse(
    fs.readFileSync(resolveScriptPath(episodeId, root), "utf8")
  );
  assert.deepEqual(stored, original);
});

// ---------- generateScript happy path ----------

test("generateScript happy path writes script and sets DRAFT", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const episodeId = "YT-S01-E99";
  writeFile(
    path.join(root, "youtube", "episode-catalogue.md"),
    MINIMAL_CATALOGUE
  );
  writeFile(
    path.join(root, "youtube", "prompts", "script-writing.prompt.md"),
    "system prompt placeholder"
  );

  const generatedScript = makeMinimalScript(episodeId);
  const claudeResult: RunClaudeResult = {
    ok: true,
    text: JSON.stringify(generatedScript),
  };
  const { mock: runClaudeImpl } = captureRunClaudeArgs(claudeResult);

  const validateImpl = () => ({ ok: true, output: "ok" });

  const outcome = await generateScript({
    episodeId,
    repoRoot: root,
    runClaudeImpl,
    validateImpl,
  });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  // Script file written.
  const stored = JSON.parse(
    fs.readFileSync(resolveScriptPath(episodeId, root), "utf8")
  );
  assert.equal((stored as { episodeId: string }).episodeId, episodeId);

  // Status file shows DRAFT.
  const statusPath = path.join(
    root,
    "youtube",
    "episodes",
    episodeId,
    "status.json"
  );
  const status = JSON.parse(fs.readFileSync(statusPath, "utf8")) as {
    scriptStatus: string;
  };
  assert.equal(status.scriptStatus, "DRAFT");
});

test("generateScript returns no-catalogue-entry when episode is missing", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // No catalogue file present.
  writeFile(
    path.join(root, "youtube", "prompts", "script-writing.prompt.md"),
    "x"
  );
  const claudeResult: RunClaudeResult = { ok: true, text: "{}" };
  const { mock: runClaudeImpl } = captureRunClaudeArgs(claudeResult);
  const validateImpl = () => ({ ok: true, output: "ok" });

  const outcome = await generateScript({
    episodeId: "YT-S01-E99",
    repoRoot: root,
    runClaudeImpl,
    validateImpl,
  });
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, "no-catalogue-entry");
});
