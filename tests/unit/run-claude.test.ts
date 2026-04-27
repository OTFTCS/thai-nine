import test from "node:test";
import assert from "node:assert/strict";
import {
  runClaude,
  __resetClaudeBinCache,
  type RunClaudeOptions,
} from "../../src/lib/creator/run-claude.ts";
import type { spawnSync as SpawnSync } from "node:child_process";

type SpawnArgs = Parameters<typeof SpawnSync>;
type SpawnReturn = ReturnType<typeof SpawnSync>;

interface SpawnCall {
  bin: string;
  args: string[];
  options: SpawnArgs[2];
}

function makeSpawn(
  result: Partial<SpawnReturn>,
  calls: SpawnCall[] = []
): typeof SpawnSync {
  return ((bin: string, args: readonly string[] = [], options) => {
    calls.push({
      bin,
      args: [...args],
      options: options as SpawnArgs[2],
    });
    return {
      pid: 0,
      output: [],
      stdout: "",
      stderr: "",
      status: 0,
      signal: null,
      ...result,
    } as SpawnReturn;
  }) as unknown as typeof SpawnSync;
}

function baseOpts(
  overrides: Partial<RunClaudeOptions> = {}
): RunClaudeOptions {
  return {
    promptText: "hello",
    systemPromptFile: "/tmp/sys.md",
    resolveClaudeBin: () => "/usr/local/bin/claude",
    platformOverride: "darwin",
    isVercelOverride: false,
    ...overrides,
  };
}

test("runClaude: happy path with raw JSON output", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn(
        { status: 0, stdout: '{"hello":"world"}', stderr: "" },
        calls
      ),
    })
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, '{"hello":"world"}');
  }
});

test("runClaude: happy path with ```json fence stripped", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({
        status: 0,
        stdout: '```json\n{"a":1}\n```',
        stderr: "",
      }),
    })
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, '{"a":1}');
  }
});

test("runClaude: happy path with bare ``` fence stripped", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({
        status: 0,
        stdout: "```\nhello\n```",
        stderr: "",
      }),
    })
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, "hello");
  }
});

test("runClaude: passes required flags in the expected order", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  runClaude(
    baseOpts({
      promptText: "PROMPT",
      systemPromptFile: "/tmp/system.md",
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "ok" }, calls),
    })
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.args, [
    "-p",
    "PROMPT",
    "--system-prompt-file",
    "/tmp/system.md",
    "--tools",
    "",
    "--disable-slash-commands",
    "--model",
    "sonnet",
    "--effort",
    "low",
    "--output-format",
    "text",
  ]);
});

test("runClaude: ENOENT during spawn returns claude-cli-missing", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: { code: "ENOENT" } as any,
      }),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "claude-cli-missing");
  }
});

test("runClaude: SIGTERM signals timeout and discards partial stdout", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({
        signal: "SIGTERM",
        stdout: "partial output to discard",
      }),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "timeout");
    assert.equal(
      Object.prototype.hasOwnProperty.call(result, "text"),
      false,
      "timeout result must not carry a text field"
    );
  }
});

test("runClaude: ETIMEDOUT error returns timeout", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: { code: "ETIMEDOUT" } as any,
      }),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "timeout");
  }
});

test("runClaude: non-zero exit returns status and stderr", () => {
  __resetClaudeBinCache();
  const result = runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({ status: 2, stderr: "boom" }),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok && result.reason === "non-zero") {
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "boom");
  } else {
    assert.fail("expected non-zero failure");
  }
});

test("runClaude: linux platform returns unsupported-platform without spawning", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  const result = runClaude(
    baseOpts({
      platformOverride: "linux",
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "should not run" }, calls),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "unsupported-platform");
  }
  assert.equal(calls.length, 0, "spawnSync must not be called on linux");
});

test("runClaude: Vercel runtime returns unsupported-platform without spawning", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  const result = runClaude(
    baseOpts({
      platformOverride: "darwin",
      isVercelOverride: true,
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "should not run" }, calls),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "unsupported-platform");
  }
  assert.equal(calls.length, 0, "spawnSync must not be called on Vercel");
});

test("runClaude: missing claude binary returns claude-cli-missing without spawning", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  const result = runClaude(
    baseOpts({
      resolveClaudeBin: () => null,
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "should not run" }, calls),
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "claude-cli-missing");
  }
  assert.equal(calls.length, 0, "spawnSync must not be called when binary is missing");
});

test("runClaude: timeoutMs default is 300_000", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  runClaude(
    baseOpts({
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "ok" }, calls),
    })
  );
  assert.equal(calls.length, 1);
  const opts = calls[0]!.options as { timeout?: number };
  assert.equal(opts?.timeout, 300_000);
});

test("runClaude: timeoutMs override is forwarded to spawnSync", () => {
  __resetClaudeBinCache();
  const calls: SpawnCall[] = [];
  runClaude(
    baseOpts({
      timeoutMs: 1000,
      spawnSyncImpl: makeSpawn({ status: 0, stdout: "ok" }, calls),
    })
  );
  assert.equal(calls.length, 1);
  const opts = calls[0]!.options as { timeout?: number };
  assert.equal(opts?.timeout, 1000);
});
