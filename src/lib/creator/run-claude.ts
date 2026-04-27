import { spawnSync as defaultSpawnSync } from "node:child_process";

export type RunClaudeFailure =
  | { ok: false; reason: "claude-cli-missing"; message: string }
  | { ok: false; reason: "unsupported-platform"; message: string }
  | { ok: false; reason: "timeout"; message: string }
  | { ok: false; reason: "non-zero"; status: number; stderr: string };

export type RunClaudeResult =
  | { ok: true; text: string }
  | RunClaudeFailure;

export interface RunClaudeOptions {
  promptText: string;
  systemPromptFile: string;
  timeoutMs?: number;
  // For testing only: inject spawnSync. Defaults to node:child_process spawnSync.
  spawnSyncImpl?: typeof import("node:child_process").spawnSync;
  // For testing only: inject which-claude resolver. Defaults to looking up `claude` on PATH.
  resolveClaudeBin?: () => string | null;
  // For testing only: override platform check. Defaults to process.platform.
  platformOverride?: NodeJS.Platform;
  // For testing only: override Vercel detection. Defaults to !!process.env.VERCEL.
  isVercelOverride?: boolean;
}

const UNSUPPORTED_PLATFORM_MESSAGE =
  "claude CLI requires macOS keychain OAuth; this server cannot run script generation";

const CLAUDE_MISSING_MESSAGE =
  "claude CLI binary not found on PATH. Install Claude Code or ensure `claude` is reachable.";

const TIMEOUT_MESSAGE =
  "claude CLI invocation timed out before producing output";

let cachedClaudeBin: string | null | undefined;

// Test-only: clear the module-level binary resolution cache between cases.
export function __resetClaudeBinCache(): void {
  cachedClaudeBin = undefined;
}

function defaultResolveClaudeBin(): string | null {
  const result = defaultSpawnSync("which", ["claude"], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) return null;
  const out = String(result.stdout ?? "").trim();
  return out.length > 0 ? out : null;
}

function stripFences(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  // Strip the FIRST opening fence and the LAST closing fence.
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) return trimmed;
  const afterFirstFence = trimmed.slice(firstNewline + 1);

  const lastFenceIdx = afterFirstFence.lastIndexOf("```");
  if (lastFenceIdx === -1) return trimmed;

  return afterFirstFence.slice(0, lastFenceIdx).trim();
}

export function runClaude(opts: RunClaudeOptions): RunClaudeResult {
  const platform = opts.platformOverride ?? process.platform;
  const isVercel = opts.isVercelOverride ?? !!process.env.VERCEL;

  if (platform !== "darwin" || isVercel) {
    return {
      ok: false,
      reason: "unsupported-platform",
      message: UNSUPPORTED_PLATFORM_MESSAGE,
    };
  }

  const resolveBin = opts.resolveClaudeBin ?? defaultResolveClaudeBin;
  if (cachedClaudeBin === undefined) {
    cachedClaudeBin = resolveBin();
  }
  const claudeBin = cachedClaudeBin;
  if (!claudeBin) {
    return {
      ok: false,
      reason: "claude-cli-missing",
      message: CLAUDE_MISSING_MESSAGE,
    };
  }

  const args = [
    "-p",
    opts.promptText,
    "--system-prompt-file",
    opts.systemPromptFile,
    "--tools",
    "",
    "--disable-slash-commands",
    "--model",
    "sonnet",
    "--effort",
    "low",
    "--output-format",
    "text",
  ];

  const spawnImpl = opts.spawnSyncImpl ?? defaultSpawnSync;
  const result = spawnImpl(claudeBin, args, {
    timeout: opts.timeoutMs ?? 300_000,
    maxBuffer: 16 << 20,
    encoding: "utf8",
    env: process.env,
  });

  const errCode =
    result.error && typeof result.error === "object"
      ? (result.error as NodeJS.ErrnoException).code
      : undefined;

  if (errCode === "ENOENT") {
    return {
      ok: false,
      reason: "claude-cli-missing",
      message: CLAUDE_MISSING_MESSAGE,
    };
  }

  if (result.signal === "SIGTERM" || errCode === "ETIMEDOUT") {
    return {
      ok: false,
      reason: "timeout",
      message: TIMEOUT_MESSAGE,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      reason: "non-zero",
      status: typeof result.status === "number" ? result.status : -1,
      stderr: String(result.stderr ?? ""),
    };
  }

  const text = stripFences(String(result.stdout ?? ""));
  return { ok: true, text };
}
