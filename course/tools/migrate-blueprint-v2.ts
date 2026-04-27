#!/usr/bin/env node
/**
 * W1 migration: v1 blueprint CSV (23 cols) to v2 CSV (18 cols) + sidecars.
 * Writes `.v2.csv` and sidecar files. Does not rename the canonical file.
 * Idempotent: re-running overwrites v2 outputs.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type V1Row = {
  track_id: string;
  track_title: string;
  cefr_band: string;
  module_id: string;
  module_title: string;
  module_exit_outcome: string;
  lesson_id: string;
  lesson_title: string;
  lesson_primary_outcome: string;
  lesson_secondary_outcome: string;
  grammar_function_primary: string;
  grammar_function_secondary: string;
  new_vocab_core: string;
  new_chunks_core: string;
  review_vocab_required: string;
  script_target: string;
  listening_target: string;
  speaking_target: string;
  lesson_quiz_focus: string;
  module_quiz_link: string;
  flashcard_tags: string;
  notes: string;
  source_inspiration: string;
};

const V2_COLUMNS = [
  "lesson_id",
  "module_id",
  "stage_id",
  "cefr_band",
  "module_title",
  "lesson_title",
  "status",
  "lesson_primary_outcome",
  "lesson_secondary_outcome",
  "grammar_function_primary",
  "grammar_function_secondary",
  "new_vocab_core",
  "new_chunks_core",
  "review_vocab_required",
  "targets",
  "lesson_quiz_focus",
  "prereq_lessons",
  "notes",
] as const;

const MODULE_COLUMNS = [
  "module_id",
  "module_title",
  "module_exit_outcome",
  "cefr_band",
  "stage_id",
  "parallel_track",
  "legacy_track_id",
] as const;

const SKOOL_META_COLUMNS = [
  "lesson_id",
  "topic_tags",
  "scenario_tags",
  "skill_tags",
  "flashcard_tags",
  "standalone_rating",
  "skool_display_title",
  "live_upsell_cta",
] as const;

const COMMUNITY_COLUMNS = ["lesson_id", "community_prompt"] as const;

const STAGES = [
  { stage_id: "S1", stage_title: "Foundations", modules: ["M01", "M02", "M03"] },
  { stage_id: "S2", stage_title: "Survival Thai", modules: ["M04", "M05", "M06"] },
  {
    stage_id: "S3",
    stage_title: "Everyday Thai",
    modules: ["M07", "M08", "M09", "M10", "M11", "M12"],
  },
  {
    stage_id: "S4",
    stage_title: "Functional Fluency",
    modules: ["M13", "M14", "M15", "M16", "M17", "M18"],
  },
] as const;

const LITERACY_MODULES = new Set(["M02", "M07"]);

const STAGE_BY_MODULE = new Map<string, string>();
for (const s of STAGES) for (const m of s.modules) STAGE_BY_MODULE.set(m, s.stage_id);

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

function readCsvRows(path: string): V1Row[] {
  const raw = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  if (raw.length < 2) return [];
  const headers = parseCsvLine(raw[0]);
  const idx = new Map(headers.map((h, i) => [h, i]));
  const get = (cells: string[], k: string) =>
    (cells[idx.get(k) ?? -1] ?? "").trim();
  return raw.slice(1).map((line) => {
    const c = parseCsvLine(line);
    return {
      track_id: get(c, "track_id"),
      track_title: get(c, "track_title"),
      cefr_band: get(c, "cefr_band"),
      module_id: get(c, "module_id"),
      module_title: get(c, "module_title"),
      module_exit_outcome: get(c, "module_exit_outcome"),
      lesson_id: get(c, "lesson_id"),
      lesson_title: get(c, "lesson_title"),
      lesson_primary_outcome: get(c, "lesson_primary_outcome"),
      lesson_secondary_outcome: get(c, "lesson_secondary_outcome"),
      grammar_function_primary: get(c, "grammar_function_primary"),
      grammar_function_secondary: get(c, "grammar_function_secondary"),
      new_vocab_core: get(c, "new_vocab_core"),
      new_chunks_core: get(c, "new_chunks_core"),
      review_vocab_required: get(c, "review_vocab_required"),
      script_target: get(c, "script_target"),
      listening_target: get(c, "listening_target"),
      speaking_target: get(c, "speaking_target"),
      lesson_quiz_focus: get(c, "lesson_quiz_focus"),
      module_quiz_link: get(c, "module_quiz_link"),
      flashcard_tags: get(c, "flashcard_tags"),
      notes: get(c, "notes"),
      source_inspiration: get(c, "source_inspiration"),
    };
  });
}

function csvEscape(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(
  path: string,
  columns: readonly string[],
  rows: Array<Record<string, string>>
): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c] ?? "")).join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function buildTargets(row: V1Row): string {
  // Pipe-delimited: script|listening|speaking|writing
  // writing is blank in v1; sidecar for literacy modules can be patched later.
  const parts = [
    row.script_target,
    row.listening_target,
    row.speaking_target,
    "", // writing_target, populated later for literacy lessons
  ].map((p) => p.replace(/\|/g, "/"));
  return parts.join("|");
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const exportsDir = join(root, "course", "exports");
  const v1Path = join(exportsDir, "full-thai-course-blueprint.csv");

  if (!existsSync(v1Path)) {
    console.error(`[migrate] v1 CSV not found at ${v1Path}`);
    process.exit(1);
  }

  const rows = readCsvRows(v1Path);
  console.log(`[migrate] read ${rows.length} lesson rows from v1`);

  // --- v2 main CSV ---
  const v2Rows = rows.map((r) => {
    const stage_id = STAGE_BY_MODULE.get(r.module_id) ?? "";
    return {
      lesson_id: r.lesson_id,
      module_id: r.module_id,
      stage_id,
      cefr_band: r.cefr_band,
      module_title: r.module_title,
      lesson_title: r.lesson_title,
      status: "draft",
      lesson_primary_outcome: r.lesson_primary_outcome,
      lesson_secondary_outcome: r.lesson_secondary_outcome,
      grammar_function_primary: r.grammar_function_primary,
      grammar_function_secondary: r.grammar_function_secondary,
      new_vocab_core: r.new_vocab_core,
      new_chunks_core: r.new_chunks_core,
      review_vocab_required: r.review_vocab_required,
      targets: buildTargets(r),
      lesson_quiz_focus: r.lesson_quiz_focus,
      prereq_lessons: "",
      notes: r.notes,
    };
  });
  const v2Path = join(exportsDir, "full-thai-course-blueprint.v2.csv");
  writeCsv(v2Path, V2_COLUMNS, v2Rows);
  console.log(`[migrate] wrote ${v2Path} (${v2Rows.length} rows, ${V2_COLUMNS.length} cols)`);

  // --- modules.csv ---
  const modulesSeen = new Map<string, Record<string, string>>();
  for (const r of rows) {
    if (modulesSeen.has(r.module_id)) continue;
    modulesSeen.set(r.module_id, {
      module_id: r.module_id,
      module_title: r.module_title,
      module_exit_outcome: r.module_exit_outcome,
      cefr_band: r.cefr_band,
      stage_id: STAGE_BY_MODULE.get(r.module_id) ?? "",
      parallel_track: LITERACY_MODULES.has(r.module_id) ? "literacy" : "main",
      legacy_track_id: r.track_id,
    });
  }
  const modulesPath = join(exportsDir, "modules.csv");
  writeCsv(modulesPath, MODULE_COLUMNS, [...modulesSeen.values()]);
  console.log(`[migrate] wrote ${modulesPath} (${modulesSeen.size} modules)`);

  // --- stages.json ---
  const stagesPath = join(exportsDir, "stages.json");
  writeJsonFile(stagesPath, {
    stages: STAGES.map((s) => ({
      stage_id: s.stage_id,
      stage_title: s.stage_title,
      module_range: [...s.modules],
    })),
  });
  console.log(`[migrate] wrote ${stagesPath}`);

  // --- tracks.json (4 curated tracks, lesson lists populated in W3) ---
  const tracksPath = join(exportsDir, "tracks.json");
  writeJsonFile(tracksPath, {
    tracks: [
      {
        track_id: "A",
        track_title: "Travel Thai",
        cefr_span: "A0-A2",
        ordered_lesson_ids: [],
        capstone_lesson_id: "M09-L005",
      },
      {
        track_id: "B",
        track_title: "Living in Thailand",
        cefr_span: "A0-B1",
        ordered_lesson_ids: [],
        capstone_lesson_id: "M15-L006",
      },
      {
        track_id: "C",
        track_title: "Conversation-only",
        cefr_span: "A0-B2",
        ordered_lesson_ids: [],
        capstone_lesson_id: "M18-L009",
      },
      {
        track_id: "D",
        track_title: "Reading Lab",
        cefr_span: "A0-A2",
        ordered_lesson_ids: [],
        capstone_lesson_id: "M07-L009",
      },
    ],
  });
  console.log(`[migrate] wrote ${tracksPath}`);

  // --- skool-metadata.csv (seeded from flashcard_tags; other tags blank for W3) ---
  const skoolRows = rows.map((r) => ({
    lesson_id: r.lesson_id,
    topic_tags: "",
    scenario_tags: "",
    skill_tags: "",
    flashcard_tags: r.flashcard_tags,
    standalone_rating: "3",
    skool_display_title: "",
    live_upsell_cta: "false",
  }));
  const skoolPath = join(exportsDir, "skool-metadata.csv");
  writeCsv(skoolPath, SKOOL_META_COLUMNS, skoolRows);
  console.log(`[migrate] wrote ${skoolPath} (${skoolRows.length} rows)`);

  // --- community-prompts.csv (empty, to be authored in W5) ---
  const communityRows = rows.map((r) => ({
    lesson_id: r.lesson_id,
    community_prompt: "",
  }));
  const communityPath = join(exportsDir, "community-prompts.csv");
  writeCsv(communityPath, COMMUNITY_COLUMNS, communityRows);
  console.log(`[migrate] wrote ${communityPath} (${communityRows.length} rows)`);

  // --- blueprint.meta.json ---
  const metaPath = join(exportsDir, "blueprint.meta.json");
  writeJsonFile(metaPath, {
    schemaVersion: 2,
    lastUpdated: new Date().toISOString(),
    columnSpec: {
      main: [...V2_COLUMNS],
      modules: [...MODULE_COLUMNS],
      skool_metadata: [...SKOOL_META_COLUMNS],
      community_prompts: [...COMMUNITY_COLUMNS],
    },
    sidecars: [
      "modules.csv",
      "stages.json",
      "tracks.json",
      "skool-metadata.csv",
      "community-prompts.csv",
    ],
    dropped_columns_v1: ["source_inspiration"],
    derived_columns: {
      stage_title: "stages.json[stage_id]",
      module_quiz_link: "${module_id}-QUIZ",
    },
    merged_columns: {
      targets: ["script_target", "listening_target", "speaking_target", "writing_target"],
    },
  });
  console.log(`[migrate] wrote ${metaPath}`);

  console.log("[migrate] done. v1 CSV untouched; v2 files alongside.");
}

main();
