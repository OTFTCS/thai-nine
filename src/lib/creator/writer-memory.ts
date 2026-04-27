import fs from "node:fs";
import path from "node:path";

export interface MemoryEntry {
  episodeId: string;
  timestamp: string;
  partKey: "p1" | "p2" | "p3" | "p4";
  partLabel: string;
  reason: string;
  diffSummary: string;
}

export interface AppendOptions {
  repoRoot?: string;
}

const MEMORY_REL = path.join("youtube", "writer-memory.md");

const DEFAULT_HEADER = `# Writer Memory

This file accumulates feedback across YouTube script regenerations. Each entry is appended automatically when Nine clicks "Regenerate" on a script part and provides a reason. Edit freely; the file is read into the LLM prompt at generation time, scoped to the current episode.

## Standing notes

(Add timeless guidance here, e.g. "Keep hooks under 8 seconds." Standing notes are not auto-appended; edit by hand.)

`;

function memoryPath(repoRoot?: string): string {
  return path.join(repoRoot ?? process.cwd(), MEMORY_REL);
}

function atomicWrite(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, filePath);
}

export function readMemory(repoRoot?: string): string {
  const filePath = memoryPath(repoRoot);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    atomicWrite(filePath, DEFAULT_HEADER);
    return DEFAULT_HEADER;
  }
}

export function writeMemory(body: string, repoRoot?: string): void {
  atomicWrite(memoryPath(repoRoot), body);
}

function formatEntry(entry: MemoryEntry): string {
  const partUpper = entry.partKey.toUpperCase();
  return [
    `## ${entry.episodeId} - ${entry.timestamp}`,
    `**Part:** ${partUpper} (${entry.partLabel})`,
    `**Reason:** ${entry.reason}`,
    `**Diff:** ${entry.diffSummary}`,
    "",
    "",
  ].join("\n");
}

export function appendMemoryEntry(
  entry: MemoryEntry,
  opts: AppendOptions = {}
): void {
  const current = readMemory(opts.repoRoot);
  const trailing = current.endsWith("\n") ? "" : "\n";
  const next = `${current}${trailing}${formatEntry(entry)}`;
  writeMemory(next, opts.repoRoot);
}

interface SelectOptions {
  episodeId: string;
  maxEntries?: number;
  repoRoot?: string;
}

export function selectMemoryForPrompt(opts: SelectOptions): string {
  const { episodeId, maxEntries = 10, repoRoot } = opts;
  const body = readMemory(repoRoot);
  const lines = body.split("\n");

  // Walk lines, capturing each "## <episodeId> - ..." section until the next
  // "## " heading or EOF. Sections from other episodes are ignored.
  const matchPrefix = `## ${episodeId} - `;
  const entries: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const isHeading = line.startsWith("## ");
    if (isHeading) {
      if (current) {
        entries.push(current.join("\n").replace(/\s+$/, ""));
        current = null;
      }
      if (line.startsWith(matchPrefix)) {
        current = [line];
      }
    } else if (current) {
      current.push(line);
    }
  }
  if (current) {
    entries.push(current.join("\n").replace(/\s+$/, ""));
  }

  if (entries.length === 0) return "";

  const recent = entries.slice(-maxEntries);
  const head = `# Recent feedback for ${episodeId}`;
  return `${head}\n\n${recent.join("\n\n")}\n`;
}
