import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  episodeStatusPath,
  readEpisodeStatus,
  SCRIPT_STATUSES,
  writeEpisodeStatus,
} from "../../src/lib/creator/episode-status.ts";

async function makeTmpRoot(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "episode-status-test-"));
}

function captureConsoleError(): {
  messages: string[];
  restore: () => void;
} {
  const messages: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    messages.push(args.map((a) => String(a)).join(" "));
  };
  return {
    messages,
    restore: () => {
      console.error = original;
    },
  };
}

test("readEpisodeStatus on missing file returns null", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  assert.equal(readEpisodeStatus("YT-S01-E07", root), null);
});

test("writeEpisodeStatus creates file with NOT_STARTED defaults applied", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const out = writeEpisodeStatus("YT-S01-E07", { scriptStatus: "DRAFT" }, root);

  assert.equal(out.episodeId, "YT-S01-E07");
  assert.equal(out.scriptStatus, "DRAFT");
  assert.equal(out.lastError, null);
  assert.match(out.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const stored = readEpisodeStatus("YT-S01-E07", root);
  assert.deepEqual(stored, out, "round trip matches return value");
});

test("writeEpisodeStatus merges patch and advances updatedAt", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const first = writeEpisodeStatus(
    "YT-S01-E08",
    { scriptStatus: "DRAFT" },
    root
  );
  // Force a measurable timestamp delta on fast machines.
  await new Promise((resolve) => setTimeout(resolve, 5));

  const second = writeEpisodeStatus(
    "YT-S01-E08",
    { scriptStatus: "APPROVED", lastError: null },
    root
  );

  assert.equal(second.scriptStatus, "APPROVED");
  assert.equal(second.lastError, null);
  assert.ok(
    new Date(second.updatedAt).getTime() >= new Date(first.updatedAt).getTime(),
    "updatedAt should not regress"
  );
  assert.notEqual(second.updatedAt, first.updatedAt, "updatedAt advances");
});

test("writeEpisodeStatus rejects invalid scriptStatus", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  assert.throws(
    () =>
      writeEpisodeStatus(
        "YT-S01-E09",
        { scriptStatus: "BANANA" as unknown as (typeof SCRIPT_STATUSES)[number] },
        root
      ),
    /invalid scriptStatus: BANANA/
  );

  // Nothing should have been written.
  assert.equal(readEpisodeStatus("YT-S01-E09", root), null);
});

test("readEpisodeStatus returns null when stored scriptStatus is invalid", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  const filePath = episodeStatusPath("YT-S01-E10", root);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(
    filePath,
    JSON.stringify(
      {
        episodeId: "YT-S01-E10",
        scriptStatus: "BANANA",
        updatedAt: "2026-04-25T00:00:00Z",
        lastError: null,
      },
      null,
      2
    ),
    "utf8"
  );

  const cap = captureConsoleError();
  try {
    const result = readEpisodeStatus("YT-S01-E10", root);
    assert.equal(result, null, "invalid status returns null");
    assert.ok(
      cap.messages.some((m) => m.includes("invalid scriptStatus")),
      "warning was emitted to console.error"
    );
  } finally {
    cap.restore();
  }
});

test("writeEpisodeStatus creates parent directory tree when missing", async (t) => {
  const root = await makeTmpRoot();
  t.after(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  // Precondition: youtube/episodes does not exist yet.
  assert.equal(fs.existsSync(path.join(root, "youtube", "episodes")), false);

  writeEpisodeStatus("YT-S01-E07", { scriptStatus: "DRAFT" }, root);

  const expected = path.join(
    root,
    "youtube",
    "episodes",
    "YT-S01-E07",
    "status.json"
  );
  assert.equal(fs.existsSync(expected), true, "status.json was created");
});

test("episodeStatusPath resolves to youtube/episodes/<id>/status.json", () => {
  const root = "/tmp/some/repo";
  const expected = path.join(
    root,
    "youtube",
    "episodes",
    "YT-S01-E11",
    "status.json"
  );
  assert.equal(episodeStatusPath("YT-S01-E11", root), expected);
});
