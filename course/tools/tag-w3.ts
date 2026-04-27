#!/usr/bin/env node
/**
 * W3: stage + curated-track tagging + top-20 standalone retitle.
 *
 * Outputs:
 *  - course/exports/tracks.json: ordered_lesson_ids populated per curated track
 *  - course/exports/skool-metadata.csv:
 *      * topic_tags   (heuristic from module + lesson title keywords)
 *      * scenario_tags (travel/living/everyday/etc)
 *      * skill_tags   (listening/speaking/reading/writing/grammar)
 *      * standalone_rating (1-5): 5 for curated top-20, 3 default, 1 for recap/quiz
 *      * skool_display_title: SEO-friendly rewrite for top-20 only
 *      * live_upsell_cta: "true" for stage capstones + every 5th lesson, else "false"
 *
 * This is a first-pass heuristic tagger. Nine reviews the output and edits
 * skool-metadata.csv directly. Re-running the tool is idempotent and won't
 * overwrite hand-edited values (detected via a `w3-locked` marker in the cell).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ------------------------------------------------------------
// curated tracks (lesson_ids reference post-M10-remap ids)
// ------------------------------------------------------------
const TRACK_A_TRAVEL: string[] = [
  "M01-L001", // Hello/courtesy
  "M01-L004", // Numbers
  "M04-L002", // Ordering (scaffold)
  "M04-L007", // Paying / check-bill
  "M09-L001", // Taxi / Grab
  "M09-L002", // Train / BTS / MRT
  "M09-L003", // Buses / songthaews
  "M09-L004", // Airport / travel vocab
  "M09-L005", // Hotels (capstone)
  "M10-L004", // Past framing (telling a trip story)
  "M12-L004", // Phone / messaging while travelling
  "M14-L001", // Asking for help under stress (lost / late)
];

const TRACK_B_LIVING: string[] = [
  // Survival baseline (no airport/hotel — those are travel-shaped)
  "M01-L001",
  "M01-L004",
  "M04-L002",
  "M04-L007",
  "M09-L001", // Taxi / Grab (still useful to a resident)
  "M09-L002", // BTS / MRT
  "M09-L003", // Local buses / songthaews
  // Living-shaped progression
  "M03-L003", // มี / there is
  "M03-L007", // kin-term pronouns
  "M05-L001", // daily routines (post-merge)
  "M05-L004", // aspect markers
  "M05-L005", // future with จะ
  "M06-L009", // discourse particles
  "M10-L001", // future/จะ in M10 (post-remap)
  "M10-L005", // appointments
  "M11-L001", // money basics / bill amounts
  "M11-L004", // money / bills
  "M11-L005", // ATM / bank receipts
  "M12-L001", // healthcare talk
  "M12-L005", // banking
  "M15-L001", // rental basics
  "M15-L003", // utilities
  "M15-L004", // repairs / complaints
  "M15-L005", // neighbours
  "M15-L006", // landlord (capstone)
  "M16-L007", // LINE / digital
];

const TRACK_C_CONVERSATION: string[] = [
  "M01-L001",
  "M01-L002",
  "M01-L003",
  "M01-L009",
  "M03-L007",
  "M03-L009",
  "M05-L005",
  "M05-L006",
  "M06-L001",
  "M06-L002",
  "M06-L009",
  "M10-L001",
  "M10-L002",
  "M10-L004",
  "M10-L005",
  "M10-L006",
  "M10-L007",
  "M13-L001",
  "M13-L004",
  "M13-L006",
  "M14-L001",
  "M14-L002",
  "M14-L007",
  "M14-L008",
  "M17-L001",
  "M17-L005",
  "M18-L001",
  "M18-L005",
  "M18-L008",
  "M18-L009", // capstone
];

const TRACK_D_READING: string[] = [
  ...Array.from({ length: 10 }, (_, i) => `M02-L${String(i + 1).padStart(3, "0")}`),
  ...Array.from({ length: 10 }, (_, i) => `M07-L${String(i + 1).padStart(3, "0")}`),
];

// ------------------------------------------------------------
// top-20 standalone — SEO-friendly titles for Skool search
// ------------------------------------------------------------
const TOP_20_STANDALONE: Record<string, string> = {
  "M01-L001": "How to Say Hello and Be Polite in Thai",
  "M01-L004": "Thai Numbers 0 to 10: Count Like a Local",
  "M03-L007": "Thai Pronouns Beyond คุณ: พี่, น้อง, ป้า, ลุง",
  "M04-L002": "How to Order Food and Drinks in Thai",
  "M04-L007": "How to Pay the Bill in Thai (เช็คบิล / คิดเงินด้วย)",
  "M05-L004": "Thai Aspect Markers: กำลัง, อยู่, แล้ว, ยัง",
  "M05-L005": "Future in Thai with จะ: Plans, Promises, Predictions",
  "M06-L009": "Thai Sentence Particles: นะ สิ ล่ะ เถอะ แหละ เนอะ",
  "M08-L006": "Thai for Taxis, Grab, Bolt, BTS & MRT",
  "M09-L001": "How to Take a Taxi or Grab in Thai",
  "M09-L005": "How to Book and Check Into a Thai Hotel",
  "M10-L001": "Talking About the Future in Thai: จะ in Stories and Plans",
  "M10-L002": "เคย: How to Say 'I've Done It Before' in Thai",
  "M10-L003": "Real Conditionals in Thai: ถ้า ... ก็ ...",
  "M12-L004": "Thai for Small Emergencies (7-Eleven, Clinic, Pharmacy)",
  "M13-L004": "Thai Relative Clauses with ที่",
  "M14-L007": "เกรงใจ: How to Say No Politely in Thai",
  "M15-L006": "How to Talk to Your Thai Landlord",
  "M16-L007": "Thai on LINE, IG and TikTok: Digital Register Guide",
  "M18-L009": "Speaking Thai at B2: Capstone Conversation",
};

// ------------------------------------------------------------
// heuristic tag seeding
// ------------------------------------------------------------
const MODULE_TOPICS: Record<string, string> = {
  M01: "greetings; introductions; basic courtesy",
  M02: "script; tones; reading foundations",
  M03: "simple sentences; description; family",
  M04: "food; ordering; restaurant",
  M05: "home; daily routines; habits",
  M06: "questions; repair; clarification",
  M07: "reading fluency; handwriting; literacy",
  M08: "shopping; markets; transactions",
  M09: "travel; transport; accommodation",
  M10: "time; aspect; storytelling; conditionals",
  M11: "money; counting; bills",
  M12: "healthcare; services; emergencies",
  M13: "narration; explanation; connectors",
  M14: "complaints; problems; stress",
  M15: "rental; housing; neighbours",
  M16: "media; digital; culture",
  M17: "work; office; professional",
  M18: "advanced conversation; nuance; capstone",
};

const MODULE_SCENARIOS: Record<string, string> = {
  M01: "first-meeting; polite greetings",
  M02: "self-paced reading practice",
  M03: "casual description",
  M04: "restaurant; street food; cafe",
  M05: "home; roommates; routines",
  M06: "clarification; misheard phrases",
  M07: "reading aloud; handwriting practice",
  M08: "market; 7-Eleven; shopping mall",
  M09: "taxi; Grab; BTS; airport; hotel",
  M10: "telling stories; making plans",
  M11: "paying bills; counting money",
  M12: "clinic; pharmacy; bank; post office",
  M13: "giving opinions; retelling; arguing",
  M14: "complaining; apologising; negotiating",
  M15: "renting; landlord; utilities; repairs",
  M16: "LINE; Instagram; TikTok; social media",
  M17: "meetings; emails; colleagues",
  M18: "nuanced conversation; final capstone",
};

const MODULE_SKILLS: Record<string, string> = {
  M01: "speaking; listening",
  M02: "reading; pronunciation",
  M03: "grammar; speaking",
  M04: "speaking; vocabulary",
  M05: "grammar; speaking",
  M06: "listening; repair",
  M07: "reading; writing; pronunciation",
  M08: "speaking; vocabulary",
  M09: "speaking; listening",
  M10: "grammar; narrative",
  M11: "speaking; numeracy",
  M12: "speaking; comprehension",
  M13: "grammar; narrative",
  M14: "speaking; pragmatics",
  M15: "speaking; comprehension",
  M16: "reading; pragmatics",
  M17: "speaking; writing",
  M18: "speaking; listening; comprehension",
};

// ------------------------------------------------------------
// CSV helpers
// ------------------------------------------------------------
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
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isLockedBW3(cell: string): boolean {
  return /w3-locked/.test(cell ?? "");
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const exportsDir = join(root, "course", "exports");

  // ---- tracks.json ----
  const tracksPath = join(exportsDir, "tracks.json");
  const tracks = {
    schemaVersion: 1,
    tracks: [
      {
        track_id: "A",
        track_title: "Travel Thai",
        cefr_span: "A0-A2",
        ordered_lesson_ids: TRACK_A_TRAVEL,
        capstone_lesson_id: "M09-L005",
      },
      {
        track_id: "B",
        track_title: "Living in Thailand",
        cefr_span: "A0-B1",
        ordered_lesson_ids: TRACK_B_LIVING,
        capstone_lesson_id: "M15-L006",
      },
      {
        track_id: "C",
        track_title: "Conversation-only",
        cefr_span: "A0-B2",
        ordered_lesson_ids: TRACK_C_CONVERSATION,
        capstone_lesson_id: "M18-L009",
      },
      {
        track_id: "D",
        track_title: "Reading Lab",
        cefr_span: "A0-A2",
        ordered_lesson_ids: TRACK_D_READING,
        capstone_lesson_id: "M07-L010",
      },
    ],
  };
  writeFileSync(tracksPath, JSON.stringify(tracks, null, 2) + "\n", "utf8");
  console.log(`[w3] wrote ${tracksPath} (A=${TRACK_A_TRAVEL.length}, B=${TRACK_B_LIVING.length}, C=${TRACK_C_CONVERSATION.length}, D=${TRACK_D_READING.length})`);

  // ---- skool-metadata.csv ----
  const metaPath = join(exportsDir, "skool-metadata.csv");
  if (!existsSync(metaPath)) {
    console.error(`[w3] skool-metadata.csv missing at ${metaPath}`);
    process.exit(1);
  }
  const raw = readFileSync(metaPath, "utf8").split(/\r?\n/).filter(Boolean);
  const header = raw[0];
  const headerCells = parseCsvLine(header);
  const idx = (k: string) => headerCells.indexOf(k);
  const iId = idx("lesson_id");
  const iTopic = idx("topic_tags");
  const iScenario = idx("scenario_tags");
  const iSkill = idx("skill_tags");
  const iRating = idx("standalone_rating");
  const iDisplay = idx("skool_display_title");
  const iUpsell = idx("live_upsell_cta");

  const out: string[] = [header];
  let tagged = 0;
  let retitled = 0;
  for (const line of raw.slice(1)) {
    const cells = parseCsvLine(line);
    const id = (cells[iId] ?? "").trim();
    const mod = id.slice(0, 3);
    const lessonNum = parseInt(id.slice(5), 10);
    const isRecap = lessonNum === 10; // module recap
    const isCapstone = ["M09-L005", "M15-L006", "M18-L009", "M07-L009"].includes(id);
    const isTop20 = TOP_20_STANDALONE[id] !== undefined;

    if (!isLockedBW3(cells[iTopic] ?? "")) {
      cells[iTopic] = MODULE_TOPICS[mod] ?? "";
    }
    if (!isLockedBW3(cells[iScenario] ?? "")) {
      cells[iScenario] = MODULE_SCENARIOS[mod] ?? "";
    }
    if (!isLockedBW3(cells[iSkill] ?? "")) {
      cells[iSkill] = MODULE_SKILLS[mod] ?? "";
    }
    if (!isLockedBW3(cells[iRating] ?? "")) {
      cells[iRating] = isTop20 ? "5" : isRecap ? "1" : isCapstone ? "5" : "3";
    }
    if (!isLockedBW3(cells[iDisplay] ?? "") && isTop20) {
      cells[iDisplay] = TOP_20_STANDALONE[id];
      retitled += 1;
    }
    if (!isLockedBW3(cells[iUpsell] ?? "")) {
      cells[iUpsell] = isCapstone || lessonNum % 5 === 0 ? "true" : "false";
    }
    out.push(cells.map(csvEscape).join(","));
    tagged += 1;
  }
  writeFileSync(metaPath, out.join("\n") + "\n", "utf8");
  console.log(`[w3] tagged ${tagged} rows in ${metaPath}; retitled ${retitled} top-20 lessons`);

  // ---- sanity: every track lesson_id exists in blueprint ----
  const bpPath = join(exportsDir, "full-thai-course-blueprint.v2.csv");
  const bpRaw = readFileSync(bpPath, "utf8").split(/\r?\n/).filter(Boolean);
  const bpHeader = parseCsvLine(bpRaw[0]);
  const bpIdIdx = bpHeader.indexOf("lesson_id");
  const validIds = new Set(
    bpRaw.slice(1).map((l) => parseCsvLine(l)[bpIdIdx]?.trim()).filter(Boolean)
  );
  const allTrackIds = [
    ...TRACK_A_TRAVEL,
    ...TRACK_B_LIVING,
    ...TRACK_C_CONVERSATION,
    ...TRACK_D_READING,
  ];
  const missing = allTrackIds.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    console.error(`[w3] ${missing.length} track lesson_ids not found in blueprint:`);
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log(`[w3] sanity: all ${allTrackIds.length} track lesson_id references resolve`);
}

main();
