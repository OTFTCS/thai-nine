#!/usr/bin/env node
/**
 * W4 step 4: physical M10 renumber.
 *
 *  - Writes `course/exports/id-remap-v1.json` recording the remap.
 *  - Rewrites `full-thai-course-blueprint.v2.csv` so every M10 row gets its
 *    new lesson_id, M10 rows are re-sorted into the new order, and old
 *    M10-L003 (Already/Still/Yet) is merged into new M10-L004 (Past Framing).
 *  - Leaves M10-L003 slot empty so W2a can author Real Conditional there.
 *
 * Old order (v2 pre-remap)            New order
 * -----------------------------------  -----------------------------
 * L001 Past Framing                    L001 Future/จะ           (was L002)
 * L002 Future/จะ                       L002 เคย Experience       (was L007)
 * L003 Already/Still/Yet               L003 (empty, W2a target)
 * L004 Appointments                    L004 Past Framing + aspect (was L001 + L003)
 * L005 Permission/Obligation           L005 Appointments        (was L004)
 * L006 Invitations                     L006 Permission/Obligation (was L005)
 * L007 เคย Experience                  L007 Invitations         (was L006)
 * L008 Short Story                     L008 Short Story         (unchanged)
 * L009 Personal Story Convo            L009 Personal Story Convo(unchanged)
 * L010 Recap                           L010 Recap               (unchanged)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REMAP: Record<string, string> = {
  "M10-L001": "M10-L004",
  "M10-L002": "M10-L001",
  "M10-L004": "M10-L005",
  "M10-L005": "M10-L006",
  "M10-L006": "M10-L007",
  "M10-L007": "M10-L002",
};

const MERGED_INTO_L004 = "M10-L003"; // absorbed, row is deleted

const NEW_M10_ORDER = [
  "M10-L001",
  "M10-L002",
  "M10-L003",
  "M10-L004",
  "M10-L005",
  "M10-L006",
  "M10-L007",
  "M10-L008",
  "M10-L009",
  "M10-L010",
];

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

function appendSemicolon(existing: string, addition: string): string {
  const a = (existing ?? "").trim();
  const b = (addition ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith(";")) return `${a} ${b}`;
  return `${a}; ${b}`;
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const exportsDir = join(root, "course", "exports");
  const v2Path = join(exportsDir, "full-thai-course-blueprint.v2.csv");
  if (!existsSync(v2Path)) {
    console.error(`[remap-m10] v2 CSV missing at ${v2Path}`);
    process.exit(1);
  }

  // --- write id-remap-v1.json ---
  const remapPath = join(exportsDir, "id-remap-v1.json");
  writeFileSync(
    remapPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        description:
          "M10 physical renumber (W4). Maps v2-pre-remap lesson_ids to v2-post-remap lesson_ids. M10-L003 is absorbed into new M10-L004 and has no forward mapping.",
        remap: REMAP,
        merged_into: { [MERGED_INTO_L004]: "M10-L004" },
        deleted: [],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`[remap-m10] wrote ${remapPath}`);

  // --- load v2 CSV ---
  const raw = readFileSync(v2Path, "utf8").split(/\r?\n/).filter(Boolean);
  const header = raw[0];
  const headerCells = parseCsvLine(header);
  const idx = (k: string) => headerCells.indexOf(k);
  const iLessonId = idx("lesson_id");
  const iModule = idx("module_id");
  const iGrammarSec = idx("grammar_function_secondary");
  const iNewVocab = idx("new_vocab_core");
  const iReviewVocab = idx("review_vocab_required");
  const iLessonTitle = idx("lesson_title");
  const iPrimary = idx("lesson_primary_outcome");
  const iSecondary = idx("lesson_secondary_outcome");
  const iNotes = idx("notes");
  if (iLessonId < 0) {
    console.error("[remap-m10] v2 CSV missing lesson_id column");
    process.exit(1);
  }

  const rows = raw.slice(1).map(parseCsvLine);

  // --- pull out M10 rows ---
  const m10Rows = rows.filter((cells) => (cells[iModule] ?? "").trim() === "M10");
  const otherRows = rows.filter((cells) => (cells[iModule] ?? "").trim() !== "M10");

  const byOldId = new Map<string, string[]>();
  for (const cells of m10Rows) byOldId.set((cells[iLessonId] ?? "").trim(), cells);

  // --- merge M10-L003 into M10-L001 (which becomes new M10-L004) ---
  const l001 = byOldId.get("M10-L001");
  const l003 = byOldId.get("M10-L003");
  if (!l001 || !l003) {
    console.error("[remap-m10] expected both M10-L001 and M10-L003 rows in v2 CSV");
    process.exit(1);
  }
  // Grammar secondary: fold L003's primary grammar into L001's secondary slot
  const l003Primary = (l003[iPrimary] ?? "").trim();
  const l003Grammar =
    (l003[idx("grammar_function_primary")] ?? "").trim() ||
    "aspect markers แล้ว / ยัง / ยังไม่";
  const mergedSecondary = l001[iGrammarSec] ? `${l001[iGrammarSec]}; ${l003Grammar}` : l003Grammar;
  l001[iGrammarSec] = mergedSecondary;

  // Vocab: append L003's new_vocab_core into L001's review_vocab_required
  const l003NewVocab = (l003[iNewVocab] ?? "").trim();
  if (l003NewVocab) {
    l001[iReviewVocab] = appendSemicolon(l001[iReviewVocab] ?? "", l003NewVocab);
  }

  // Notes: record the merge
  l001[iNotes] = appendSemicolon(
    l001[iNotes] ?? "",
    "W4-merge: absorbed content of old M10-L003 (Already/Still/Yet) as secondary aspect markers"
  );

  // --- apply remap to lesson_id field ---
  const m10Remapped: string[][] = [];
  for (const cells of m10Rows) {
    const oldId = (cells[iLessonId] ?? "").trim();
    if (oldId === MERGED_INTO_L004) continue; // drop L003; it was merged above
    const newId = REMAP[oldId] ?? oldId;
    cells[iLessonId] = newId;
    m10Remapped.push(cells);
  }

  // --- insert a placeholder shell for new M10-L003 (Real Conditional, to be filled in W2a) ---
  const placeholder: string[] = headerCells.map(() => "");
  placeholder[iLessonId] = "M10-L003";
  placeholder[iModule] = "M10";
  placeholder[idx("stage_id")] = "S3";
  placeholder[idx("cefr_band")] = "A2";
  placeholder[idx("module_title")] = l001[idx("module_title")] ?? "";
  placeholder[iLessonTitle] = "Real Conditional: ถ้า ... ก็ ... (W2a shell)";
  placeholder[idx("status")] = "draft";
  placeholder[iPrimary] = "(W2a shell, authoring pending)";
  placeholder[iSecondary] = "(W2a shell)";
  placeholder[idx("grammar_function_primary")] = "real conditional ถ้า ... ก็ ...";
  placeholder[iGrammarSec] = "";
  placeholder[iNewVocab] = "";
  placeholder[idx("new_chunks_core")] = "";
  placeholder[iReviewVocab] = "";
  placeholder[idx("targets")] = "||||";
  placeholder[idx("lesson_quiz_focus")] = "";
  placeholder[idx("prereq_lessons")] = "";
  placeholder[iNotes] = "W2a-shell: new lesson slot freed by M10 renumber; full spec authored in W2a tier-1.";
  m10Remapped.push(placeholder);

  // --- sort M10 rows by new lesson_id in NEW_M10_ORDER ---
  const orderMap = new Map(NEW_M10_ORDER.map((id, i) => [id, i]));
  m10Remapped.sort((a, b) => {
    const aIdx = orderMap.get((a[iLessonId] ?? "").trim()) ?? 999;
    const bIdx = orderMap.get((b[iLessonId] ?? "").trim()) ?? 999;
    return aIdx - bIdx;
  });

  // --- rebuild CSV with M10 block in correct pipeline position ---
  // Other rows retain original order; M10 rows get inserted after last M09 row.
  const out: string[][] = [];
  let inserted = false;
  for (const cells of otherRows) {
    out.push(cells);
    const mid = (cells[iModule] ?? "").trim();
    if (!inserted && mid === "M09") {
      // keep pushing M09 rows until the next non-M09 row, then insert
    }
  }
  // Re-build: iterate modules in order, inserting M10 block in the right spot
  const finalOut: string[][] = [];
  let m10Inserted = false;
  for (const cells of otherRows) {
    const mid = (cells[iModule] ?? "").trim();
    const numeric = parseInt(mid.replace("M", ""), 10);
    if (!m10Inserted && numeric > 10) {
      finalOut.push(...m10Remapped);
      m10Inserted = true;
    }
    finalOut.push(cells);
  }
  if (!m10Inserted) finalOut.push(...m10Remapped);

  // --- write ---
  const outLines = [header, ...finalOut.map((cells) => cells.map(csvEscape).join(","))];
  writeFileSync(v2Path, outLines.join("\n") + "\n", "utf8");
  console.log(
    `[remap-m10] rewrote ${v2Path} (M10 block now has ${m10Remapped.length} rows in new order)`
  );

  // --- sanity check: every new_M10 id present ---
  const presentIds = new Set<string>();
  for (const cells of m10Remapped) presentIds.add((cells[iLessonId] ?? "").trim());
  const missing = NEW_M10_ORDER.filter((id) => !presentIds.has(id));
  if (missing.length > 0) {
    console.error(`[remap-m10] MISSING ids in output: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`[remap-m10] sanity: all 10 M10 ids present in new order`);
}

main();
