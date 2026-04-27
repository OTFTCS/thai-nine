#!/usr/bin/env node
/**
 * W6 partial — apply only the 3 scenario-compatible inserts that don't
 * require a Nine co-working session. The remaining ~50 audit items stay
 * deferred per course/exports/w6-tbd.md until Nine reviews scenario layout.
 *
 * Compatible inserts:
 *  1. M03-L008 (Classifiers + family overflow) — append kin terms
 *     ลุง / ป้า / ยาย / ตา to new_vocab_core
 *  2. M04-L007 (Paying the Bill) — append chunks เช็คบิล / คิดเงินด้วย /
 *     ไม่เผ็ด to new_chunks_core
 *  3. M05-L003 (Daily Routines) — append motion verbs
 *     นั่ง / ยืน / เดิน / วิ่ง to new_vocab_core
 *
 * Idempotent: skips inserts already present.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type VocabInsert = { lesson_id: string; column: "new_vocab_core" | "new_chunks_core"; entries: string[]; note: string };

const INSERTS: VocabInsert[] = [
  {
    lesson_id: "M03-L008",
    column: "new_vocab_core",
    entries: [
      "ลุง = uncle (father's older brother / any middle-aged man)",
      "ป้า = aunt (mother's older sister / any middle-aged woman)",
      "ยาย = maternal grandmother / elderly woman",
      "ตา = maternal grandfather / elderly man",
    ],
    note: "W6-insert: kin-term overflow from M03-L007 (compatible with classifier+family scope)",
  },
  {
    lesson_id: "M04-L007",
    column: "new_chunks_core",
    entries: [
      "เช็คบิล = check / bill please",
      "คิดเงินด้วย = please calculate / settle up",
      "ไม่เผ็ด = not spicy",
    ],
    note: "W6-insert: payment + spice-level chunks for the 'How to Pay the Bill' top-20 retitle",
  },
  {
    lesson_id: "M05-L003",
    column: "new_vocab_core",
    entries: [
      "นั่ง = sit",
      "ยืน = stand",
      "เดิน = walk",
      "วิ่ง = run",
    ],
    note: "W6-insert: motion-verb bundle compatible with daily-routine framing",
  },
];

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i += 1; }
      else q = !q;
      continue;
    }
    if (ch === "," && !q) { cells.push(cur); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

function csvEscape(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function appendSemicolon(existing: string, addition: string): string {
  const a = (existing ?? "").trim();
  const b = (addition ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  if (a.includes(b)) return a; // idempotent
  if (a.endsWith(";")) return `${a} ${b}`;
  return `${a}; ${b}`;
}

function appendNote(existing: string, addition: string): string {
  const a = (existing ?? "").trim();
  if (!a) return addition;
  if (a.includes(addition)) return a; // idempotent
  if (a.endsWith(".") || a.endsWith(";")) return `${a} ${addition}`;
  return `${a}. ${addition}`;
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const csvPath = join(root, "course", "exports", "full-thai-course-blueprint.csv");
  if (!existsSync(csvPath)) {
    console.error(`[w6-compat] canonical CSV missing at ${csvPath}`);
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf8").split(/\r?\n/);
  const header = raw[0];
  if (!header) {
    console.error("[w6-compat] CSV has no header");
    process.exit(1);
  }
  const headerCells = parseCsvLine(header);
  const idx = (k: string) => headerCells.indexOf(k);
  const iId = idx("lesson_id");
  const iVocab = idx("new_vocab_core");
  const iChunks = idx("new_chunks_core");
  const iNotes = idx("notes");

  const byId = new Map<string, string[]>();
  for (const line of raw.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    byId.set((cells[iId] ?? "").trim(), cells);
  }

  let applied = 0;
  for (const ins of INSERTS) {
    const row = byId.get(ins.lesson_id);
    if (!row) {
      console.error(`[w6-compat] missing row ${ins.lesson_id}; skipping`);
      continue;
    }
    const targetIdx = ins.column === "new_vocab_core" ? iVocab : iChunks;
    const joined = ins.entries.join("; ");
    row[targetIdx] = appendSemicolon(row[targetIdx] ?? "", joined);
    row[iNotes] = appendNote(row[iNotes] ?? "", ins.note);
    applied += 1;
  }

  const outLines: string[] = [header];
  for (const line of raw.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    const id = (cells[iId] ?? "").trim();
    const patched = byId.get(id) ?? cells;
    outLines.push(patched.map(csvEscape).join(","));
  }
  writeFileSync(csvPath, outLines.join("\n") + "\n", "utf8");
  console.log(`[w6-compat] applied ${applied}/${INSERTS.length} compatible inserts to ${csvPath}`);
}

main();
