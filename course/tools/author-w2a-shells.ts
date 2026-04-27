#!/usr/bin/env node
/**
 * W2a: author 14 displacement shells into the v2 CSV.
 *
 * A shell is NOT a full lesson spec. It populates just enough of a blueprint
 * row for downstream work (W3 track tagging, W6 vocab inserts, loader smoke)
 * to reference a concrete lesson_id with correct title / outcome / grammar.
 * W2b will layer the full teaching spec on top during video production.
 *
 * Fields we touch per shell:
 *   lesson_title
 *   lesson_primary_outcome
 *   lesson_secondary_outcome
 *   grammar_function_primary
 *   grammar_function_secondary (only when plan specifies)
 *   lesson_quiz_focus
 *   notes (appends a `W2a-shell:` line with displaced_content trail)
 *
 * We do NOT touch:
 *   new_vocab_core, new_chunks_core, review_vocab_required, targets,
 *   prereq_lessons, status. Those are W2b / W6 responsibilities.
 *
 * Deferred shells (per plan): M10 Directional Particles (slot TBD), M11/M15
 * Writing slots (TBD). They are listed at the bottom as DEFERRED with a
 * corresponding entry in resequencing-v1.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Shell = {
  lesson_id: string;
  lesson_title: string;
  lesson_primary_outcome: string;
  lesson_secondary_outcome: string;
  grammar_function_primary: string;
  grammar_function_secondary?: string;
  lesson_quiz_focus: string;
  displaced: string;
};

const SHELLS: Shell[] = [
  // --- Tier 1 (6) ---
  {
    lesson_id: "M02-L010",
    lesson_title: "Your Five Tones in Your Voice",
    lesson_primary_outcome:
      "You can produce all five Thai tones in isolation and in simple words, with self-check against Nine's model.",
    lesson_secondary_outcome:
      "You can hear the tone you just produced, compare it to the target, and correct on the second try.",
    grammar_function_primary: "tone production across all five tones",
    grammar_function_secondary: "tone self-monitoring via minimal-pair contrast",
    lesson_quiz_focus:
      "record-and-compare tone production on 5 minimal pairs; self-score with Nine's reference audio",
    displaced:
      "old 'Module 2 Recap and Quiz'; quiz rolls into module-level quiz, recap absorbed by module landing card",
  },
  {
    lesson_id: "M03-L007",
    lesson_title: "Thai Pronouns: You, I, and Kin Terms",
    lesson_primary_outcome:
      "You can address strangers with age-appropriate kin terms (พี่/น้อง/ป้า/ลุง) and refer to yourself the same way, instead of defaulting to คุณ / ฉัน.",
    lesson_secondary_outcome:
      "You can still mark possession with ของ when naming family members or personal items.",
    grammar_function_primary: "kin-term pronoun system (พี่ / น้อง / ป้า / ลุง / ยาย / ตา) for self and address",
    grammar_function_secondary: "possession with ของ (retained from displaced lesson)",
    lesson_quiz_focus:
      "pick the right kin-term pronoun for 8 stranger-age scenarios; 4 possession drills with ของ",
    displaced:
      "old 'Possession and Family Relations'; possession retained as secondary, family vocab absorbed here, classifier drill overflow to M03-L008",
  },
  {
    lesson_id: "M05-L004",
    lesson_title: "Aspect: Now, Still, Already",
    lesson_primary_outcome:
      "You can mark an action as in-progress (กำลัง / อยู่), already done (แล้ว), or not yet (ยัง...ไม่) across 6 everyday verbs.",
    lesson_secondary_outcome:
      "You can answer a yes/no question about state using the right aspect marker without defaulting to bare verbs.",
    grammar_function_primary: "aspect markers กำลัง / อยู่ / แล้ว / ยัง...ไม่",
    grammar_function_secondary: "pairing aspect with the 6 verbs introduced earlier in M05",
    lesson_quiz_focus:
      "substitute the correct aspect marker in 10 scenarios; 4 yes/no response drills",
    displaced:
      "old 'Meals and Eating Habits' relocated to M08 food cluster (W6 vocab moves recorded in notes there)",
  },
  {
    lesson_id: "M05-L005",
    lesson_title: "Future and Plans with จะ",
    lesson_primary_outcome:
      "You can mark any verb as future with จะ, and talk about plans, intentions, and predictions.",
    lesson_secondary_outcome:
      "You can answer 'what are you going to do?' with a full จะ + verb + object response.",
    grammar_function_primary: "future / irrealis marker จะ",
    grammar_function_secondary: "chaining จะ with time adverbs (พรุ่งนี้ / ทีหลัง / เดี๋ยว)",
    lesson_quiz_focus:
      "mark 10 prompts as future with จะ; 5 response-building drills to 'what will you do?'",
    displaced:
      "old 'Hobbies and Free Time' folded into M05-L006 Likes (W6 vocab append recorded there)",
  },
  {
    lesson_id: "M06-L009",
    lesson_title: "Discourse Particles: นะ / สิ / ล่ะ / เถอะ / แหละ / เนอะ",
    lesson_primary_outcome:
      "You can soften, emphasise, or invite agreement with the six core sentence-final particles, and hear which one fits a given social move.",
    lesson_secondary_outcome:
      "You can avoid the two most common particle-swap errors learners make (นะ vs สิ, เถอะ vs แหละ).",
    grammar_function_primary: "sentence-final discourse particles นะ / สิ / ล่ะ / เถอะ / แหละ / เนอะ",
    grammar_function_secondary: "pragmatic force: softening vs commanding vs confirming",
    lesson_quiz_focus:
      "match particle to social move in 12 mini-dialogues; 4 error-spotting drills on swap errors",
    displaced:
      "old 'Fixing Misunderstandings in Context' distributed across M06-L002 (ask-again) and M06-L010 (recap)",
  },
  {
    lesson_id: "M10-L003",
    lesson_title: "Real Conditional: ถ้า ... ก็ ...",
    lesson_primary_outcome:
      "You can make real (possible) conditionals with ถ้า ... ก็ ..., covering plan, warning, and offer.",
    lesson_secondary_outcome:
      "You can strip ก็ when context allows and still be understood.",
    grammar_function_primary: "real conditional ถ้า ... (ก็) ...",
    grammar_function_secondary: "optional ก็ and its pragmatic effect",
    lesson_quiz_focus:
      "build 8 conditional pairs from prompts; 4 drills contrasting ก็-kept vs ก็-stripped",
    displaced:
      "old 'Already / Still / Yet' absorbed into new M10-L004 Past Framing as secondary aspect markers (see id-remap-v1.json; remap-m10 already filled this row as placeholder)",
  },

  // --- Tier 2 (8 confirmed; 3 deferred) ---
  {
    lesson_id: "M13-L004",
    lesson_title: "Relative Clauses with ที่",
    lesson_primary_outcome:
      "You can modify a noun with a full clause using ที่ ('the one that / who...'), so your sentences stop needing to restart.",
    lesson_secondary_outcome:
      "You can drop ที่ in headless contexts ('ที่พูดไทยเก่ง = the one who speaks Thai well') when the noun is understood.",
    grammar_function_primary: "restrictive relative clauses with ที่",
    grammar_function_secondary: "headless ที่-clauses and clause-internal subject/object role",
    lesson_quiz_focus:
      "join 10 short sentences into one using ที่; 4 headless-ที่ response drills",
    displaced:
      "old 'Giving Examples and Details' (examples/details content merged into M13-L006 Supporting an Opinion as secondary)",
  },
  {
    lesson_id: "M13-L005",
    lesson_title: "Passive with ถูก and โดน",
    lesson_primary_outcome:
      "You can report events where you are the recipient, using ถูก (neutral / formal) and โดน (unfortunate / colloquial).",
    lesson_secondary_outcome:
      "You can pick ถูก vs โดน correctly for 8 everyday scenarios and avoid defaulting to active voice.",
    grammar_function_primary: "passive constructions ถูก / โดน + verb",
    grammar_function_secondary: "register contrast between ถูก and โดน",
    lesson_quiz_focus:
      "rewrite 8 active prompts as ถูก / โดน passives; 4 register-choice drills",
    displaced:
      "old 'Retelling News or Information' retained as example corpus for passive drills (report-style news headlines naturally use ถูก)",
  },
  {
    lesson_id: "M13-L006",
    lesson_title: "Causatives with ให้ and ทำให้",
    lesson_primary_outcome:
      "You can make someone do something (ให้ + person + verb) and make something happen (ทำให้ + result).",
    lesson_secondary_outcome:
      "You can distinguish ให้ 'let / permit' from ให้ 'cause' from the non-causative 'give' meaning.",
    grammar_function_primary: "causative constructions ให้ / ทำให้",
    grammar_function_secondary: "the three senses of ให้ (give / permit / cause)",
    lesson_quiz_focus:
      "build 10 causative sentences from prompts; 4 sense-disambiguation drills on ให้",
    displaced:
      "old 'Supporting an Opinion' folded into M13-L004 as secondary outcome (examples+details now carries the opinion scaffold)",
  },
  {
    lesson_id: "M13-L007",
    lesson_title: "Resultatives: Verbs of Outcome",
    lesson_primary_outcome:
      "You can attach a result verb to an action verb (กินหมด / ทำเสร็จ / หาเจอ / ฟังออก) to say whether it succeeded, completed, or found its target.",
    lesson_secondary_outcome:
      "You can negate resultatives correctly with ไม่ placed before the result verb, not the main verb.",
    grammar_function_primary: "resultative verb compounds (V + หมด / เสร็จ / เจอ / ออก / ไหว / ถึง)",
    grammar_function_secondary: "negation of resultatives with ไม่",
    lesson_quiz_focus:
      "pair 10 action verbs with the correct result verb; 4 negation drills",
    displaced:
      "old 'Softening and Hedging' moved to M13-L008 (hedging naturally slots next to the M13-L009 personal-story recap)",
  },
  {
    lesson_id: "M14-L007",
    lesson_title: "เกรงใจ and Face: Saying No Politely",
    lesson_primary_outcome:
      "You can decline, hedge, and ask indirectly using เกรงใจ-driven softeners (ไม่อยากรบกวน / ไม่เป็นไร / เดี๋ยว...นะ) instead of bare ไม่ or refusal.",
    lesson_secondary_outcome:
      "You can recognise the face-saving move behind 'ไม่เป็นไร' and respond in kind without escalating.",
    grammar_function_primary: "เกรงใจ-driven refusal and softening: production of 6 indirect-ask / decline frames",
    grammar_function_secondary: "face-saving discourse moves (ไม่เป็นไร / ขอโทษนะ / ไม่อยากรบกวน)",
    lesson_quiz_focus:
      "produce a softened decline for 8 social prompts; 4 indirect-ask reframings (bare ask -> เกรงใจ ask)",
    displaced:
      "old 'Apologizing and Taking Responsibility' folded into M14-L008 Reported Speech (apology-report is the natural bridge)",
  },
  {
    lesson_id: "M14-L008",
    lesson_title: "Reported Speech: What They Said",
    lesson_primary_outcome:
      "You can report what someone said using เขาบอกว่า / พูดว่า / ถามว่า without the tense-shift rules English forces.",
    lesson_secondary_outcome:
      "You can report a question (indirect yes/no with ว่า ... ไหม / ว่า ... หรือเปล่า).",
    grammar_function_primary: "reported speech frames บอกว่า / พูดว่า / ถามว่า",
    grammar_function_secondary: "indirect yes/no questions with ว่า",
    lesson_quiz_focus:
      "convert 8 direct quotes to reported speech; 4 indirect-question drills",
    displaced:
      "old 'Negotiating Under Stress' rolled into M14-L009/010 recap arc as a review scenario",
  },
  {
    lesson_id: "M16-L007",
    lesson_title: "LINE and Social: Digital Thai Register",
    lesson_primary_outcome:
      "You can read and write LINE / IG / TikTok messages in natural Thai: particle-heavy, abbreviated, and with the right emoji-adjacent slang.",
    lesson_secondary_outcome:
      "You can decode the most common chat abbreviations (555 / งับ / มะ / จ้า / อ่ะ / นะคะ) and use them without sounding off.",
    grammar_function_primary: "digital / chat register: spelling shortcuts, particle stacking, emoji-adjacent markers",
    grammar_function_secondary: "code-switching between LINE-chat and spoken polite Thai",
    lesson_quiz_focus:
      "write 8 chat replies in register from prompt scenarios; decode 6 received messages back to standard Thai",
    displaced:
      "old 'Slang Awareness and Register Control' split: digital slang owned here, general slang recognition absorbed into M16-L008",
  },
  {
    lesson_id: "M07-L009",
    lesson_title: "Writing: Copy and Handwrite",
    lesson_primary_outcome:
      "You can handwrite 15 target syllables with correct stroke order, consonant class grouping, and tone-mark placement.",
    lesson_secondary_outcome:
      "You can read your own handwriting back and self-check tone against Nine's reference.",
    grammar_function_primary: "handwriting stroke order and tone-mark positioning",
    grammar_function_secondary: "consonant class visual grouping (mid / high / low)",
    lesson_quiz_focus:
      "copy 15 syllables; self-check 5 for stroke order and tone-mark placement",
    displaced:
      "old 'Read and Say a Short Dialogue' retained as warm-up; new core is handwriting production",
  },
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
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function appendNote(existing: string, addition: string): string {
  const a = (existing ?? "").trim();
  const b = (addition ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith(".") || a.endsWith(";")) return `${a} ${b}`;
  return `${a}. ${b}`;
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const v2Path = join(root, "course", "exports", "full-thai-course-blueprint.v2.csv");
  if (!existsSync(v2Path)) {
    console.error(`[w2a-shells] v2 CSV missing at ${v2Path}`);
    process.exit(1);
  }

  const raw = readFileSync(v2Path, "utf8").split(/\r?\n/);
  const header = raw[0];
  if (!header) {
    console.error("[w2a-shells] v2 CSV has no header");
    process.exit(1);
  }
  const headerCells = parseCsvLine(header);
  const idx = (k: string) => headerCells.indexOf(k);

  const iLessonId = idx("lesson_id");
  const iTitle = idx("lesson_title");
  const iPrimary = idx("lesson_primary_outcome");
  const iSecondary = idx("lesson_secondary_outcome");
  const iGramP = idx("grammar_function_primary");
  const iGramS = idx("grammar_function_secondary");
  const iQuiz = idx("lesson_quiz_focus");
  const iNotes = idx("notes");
  const iStatus = idx("status");

  for (const col of [iLessonId, iTitle, iPrimary, iSecondary, iGramP, iGramS, iQuiz, iNotes, iStatus]) {
    if (col < 0) {
      console.error("[w2a-shells] v2 CSV missing one of the required columns");
      process.exit(1);
    }
  }

  const byId = new Map<string, string[]>();
  const ordered: string[] = [header];
  for (const line of raw.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    const id = (cells[iLessonId] ?? "").trim();
    byId.set(id, cells);
  }

  const applied: string[] = [];
  for (const shell of SHELLS) {
    const row = byId.get(shell.lesson_id);
    if (!row) {
      console.error(`[w2a-shells] missing row for ${shell.lesson_id}; skipping`);
      continue;
    }
    row[iTitle] = shell.lesson_title;
    row[iPrimary] = shell.lesson_primary_outcome;
    row[iSecondary] = shell.lesson_secondary_outcome;
    row[iGramP] = shell.grammar_function_primary;
    if (shell.grammar_function_secondary) {
      row[iGramS] = shell.grammar_function_secondary;
    }
    row[iQuiz] = shell.lesson_quiz_focus;
    if (!row[iStatus] || row[iStatus] === "") row[iStatus] = "draft";
    // Idempotent: W2a-shell notes are always trailing — strip from first
    // W2a-shell: marker to end-of-cell, including any preceding separator.
    const existingNotes = (row[iNotes] ?? "").replace(/[\s.;]*W2a-shell:.*$/s, "").trim();
    row[iNotes] = appendNote(existingNotes, `W2a-shell: ${shell.displaced}`);
    applied.push(shell.lesson_id);
  }

  // Preserve original row order from the file
  const outLines: string[] = [header];
  for (const line of raw.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    const id = (cells[iLessonId] ?? "").trim();
    const patched = byId.get(id) ?? cells;
    outLines.push(patched.map(csvEscape).join(","));
  }

  writeFileSync(v2Path, outLines.join("\n") + "\n", "utf8");
  console.log(
    `[w2a-shells] patched ${applied.length} shells into ${v2Path}: ${applied.join(", ")}`
  );

  // Write resequencing note for deferred slots
  const resequencingPath = join(root, "course", "exports", "resequencing-v1.md");
  const deferredNote = [
    "# Resequencing v1 — deferred W2a slots",
    "",
    "The following displacement shells from the approved plan are intentionally",
    "NOT authored in this pass, because their final lesson_id is gated on decisions",
    "that must happen later:",
    "",
    "- **M10 Directional Particles** — slot TBD. The M10 remap (W4) freed only one",
    "  lesson_id (new M10-L003) and that was assigned to Real Conditional. Directional",
    "  particles (ไป / มา / ขึ้น / ลง / เข้า / ออก / ผ่าน) need a home but there is no",
    "  vacant M10 slot. Defer: fold into M08-L00? motion/transit lessons, OR create",
    "  a second M10 remap pass after W2b review. Do not force a slot before Nine decides.",
    "",
    "- **M11 Writing slot** — TBD. The recap lesson (M11-L010) is the natural displacement",
    "  target but we don't yet know if M11 needs a writing beat or if M07's literacy track",
    "  covers it. Confirm with Nine during W3 stage assignment.",
    "",
    "- **M15 Writing slot** — TBD. Same reasoning as M11. Defer to the same Nine review.",
    "",
    "Authored shells (14): M02-L010, M03-L007, M05-L004, M05-L005, M06-L009, M10-L003,",
    "M13-L004, M13-L005, M13-L006, M13-L007, M14-L007, M14-L008, M16-L007, M07-L009.",
    "",
    "Each authored shell carries a `W2a-shell:` note describing the displaced content and",
    "where it relocated to. W2b will layer the full teaching spec on top of these shells",
    "during video production, gated by the 8-dimension editorial rubric.",
    "",
  ].join("\n");
  writeFileSync(resequencingPath, deferredNote, "utf8");
  console.log(`[w2a-shells] wrote ${resequencingPath}`);
}

main();
