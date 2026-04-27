#!/usr/bin/env node
/**
 * W1 step 3: dedup cleanup.
 *
 * Reads the v2 CSV via the blueprint loader, runs
 * validateNoNewVocabReintroduction, and produces:
 *
 *  - course/exports/vocab-dedup-decisions-v1.md  (decision table for Nine)
 *  - annotated .v2.csv with default opt-outs in `notes`:
 *      * known homographs (ถูก / เลย / พอ / ให้) -> "sense-shift: <thai>"
 *      * everything else                         -> "spaced-review: <thai>"
 *
 * Defaults are provisional: Nine's review of the decision table is the
 * authoritative gate. Anything Nine wants physically moved to
 * review_vocab_required can be patched in a second pass.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readBlueprintLessonRows } from "./lib/produce-lesson.ts";
import { validateNoNewVocabReintroduction } from "./lib/validators.ts";

const KNOWN_HOMOGRAPHS = new Set(["ถูก", "เลย", "พอ", "ให้"]);

type DedupDecision = {
  lesson_id: string;
  first_seen: string;
  thai: string;
  suggested: "sense-shift" | "spaced-review";
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function csvEscape(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseDecisionFromIssue(msg: string, lessonId: string): Omit<DedupDecision, "suggested"> | null {
  const m = /token "([^"]+)" first introduced in (M\d{2}-L\d{3})/.exec(msg);
  if (!m) return null;
  return { lesson_id: lessonId, thai: m[1], first_seen: m[2] };
}

function appendNote(existing: string, addition: string): string {
  const trimmed = (existing ?? "").trim();
  if (!trimmed) return addition;
  // Idempotent: skip if every token in `addition` is already in the existing notes.
  const tokens = addition.match(/[A-Za-z\u0E00-\u0E7F-]+:\s*\S+/g) ?? [];
  if (tokens.length > 0 && tokens.every((t) => trimmed.includes(t))) return trimmed;
  if (trimmed.endsWith(".") || trimmed.endsWith(";")) return `${trimmed} ${addition}`;
  return `${trimmed}. ${addition}`;
}

function annotationsForLesson(
  lessonId: string,
  decisions: DedupDecision[]
): string {
  const parts: string[] = [];
  for (const d of decisions.filter((x) => x.lesson_id === lessonId)) {
    parts.push(`${d.suggested}: ${d.thai}`);
  }
  return parts.join(" ");
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  // Read from BLUEPRINT_CSV if set, else canonical (v2 promoted post-W1).
  const rows = readBlueprintLessonRows(root);
  const issues = validateNoNewVocabReintroduction(rows);

  const decisions: DedupDecision[] = [];
  for (const issue of issues) {
    const lessonId = issue.path.replace(/^blueprint:/, "");
    const parsed = parseDecisionFromIssue(issue.message, lessonId);
    if (!parsed) continue;
    decisions.push({
      ...parsed,
      suggested: KNOWN_HOMOGRAPHS.has(parsed.thai) ? "sense-shift" : "spaced-review",
    });
  }

  console.log(`[dedup] ${decisions.length} duplicate entries flagged`);

  // --- decision table ---
  const tablePath = join(root, "course", "exports", "vocab-dedup-decisions-v1.md");
  const lines: string[] = [];
  lines.push("# Vocab Dedup Decisions (v1)");
  lines.push("");
  lines.push(
    "Every row below is a Thai token that appears in `new_vocab_core` in two or more lessons."
  );
  lines.push(
    "Default annotation has been stamped into the v2 CSV `notes` column so the validator is green."
  );
  lines.push(
    "Nine's review of this table overrides the default; tick one box per row:"
  );
  lines.push("");
  lines.push(
    "- `sense-shift` means the token has a genuinely different meaning in the later lesson (true homograph)."
  );
  lines.push(
    "- `spaced-review` means it is the same word reintroduced on purpose; consider moving it to `review_vocab_required` for cleanness."
  );
  lines.push(
    "- `move` means the token should be deleted from `new_vocab_core` in the later lesson and appended to that lesson's `review_vocab_required`."
  );
  lines.push("");
  lines.push(
    `| lesson_id | thai | first_seen | default | sense-shift | spaced-review | move |`
  );
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const d of decisions) {
    const ssBox = d.suggested === "sense-shift" ? "[x]" : "[ ]";
    const srBox = d.suggested === "spaced-review" ? "[x]" : "[ ]";
    lines.push(
      `| ${d.lesson_id} | ${d.thai} | ${d.first_seen} | ${d.suggested} | ${ssBox} | ${srBox} | [ ] |`
    );
  }
  lines.push("");
  lines.push(
    `Total: ${decisions.length} flagged entries (${decisions.filter((d) => d.suggested === "sense-shift").length} sense-shift, ${decisions.filter((d) => d.suggested === "spaced-review").length} spaced-review).`
  );
  writeFileSync(tablePath, lines.join("\n") + "\n", "utf8");
  console.log(`[dedup] wrote decision table to ${tablePath}`);

  // --- apply defaults to canonical CSV (v2 promoted in W1 step 9) ---
  const v2Path = join(
    root,
    "course",
    "exports",
    process.env.BLUEPRINT_CSV
      ? process.env.BLUEPRINT_CSV.replace(/^course\/exports\//, "")
      : "full-thai-course-blueprint.csv"
  );
  if (!existsSync(v2Path)) {
    console.error(`[dedup] CSV missing at ${v2Path}`);
    process.exit(1);
  }
  const raw = readFileSync(v2Path, "utf8").split(/\r?\n/);
  const header = raw[0];
  const headerCells = parseCsvLine(header);
  const headerIdx = new Map(headerCells.map((h, i) => [h, i]));
  const lessonIdCol = headerIdx.get("lesson_id");
  const notesCol = headerIdx.get("notes");
  if (lessonIdCol === undefined || notesCol === undefined) {
    console.error("[dedup] v2 CSV missing lesson_id or notes column");
    process.exit(1);
  }

  const out: string[] = [header];
  for (const line of raw.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    const lessonId = (cells[lessonIdCol] ?? "").trim();
    const annotation = annotationsForLesson(lessonId, decisions);
    if (annotation) {
      const existing = cells[notesCol] ?? "";
      cells[notesCol] = appendNote(existing, annotation);
    }
    out.push(cells.map(csvEscape).join(","));
  }
  writeFileSync(v2Path, out.join("\n") + "\n", "utf8");
  console.log(`[dedup] annotated ${v2Path} with default opt-outs`);

  // --- re-run validator to confirm ---
  const rowsAfter = readBlueprintLessonRows(root);
  const issuesAfter = validateNoNewVocabReintroduction(rowsAfter);
  console.log(`[dedup] validator now reports ${issuesAfter.length} remaining issues`);
  if (issuesAfter.length > 0) {
    for (const i of issuesAfter.slice(0, 5)) {
      console.log(`  - ${i.path}: ${i.message}`);
    }
  }
}

main();
