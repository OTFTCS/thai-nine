import fs from "node:fs";
import path from "node:path";

export type ScriptStatus = "NOT_STARTED" | "DRAFT" | "APPROVED" | "RECORDED";

export interface EpisodeStatus {
  episodeId: string;
  scriptStatus: ScriptStatus;
  updatedAt: string;
  lastError: string | null;
}

export const SCRIPT_STATUSES: ReadonlyArray<ScriptStatus> = [
  "NOT_STARTED",
  "DRAFT",
  "APPROVED",
  "RECORDED",
];

function isScriptStatus(value: unknown): value is ScriptStatus {
  return (
    typeof value === "string" &&
    (SCRIPT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export function episodeStatusPath(
  episodeId: string,
  repoRoot?: string
): string {
  return path.join(
    repoRoot ?? process.cwd(),
    "youtube",
    "episodes",
    episodeId,
    "status.json"
  );
}

function atomicWrite(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, filePath);
}

export function readEpisodeStatus(
  episodeId: string,
  repoRoot?: string
): EpisodeStatus | null {
  const filePath = episodeStatusPath(episodeId, repoRoot);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(
      `[episode-status] invalid JSON in ${filePath}; ignoring stored status.`
    );
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    console.error(
      `[episode-status] non-object payload in ${filePath}; ignoring stored status.`
    );
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const status = obj.scriptStatus;
  if (!isScriptStatus(status)) {
    console.error(
      `[episode-status] invalid scriptStatus value (${String(status)}) in ${filePath}; ignoring.`
    );
    return null;
  }

  const id =
    typeof obj.episodeId === "string" && obj.episodeId.length > 0
      ? obj.episodeId
      : episodeId;
  const updatedAt =
    typeof obj.updatedAt === "string"
      ? obj.updatedAt
      : new Date(0).toISOString();
  const lastError =
    typeof obj.lastError === "string" ? obj.lastError : null;

  return {
    episodeId: id,
    scriptStatus: status,
    updatedAt,
    lastError,
  };
}

type WritablePatch = Partial<Omit<EpisodeStatus, "episodeId" | "updatedAt">>;

export function writeEpisodeStatus(
  episodeId: string,
  patch: WritablePatch,
  repoRoot?: string
): EpisodeStatus {
  if (
    Object.prototype.hasOwnProperty.call(patch, "scriptStatus") &&
    !isScriptStatus(patch.scriptStatus)
  ) {
    throw new Error(`invalid scriptStatus: ${String(patch.scriptStatus)}`);
  }

  const existing = readEpisodeStatus(episodeId, repoRoot);
  const base: EpisodeStatus = existing ?? {
    episodeId,
    scriptStatus: "NOT_STARTED",
    updatedAt: new Date(0).toISOString(),
    lastError: null,
  };

  const merged: EpisodeStatus = {
    episodeId,
    scriptStatus: patch.scriptStatus ?? base.scriptStatus,
    lastError:
      Object.prototype.hasOwnProperty.call(patch, "lastError")
        ? (patch.lastError ?? null)
        : base.lastError,
    updatedAt: new Date().toISOString(),
  };

  const filePath = episodeStatusPath(episodeId, repoRoot);
  atomicWrite(filePath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}
