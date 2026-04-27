import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * One row from `youtube/episode-catalogue.md`.
 *
 * The on-disk catalogue uses lowercase-hyphen `working_topic` slugs (not
 * `YT-S\d{2}-E\d{2}` IDs) and a 1-based `#` column for catalogue position.
 * We synthesise the canonical pipeline id from the position column so this
 * module's output is keyed the same way as the rest of the YouTube pipeline
 * (`youtube/examples/YT-S01-E\d{2}.json`, `youtube/out/YT-S01-E\d{2}/...`).
 */
export interface CatalogueEntry {
  /** Synthesised from the `#` column, pattern: `^YT-S\d{2}-E\d{2}$`. */
  episodeId: string;
  /** Pre-assigned title-style bucket (e.g. "upgrade-offer"). */
  titleBucket: string | null;
  /** Working topic slug, e.g. "ordering-food". May fall back to `category`. */
  topic: string | null;
  /** CEFR level: A0 / A1 / A2 / B1 / B2. */
  level: string | null;
  /** Cross-reference to a follow-up entry (the `recommended_next` slug). */
  lessonRef: string | null;
  /** Raw status string from catalogue, uppercased for stable comparison. */
  status: string | null;
  /** All parsed columns by lowercased header name (preserves originals). */
  raw: Record<string, string>;
}

const CATALOGUE_REL = path.join("youtube", "episode-catalogue.md");
const EPISODE_ID_PATTERN = /^YT-S\d{2}-E\d{2}$/;
const SERIES_PREFIX = "YT-S01-E";

const HEADER_ALIASES: Record<keyof Omit<CatalogueEntry, "raw">, string[]> = {
  episodeId: ["episode", "episodeid", "id"],
  titleBucket: ["title_bucket", "titlebucket", "title", "bucket"],
  topic: ["working_topic", "workingtopic", "topic", "theme", "category"],
  level: ["level", "cefr"],
  lessonRef: ["recommended_next", "recommendednext", "lesson", "lessonref", "ref"],
  status: ["status", "state"],
};

const DONE_STATUSES = new Set(["RECORDED", "WRITTEN", "QUEUED"]);

/**
 * Reads the episode catalogue from disk and returns parsed entries in file
 * order. Returns an empty array if the catalogue is missing or unreadable;
 * format errors fall through to the parser, which skips bad rows.
 */
export function readCatalogue(repoRoot: string = process.cwd()): CatalogueEntry[] {
  const file = path.join(repoRoot, CATALOGUE_REL);
  let markdown: string;
  try {
    markdown = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return parseCatalogueMarkdown(markdown);
}

/** Returns the entry whose synthesised episodeId matches, or null. */
export function findCatalogueEntry(
  id: string,
  repoRoot: string = process.cwd()
): CatalogueEntry | null {
  const entries = readCatalogue(repoRoot);
  return entries.find((entry) => entry.episodeId === id) ?? null;
}

/**
 * Returns the first entry not yet recorded, written, or queued (in catalogue
 * order). Status is compared case-insensitively against the done set; null
 * or empty status is treated as not-started.
 */
export function nextNotStartedEpisode(
  repoRoot: string = process.cwd()
): CatalogueEntry | null {
  const entries = readCatalogue(repoRoot);
  for (const entry of entries) {
    const status = (entry.status ?? "").trim().toUpperCase();
    if (status && DONE_STATUSES.has(status)) continue;
    return entry;
  }
  return null;
}

/**
 * Parses every markdown table in the document and returns rows that look
 * like episode entries. Tables without a recognisable id column are
 * skipped silently; non-episode rows (examples, dividers) are dropped.
 */
export function parseCatalogueMarkdown(markdown: string): CatalogueEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: CatalogueEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const headerLine = lines[i];
    const separatorLine = i + 1 < lines.length ? lines[i + 1] : "";
    if (isTableRow(headerLine) && isSeparatorRow(separatorLine)) {
      const headers = parseRow(headerLine).map((h) => h.toLowerCase());
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j])) {
        const cells = parseRow(lines[j]);
        const entry = buildEntry(headers, cells);
        if (entry) entries.push(entry);
        j += 1;
      }
      i = j;
      continue;
    }
    i += 1;
  }

  return entries;
}

function isTableRow(line: string | undefined): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length >= 2;
}

function isSeparatorRow(line: string | undefined): boolean {
  if (!isTableRow(line)) return false;
  const cells = parseRow(line!);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseRow(line: string): string[] {
  const trimmed = line.trim();
  // Strip leading and trailing pipes once before splitting so empty edge
  // cells from `|...|` don't pollute the column list.
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

function buildEntry(
  headers: string[],
  cells: string[]
): CatalogueEntry | null {
  if (headers.length === 0) return null;

  const raw: Record<string, string> = {};
  for (let k = 0; k < headers.length; k += 1) {
    const key = headers[k];
    if (!key) continue;
    raw[key] = (cells[k] ?? "").trim();
  }

  const episodeId = resolveEpisodeId(raw);
  if (!episodeId) return null;

  return {
    episodeId,
    titleBucket: pickAlias(raw, HEADER_ALIASES.titleBucket),
    topic: pickAlias(raw, HEADER_ALIASES.topic),
    level: pickAlias(raw, HEADER_ALIASES.level),
    lessonRef: pickAlias(raw, HEADER_ALIASES.lessonRef),
    status: normaliseStatus(pickAlias(raw, HEADER_ALIASES.status)),
    raw,
  };
}

function resolveEpisodeId(raw: Record<string, string>): string | null {
  // Direct match: the row already carries a YT-S01-E\d{2} id in some cell.
  for (const value of Object.values(raw)) {
    if (EPISODE_ID_PATTERN.test(value)) return value;
  }
  // Fall back to the catalogue position column. The on-disk file uses `#`
  // as 1..40; we synthesise YT-S01-E01..40 so consumers can key the same
  // way as the rest of the YouTube pipeline.
  const positionRaw = raw["#"] ?? raw["num"] ?? raw["no"];
  if (positionRaw) {
    const n = Number.parseInt(positionRaw, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 99) {
      return `${SERIES_PREFIX}${String(n).padStart(2, "0")}`;
    }
  }
  return null;
}

function pickAlias(
  raw: Record<string, string>,
  aliases: readonly string[]
): string | null {
  for (const alias of aliases) {
    const value = raw[alias];
    if (value && value.trim() !== "" && value.trim() !== "—") {
      return value.trim();
    }
  }
  return null;
}

function normaliseStatus(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toUpperCase();
}
