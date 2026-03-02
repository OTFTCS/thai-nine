#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { renderLessonPdfById } from "./export-pdf.ts";
import { lessonPath, listLessonDirs, readJson, writeJson, writeText } from "./lib/fs.ts";
import {
  remotionEpisodePathForLesson,
  validateAll,
  validateAllSchemas,
  validateLessonDir,
  validateLessonSchemas,
} from "./lib/validators.ts";
import {
  checkTransliterationPolicy,
  extractTripletTranslitSegments,
  repairTransliteration,
  scanTextForTransliterationDrift,
} from "./lib/transliteration-policy.ts";
import type {
  AssetProvenance,
  FlashcardsDeck,
  LessonContext,
  LessonStatus,
  Lexeme,
  PdfSource,
  QuizItem,
  QuizItemBank,
  QuizSet,
  RemotionPlan,
  ScriptMaster,
  StageId,
  ValidationIssue,
  VocabExport,
  VocabIndex,
} from "./lib/types.ts";

const root = resolve(process.cwd());
const STAGES: readonly StageId[] = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function nowLog(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok", hour12: false }) + " +07";
}

function logRun(message: string): void {
  const logPath = join(root, "course", "runlogs", "latest.md");
  appendFileSync(logPath, `\n## ${nowLog()}\n- ${message}\n`, "utf8");
}

function printUsage(): void {
  console.log(`course pipeline CLI

Commands:
  validate [--lesson M01-L001]
  validate-schemas [--lesson M01-L001]
  set-status --lesson M01-L001 --state DRAFT|READY_TO_RECORD|PLANNED|BACKLOG
  touch-runlog --message "text"
  stage --lesson M01-L001 --stage 0|1|2|3|4|5|6|7 [--strict]
  run-lesson --lesson M01-L001 [--strict]
  run-batch --lessons M01-L001,M01-L002 [--strict]
  translit-audit [--lesson M01-L001] [--fix]
`);
}

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function lessonIdFromDir(lessonDir: string): string {
  const parts = lessonDir.split("/");
  const lesson = parts.at(-1) ?? "";
  const module = parts.at(-2) ?? "";
  return `${module}-${lesson}`;
}

function parseLessonRef(lessonId: string): { moduleId: string; lessonNum: number } {
  const [moduleId, lessonPart] = lessonId.split("-");
  const lessonNum = Number((lessonPart ?? "L000").replace(/^L/, ""));
  return { moduleId: moduleId ?? "M00", lessonNum };
}

function compareLessonIds(a: string, b: string): number {
  const pa = parseLessonRef(a);
  const pb = parseLessonRef(b);
  if (pa.moduleId !== pb.moduleId) return pa.moduleId.localeCompare(pb.moduleId);
  return pa.lessonNum - pb.lessonNum;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function canonicalLexemeKey(lex: Pick<Lexeme, "thai" | "translit" | "english">): string {
  return `${lex.thai.trim()}|${lex.translit.trim().toLowerCase()}|${lex.english.trim().toLowerCase()}`;
}

function deterministicVocabId(lex: Pick<Lexeme, "thai" | "translit" | "english">): string {
  const digest = createHash("sha1").update(canonicalLexemeKey(lex)).digest("hex").slice(0, 10);
  return `v-${digest}`;
}

function withVocabId(lex: Lexeme): Lexeme {
  return {
    ...lex,
    vocabId: lex.vocabId && lex.vocabId.trim().length > 0 ? lex.vocabId : deterministicVocabId(lex),
  };
}

function dedupeLexemes(lexemes: Lexeme[]): Lexeme[] {
  const seen = new Map<string, Lexeme>();
  for (const lex of lexemes) {
    const finalLex = withVocabId(lex);
    seen.set(canonicalLexemeKey(finalLex), finalLex);
  }
  return Array.from(seen.values());
}

function scriptMastersForModule(moduleId: string): Array<{ lessonId: string; script: ScriptMaster }> {
  const dirs = listLessonDirs(root)
    .map((dir) => ({ dir, lessonId: lessonIdFromDir(dir) }))
    .filter((x) => x.lessonId.startsWith(`${moduleId}-`))
    .sort((a, b) => compareLessonIds(a.lessonId, b.lessonId));

  const out: Array<{ lessonId: string; script: ScriptMaster }> = [];
  for (const entry of dirs) {
    const scriptPath = join(entry.dir, "script-master.json");
    if (!existsSync(scriptPath)) continue;
    try {
      out.push({ lessonId: entry.lessonId, script: readJson<ScriptMaster>(scriptPath) });
    } catch {
      // skip malformed script files during indexing; validators catch them separately.
    }
  }
  return out;
}

function collectPriorScriptMasters(lessonId: string): Array<{ lessonId: string; script: ScriptMaster }> {
  const { moduleId, lessonNum } = parseLessonRef(lessonId);
  return scriptMastersForModule(moduleId).filter((p) => parseLessonRef(p.lessonId).lessonNum < lessonNum);
}

function rebuildVocabIndex(): VocabIndex {
  const allScripts = listLessonDirs(root)
    .map((dir) => ({ dir, lessonId: lessonIdFromDir(dir) }))
    .sort((a, b) => compareLessonIds(a.lessonId, b.lessonId));

  const byId = new Map<string, VocabIndex["entries"][number]>();

  for (const lesson of allScripts) {
    const scriptPath = join(lesson.dir, "script-master.json");
    if (!existsSync(scriptPath)) continue;

    let script: ScriptMaster;
    try {
      script = readJson<ScriptMaster>(scriptPath);
    } catch {
      continue;
    }

    const lessonLex = script.sections.flatMap((s) => s.languageFocus).map(withVocabId);
    for (const lex of lessonLex) {
      const id = lex.vocabId ?? deterministicVocabId(lex);
      const key = canonicalLexemeKey(lex);
      const current = byId.get(id);
      if (!current) {
        byId.set(id, {
          id,
          thai: lex.thai,
          translit: lex.translit,
          english: lex.english,
          key,
          firstSeenLesson: lesson.lessonId,
          lessons: [lesson.lessonId],
        });
        continue;
      }

      current.lessons = uniqueStrings([...current.lessons, lesson.lessonId]).sort(compareLessonIds);
      if (compareLessonIds(lesson.lessonId, current.firstSeenLesson) < 0) {
        current.firstSeenLesson = lesson.lessonId;
      }
    }
  }

  const index: VocabIndex = {
    schemaVersion: 1,
    generatedAt: nowIso(),
    entries: Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id)),
  };

  writeJson(join(root, "course", "vocab", "vocab-index.json"), index);
  return index;
}

function stage0ContextLoader(lessonId: string): LessonContext {
  const priors = collectPriorScriptMasters(lessonId);
  const knownVocabulary = dedupeLexemes(priors.flatMap((p) => p.script.sections.flatMap((s) => s.languageFocus.map(withVocabId))));
  const knownGrammar = uniqueStrings(priors.flatMap((p) => p.script.sections.map((s) => s.purpose))).sort();

  const bucketConfig = [
    { bucket: "last" as const, offset: 1 as const },
    { bucket: "minus3" as const, offset: 3 as const },
    { bucket: "minus6" as const, offset: 6 as const },
    { bucket: "minus8" as const, offset: 8 as const },
  ];

  const reviewBuckets = bucketConfig.map((cfg) => {
    if (priors.length < cfg.offset) {
      return { bucket: cfg.bucket, offset: cfg.offset, lessonId: null, vocabIds: [], sample: [] };
    }
    const prior = priors[priors.length - cfg.offset];
    const sample = dedupeLexemes(prior.script.sections.flatMap((s) => s.languageFocus.map(withVocabId))).slice(0, 4);
    return {
      bucket: cfg.bucket,
      offset: cfg.offset,
      lessonId: prior.lessonId,
      vocabIds: sample.map((s) => s.vocabId ?? deterministicVocabId(s)),
      sample,
    };
  });

  rebuildVocabIndex();

  return {
    schemaVersion: 1,
    lessonId,
    priorLessons: priors.map((p) => p.lessonId),
    knownVocabulary,
    knownGrammar,
    reviewBuckets,
  };
}

type ScriptSeed = Pick<ScriptMaster, "title" | "objective" | "sections" | "roleplay" | "recap">;

function scriptSeed(lessonId: string): ScriptSeed {
  if (lessonId === "M01-L001") {
    return {
      title: "Survival Thai 01: First 10 Minutes in Thailand",
      objective: "Handle first-contact interactions politely using survival phrases and correct PTM-adapted transliteration with inline tone marks.",
      sections: [
        {
          id: "s1",
          heading: "Core greeting stack",
          purpose: "Teach pragmatic greeting and gratitude with politeness particles.",
          spokenNarration: [
            "Start with สวัสดี sà-wàt-dii.",
            "Then add ครับ khráp or ค่ะ khâ depending on speaker role.",
          ],
          onScreenBullets: [
            "สวัสดี | sà-wàt-dii | hello",
            "ขอบคุณ | khàawp-khun | thank you",
            "ครับ / ค่ะ | khráp / khâ | polite ending",
          ],
          drills: [
            "Say สวัสดีครับ three times slowly.",
            "Switch to female form: สวัสดีค่ะ.",
          ],
          languageFocus: [
            { thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" },
            { thai: "ขอบคุณ", translit: "khàawp-khun", english: "thank you" },
            { thai: "ครับ", translit: "khráp", english: "male polite ending" },
            { thai: "ค่ะ", translit: "khâ", english: "female statement ending" },
            { thai: "คะ", translit: "khá", english: "female question ending" },
          ],
        },
        {
          id: "s2",
          heading: "Repair + clarity",
          purpose: "Recover conversation when comprehension drops.",
          spokenNarration: [
            "Use ขอโทษ khǎaw-thôot to interrupt politely.",
            "Follow with ไม่เข้าใจ mâi khâo-jai.",
          ],
          onScreenBullets: [
            "ขอโทษ | khǎaw-thôot | excuse me / sorry",
            "ไม่เข้าใจ | mâi khâo-jai | I do not understand",
          ],
          drills: ["Role drill: ขอโทษครับ ไม่เข้าใจครับ", "Repeat in female form with ค่ะ."],
          languageFocus: [
            { thai: "ขอโทษ", translit: "khǎaw-thôot", english: "excuse me / sorry" },
            { thai: "ไม่เข้าใจ", translit: "mâi khâo-jai", english: "I do not understand" },
          ],
        },
        {
          id: "s3",
          heading: "Speed control request",
          purpose: "Request slower speech without breaking politeness.",
          spokenNarration: [
            "พูดช้าๆ ได้ไหม phûut cháa-cháa dâai mái means can you speak slowly?",
            "Add ครับ or คะ for tone and politeness.",
          ],
          onScreenBullets: ["พูดช้าๆ ได้ไหม | phûut cháa-cháa dâai mái | can you speak slowly?"],
          drills: ["Slow repetition at 60% speed.", "Swap endings: ...ไหมครับ / ...ไหมคะ"],
          languageFocus: [
            { thai: "พูดช้าๆ ได้ไหม", translit: "phûut cháa-cháa dâai mái", english: "can you speak slowly?" },
          ],
        },
      ],
      roleplay: {
        scenario: "Cafe first-contact",
        lines: [
          { speaker: "Staff", thai: "สวัสดีค่ะ", translit: "sà-wàt-dii khâ", english: "Hello." },
          {
            speaker: "Learner",
            thai: "ขอโทษครับ พูดช้าๆ ได้ไหมครับ",
            translit: "khǎaw-thôot khráp phûut cháa-cháa dâai mái khráp",
            english: "Excuse me, can you speak slowly?",
          },
          { speaker: "Staff", thai: "ได้ค่ะ", translit: "dâai khâ", english: "Sure." },
          { speaker: "Learner", thai: "ขอบคุณครับ", translit: "khàawp-khun khráp", english: "Thank you." },
        ],
      },
      recap: [
        "Greet first.",
        "Use particles correctly.",
        "Repair with ขอโทษ and ไม่เข้าใจ.",
        "Request slower speed politely.",
      ],
    };
  }

  if (lessonId === "M01-L002") {
    return {
      title: "The Thai Sound System",
      objective: "Distinguish consonant contrast, vowel length, and tone contour with practical beginner listening drills.",
      sections: [
        {
          id: "s1",
          heading: "Consonant contrast at the start",
          purpose: "Train ear to hear aspirated vs unaspirated initials.",
          spokenNarration: [
            "Compare ไก่ gài and ไข่ khài.",
            "One breathy consonant changes meaning immediately.",
          ],
          onScreenBullets: [
            "ไก่ | gài | chicken",
            "ไข่ | khài | egg",
            "เสียงต้นต่างกัน | sǐiang dtôn dtàang-gan | initial consonant contrast",
          ],
          drills: ["Point to chicken/egg cards after hearing each word.", "Say gài / khài in alternating pairs."],
          languageFocus: [
            { thai: "ไก่", translit: "gài", english: "chicken" },
            { thai: "ไข่", translit: "khài", english: "egg" },
          ],
        },
        {
          id: "s2",
          heading: "Tone contour changes meaning",
          purpose: "Feel how contour shifts semantic category.",
          spokenNarration: ["ใกล้ glâi means near.", "ไกล glǎi marks far in this lesson contrast set."],
          onScreenBullets: [
            "ใกล้ | glâi | near",
            "ไกล | glǎi | far",
            "โทนเสียงเปลี่ยนความหมาย | thoon sǐiang bplìian khwaam-mǎai | tone shifts meaning",
          ],
          drills: ["Tutor says one; learner points near/far.", "Swap roles and repeat at natural speed."],
          languageFocus: [
            { thai: "ใกล้", translit: "glâi", english: "near" },
            { thai: "ไกล", translit: "glǎi", english: "far" },
          ],
        },
        {
          id: "s3",
          heading: "Length awareness",
          purpose: "Lock in short/long vowel distinction.",
          spokenNarration: ["ขา khǎa (leg) and ค่า khâa (value/fee) are not interchangeable.", "Length + tone must be heard together."],
          onScreenBullets: [
            "ขา | khǎa | leg",
            "ค่า | khâa | value / fee",
            "ยาว/สั้นต่างความหมาย | yaao/sân dtàang khwaam-mǎai | length changes meaning",
          ],
          drills: ["Chant khǎa then khâa with clear timing.", "Minimal pair listening at slow speed."],
          languageFocus: [
            { thai: "ขา", translit: "khǎa", english: "leg" },
            { thai: "ค่า", translit: "khâa", english: "value / fee" },
          ],
        },
      ],
      roleplay: {
        scenario: "Listening tutor session",
        lines: [
          { speaker: "Tutor", thai: "คำนี้คือ ไข่", translit: "kham-níi kheuu khài", english: "This word is egg." },
          { speaker: "Learner", thai: "ไข่ khài", translit: "khài", english: "Egg." },
          { speaker: "Tutor", thai: "ใกล้ หรือ ไกล", translit: "glâi rǔue glǎi", english: "Near or far?" },
          { speaker: "Learner", thai: "ใกล้ glâi", translit: "glâi", english: "Near." },
          { speaker: "Tutor", thai: "ขา หรือ ค่า", translit: "khǎa rǔue khâa", english: "Leg or value?" },
          { speaker: "Learner", thai: "ค่า khâa", translit: "khâa", english: "Value." },
        ],
      },
      recap: [
        "Decode initial consonant first.",
        "Track tone contour on every syllable.",
        "Treat vowel length as meaning-critical.",
        "Drill contrast pairs daily.",
      ],
    };
  }

  return {
    title: "Fallback Thai Lesson",
    objective: "Provide a deterministic starter lesson artifact pack.",
    sections: [
      {
        id: "s1",
        heading: "Greeting",
        purpose: "Baseline politeness entry",
        spokenNarration: ["Use สวัสดี sà-wàt-dii to open politely."],
        onScreenBullets: ["สวัสดี | sà-wàt-dii | hello"],
        drills: ["Repeat greeting with confidence."],
        languageFocus: [{ thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" }],
      },
      {
        id: "s2",
        heading: "Thanks",
        purpose: "Baseline gratitude",
        spokenNarration: ["Use ขอบคุณ khàawp-khun to close politely."],
        onScreenBullets: ["ขอบคุณ | khàawp-khun | thank you"],
        drills: ["Say thanks with polite ending."],
        languageFocus: [
          { thai: "ขอบคุณ", translit: "khàawp-khun", english: "thank you" },
          { thai: "ขอโทษ", translit: "khǎaw-thôot", english: "excuse me / sorry" },
        ],
      },
      {
        id: "s3",
        heading: "Repair",
        purpose: "Basic repair phrase",
        spokenNarration: [
          "Use ไม่เข้าใจ mâi khâo-jai when needed.",
          "Add พูดช้าๆ ได้ไหม phûut cháa-cháa dâai mái to control conversation speed.",
        ],
        onScreenBullets: [
          "ไม่เข้าใจ | mâi khâo-jai | I do not understand",
          "พูดช้าๆ ได้ไหม | phûut cháa-cháa dâai mái | can you speak slowly?",
        ],
        drills: ["Repeat repair phrase three times.", "Ask for slower speech politely."],
        languageFocus: [
          { thai: "ไม่เข้าใจ", translit: "mâi khâo-jai", english: "I do not understand" },
          { thai: "พูดช้าๆ ได้ไหม", translit: "phûut cháa-cháa dâai mái", english: "can you speak slowly?" },
        ],
      },
    ],
    roleplay: {
      scenario: "Fallback mini roleplay",
      lines: [
        { speaker: "A", thai: "สวัสดี", translit: "sà-wàt-dii", english: "Hello." },
        { speaker: "B", thai: "สวัสดี", translit: "sà-wàt-dii", english: "Hello." },
        { speaker: "A", thai: "ขอบคุณ", translit: "khàawp-khun", english: "Thank you." },
        { speaker: "B", thai: "ไม่เข้าใจ", translit: "mâi khâo-jai", english: "I do not understand." },
      ],
    },
    recap: ["Use polite greeting.", "Use thanks.", "Use repair phrase."],
  };
}

function buildScriptQaChecks(script: ScriptMaster): ScriptMaster["qaChecks"] {
  const lexemes = script.sections.flatMap((s) => s.languageFocus);
  const translits = [
    ...lexemes.map((l) => l.translit),
    ...script.roleplay.lines.map((l) => l.translit),
    ...script.sections.flatMap((s) => s.onScreenBullets.map((b) => b.split("|")[1]?.trim() ?? "")),
  ];

  const translitIssues = translits.filter((t) => !checkTransliterationPolicy(t, true).ok);

  const tripletIssue = script.sections.some((s) =>
    s.languageFocus.some((l) => !l.thai || !l.translit || !l.english || !l.vocabId) ||
    s.onScreenBullets.some((b) => b.split("|").map((p) => p.trim()).length < 3),
  );

  return [
    {
      id: "tone-inline",
      description: "All transliteration uses PTM inline tone marks; superscripts forbidden",
      pass: translitIssues.length === 0,
      evidence: translitIssues.length === 0 ? "All transliteration strings passed inline-tone checks" : `${translitIssues.length} transliteration strings failed inline-tone checks`,
    },
    {
      id: "triplets",
      description: "Thai/translit/English triplets are complete for learner-facing script content",
      pass: !tripletIssue,
      evidence: !tripletIssue ? "Sections and on-screen bullets contain complete triplets" : "Missing triplet field or malformed on-screen bullet detected",
    },
    {
      id: "drills",
      description: "Each section includes active drill",
      pass: script.sections.every((s) => s.drills.length >= 1),
      evidence: script.sections.every((s) => s.drills.length >= 1) ? "Each section has >=1 drill" : "At least one section is missing drills",
    },
    {
      id: "roleplay",
      description: "Scenario roleplay included and substantial",
      pass: script.roleplay.lines.length >= 4,
      evidence: `Roleplay contains ${script.roleplay.lines.length} lines`,
    },
    {
      id: "policy",
      description: "Transliteration + image sourcing policies are declared",
      pass:
        script.policies.transliteration === "PTM_ADAPTED_INLINE_TONES" &&
        script.policies.imageSourcing === "INTERNET_FIRST_NO_GENERATIVE_DEFAULT",
      evidence: "Policy object present with required enum values",
    },
  ];
}

function stage1ScriptGeneration(lessonId: string, context: LessonContext): ScriptMaster {
  const seed = scriptSeed(lessonId);

  const sections = seed.sections.map((s) => ({
    ...s,
    languageFocus: s.languageFocus.map((l) => withVocabId(l)),
  }));

  const script: ScriptMaster = {
    schemaVersion: 1,
    lessonId,
    title: seed.title,
    objective: seed.objective,
    context,
    sections,
    roleplay: seed.roleplay,
    recap: seed.recap,
    qaChecks: [],
    policies: {
      transliteration: "PTM_ADAPTED_INLINE_TONES",
      imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT",
    },
  };

  script.qaChecks = buildScriptQaChecks(script);
  return script;
}

function transliterationHardCheck(raw: string): string[] {
  const issues: string[] = [];

  for (const drift of scanTextForTransliterationDrift(raw)) {
    issues.push(`Line ${drift.line}: ${drift.message}`);
  }

  for (const segment of extractTripletTranslitSegments(raw)) {
    const check = checkTransliterationPolicy(segment.translit, true);
    for (const issue of check.issues) {
      issues.push(`Line ${segment.line}: ${issue.message}`);
    }
  }

  return Array.from(new Set(issues));
}

function stage2QaLoop(lessonId: string): { pass: boolean; report: string; checks: ScriptMaster["qaChecks"] } {
  const lpath = lessonPath(root, lessonId);
  const scriptPath = join(lpath, "script-master.json");
  const spokenPath = join(lpath, "script-spoken.md");
  const visualPath = join(lpath, "script-visual.md");
  const script = readJson<ScriptMaster>(scriptPath);
  const spoken = existsSync(spokenPath) ? readFileSync(spokenPath, "utf8") : "";
  const visual = existsSync(visualPath) ? readFileSync(visualPath, "utf8") : "";

  const checks = buildScriptQaChecks(script);

  const supplementalIssues = [
    ...transliterationHardCheck(spoken).map((m) => `script-spoken.md: ${m}`),
    ...transliterationHardCheck(visual).map((m) => `script-visual.md: ${m}`),
  ];

  const pass = checks.every((c) => c.pass) && supplementalIssues.length === 0;

  const report = [
    `# QA Report — ${lessonId}`,
    "",
    `Result: ${pass ? "PASS" : "FAIL"}`,
    "",
    "## Hard Gates",
    "- Transliteration policy: PTM inline tone marks required; superscripts forbidden",
    "- Triplet completeness for learner content",
    "- Drills per section",
    "- Roleplay inclusion",
    "- Policy declaration",
    "",
    "## Check Results",
    ...checks.map((c) => `- ${c.pass ? "✅" : "❌"} ${c.id}: ${c.description} (${c.evidence})`),
    ...supplementalIssues.map((i) => `- ❌ ${i}`),
    "",
    "## Gate",
    pass ? "Proceed to downstream stages." : "Blocked. Fix QA failures before stage 3.",
    "",
  ].join("\n");

  script.qaChecks = checks;
  writeJson(scriptPath, script);

  return { pass, report, checks };
}

function stage3Remotion(script: ScriptMaster): RemotionPlan {
  return {
    schemaVersion: 1,
    lessonId: script.lessonId,
    sourceScript: "script-master.json",
    scenes: script.sections.map((section, idx) => {
      const assetId = `${script.lessonId.toLowerCase()}-scene-${idx + 1}-asset-1`;
      const sourceUrl = `https://www.pexels.com/search/${encodeURIComponent(`${script.title} ${section.heading}`)}/`;
      return {
        id: `scene-${idx + 1}`,
        seconds: 45,
        voiceover: section.spokenNarration,
        overlays: [section.heading, ...section.onScreenBullets],
        thaiFocus: section.languageFocus.map((l) => ({ thai: l.thai, translit: l.translit, english: l.english })),
        assets: [
          {
            assetId,
            kind: "image" as const,
            query: `${script.title} ${section.heading} thai learning visual`,
            sourcePolicy: "internet-first" as const,
            sourceUrl,
            license: "Pexels License",
          },
        ],
      };
    }),
  };
}

function stage3Provenance(remotion: RemotionPlan): AssetProvenance {
  return {
    schemaVersion: 1,
    lessonId: remotion.lessonId,
    generatedAt: nowIso(),
    assets: remotion.scenes.flatMap((scene) =>
      scene.assets.map((asset) => ({
        assetId: asset.assetId,
        kind: asset.kind,
        sourceUrl: asset.sourceUrl,
        license: asset.license,
        usage: `${scene.id}:${scene.id} overlay background`,
      })),
    ),
  };
}

function stage4Pdf(script: ScriptMaster): PdfSource {
  const lexicon = dedupeLexemes(script.sections.flatMap((s) => s.languageFocus));
  const triplets = lexicon.map((l) => `${l.thai} | ${l.translit} | ${l.english}`);
  const roleplayLines = script.roleplay.lines.map((line) => `${line.speaker}: ${line.thai} | ${line.translit} | ${line.english}`);

  return {
    schemaVersion: 1,
    lessonId: script.lessonId,
    title: `${script.lessonId} — ${script.title}`,
    sections: [
      {
        heading: "What you will be able to say after this lesson",
        body: [script.objective],
      },
      {
        heading: "Core phrases (Thai / Transliteration / English)",
        body: triplets,
      },
      {
        heading: "Pronunciation tips (simple and practical)",
        body: script.sections.flatMap((s) => s.spokenNarration.slice(0, 2)),
      },
      {
        heading: "Mini dialogues / role-play",
        body: roleplayLines,
      },
      {
        heading: "Practice drills (self-study)",
        body: script.sections.flatMap((s) => s.drills),
      },
      {
        heading: "Vocabulary list for review / flashcards",
        body: triplets,
      },
      {
        heading: "Quick recap + memory aids",
        body: script.recap,
      },
    ],
    drills: script.sections.flatMap((s) => s.drills),
    answerKey: ["Use PTM inline transliteration marks in every practice line.", ...script.recap],
  };
}

function renderPdfMd(pdf: PdfSource): string {
  return [
    `# ${pdf.title}`,
    "",
    ...pdf.sections.flatMap((s) => [`## ${s.heading}`, ...s.body.map((b) => `- ${b}`), ""]),
    "## Drills",
    ...pdf.drills.map((d, i) => `${i + 1}. ${d}`),
    "",
    "## Answer Key",
    ...pdf.answerKey.map((a) => `- ${a}`),
    "",
  ].join("\n");
}

function stage5Flashcards(script: ScriptMaster): FlashcardsDeck {
  const lex = dedupeLexemes(script.sections.flatMap((s) => s.languageFocus));
  return {
    schemaVersion: 1,
    lessonId: script.lessonId,
    cards: lex.map((l, i) => ({
      id: `${script.lessonId.toLowerCase()}-c${String(i + 1).padStart(2, "0")}`,
      vocabId: l.vocabId ?? deterministicVocabId(l),
      front: l.thai,
      back: l.english,
      translit: l.translit,
      tags: [script.lessonId, "core"],
    })),
  };
}

function lessonVocabExport(script: ScriptMaster, deck: FlashcardsDeck): VocabExport {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    source: "pipeline-cli",
    lessons: [script.lessonId],
    cards: deck.cards.map((c) => ({
      id: c.id,
      vocabId: c.vocabId,
      thai: c.front,
      translit: c.translit,
      english: c.back,
      lessonId: script.lessonId,
      tags: c.tags,
    })),
  };
}

function rebuildGlobalVocabExport(): VocabExport {
  const exports: VocabExport[] = [];
  for (const dir of listLessonDirs(root)) {
    const path = join(dir, "vocab-export.json");
    if (!existsSync(path)) continue;
    try {
      exports.push(readJson<VocabExport>(path));
    } catch {
      // let validators report malformed exports.
    }
  }

  const cards = exports.flatMap((e) => e.cards).sort((a, b) => a.lessonId.localeCompare(b.lessonId) || a.id.localeCompare(b.id));
  const lessons = uniqueStrings(cards.map((c) => c.lessonId)).sort(compareLessonIds);

  const global: VocabExport = {
    schemaVersion: 1,
    generatedAt: nowIso(),
    source: "pipeline-cli",
    lessons,
    cards,
  };

  writeJson(join(root, "course", "exports", "flashcards-global.json"), global);
  return global;
}

function pickDistractors(correct: string, pool: string[], fallback: string[]): string[] {
  const out: string[] = [];
  for (const candidate of [...pool, ...fallback]) {
    if (candidate === correct) continue;
    if (out.includes(candidate)) continue;
    out.push(candidate);
    if (out.length >= 3) break;
  }
  return out;
}

function makeQuizItemsForLexeme(lex: Lexeme, lexPool: Lexeme[]): QuizItem[] {
  const others = lexPool.filter((l) => l.vocabId !== lex.vocabId);
  const englishPool = others.map((l) => l.english);
  const thaiPool = others.map((l) => l.thai);

  const thaiToEnglishOptions = [lex.english, ...pickDistractors(lex.english, englishPool, ["sorry", "train", "hotel"])];
  const englishToThaiOptions = [lex.thai, ...pickDistractors(lex.thai, thaiPool, ["สวัสดี", "ขอบคุณ", "ไม่เข้าใจ"])];
  const contextOptions = [
    `Use ${lex.thai} in polite beginner conversation`,
    ...pickDistractors(
      `Use ${lex.thai} in polite beginner conversation`,
      others.map((o) => `Use ${o.thai} in polite beginner conversation`),
      ["Use only English with no Thai", "Skip tone practice", "Avoid practice drills"],
    ),
  ];

  const vocabId = lex.vocabId ?? deterministicVocabId(lex);

  return [
    {
      id: `${vocabId}-thai-to-english`,
      vocabId,
      type: "thai_to_english",
      displayMode: "thai_only",
      prompt: {
        text: `What is the best meaning of ${lex.thai}?`,
        thai: lex.thai,
        translit: lex.translit,
      },
      options: thaiToEnglishOptions,
      answer: lex.english,
      rationale: "Maps Thai form to target meaning from script languageFocus.",
    },
    {
      id: `${vocabId}-english-to-thai`,
      vocabId,
      type: "english_to_thai",
      displayMode: "english_only",
      prompt: {
        text: `Select Thai for: ${lex.english}`,
        english: lex.english,
      },
      options: englishToThaiOptions,
      answer: lex.thai,
      rationale: "Reverses mapping for active recall.",
    },
    {
      id: `${vocabId}-fill-translit`,
      vocabId,
      type: "fill_translit",
      displayMode: "thai_only",
      prompt: {
        text: `Type the PTM transliteration for ${lex.thai}.`,
        thai: lex.thai,
      },
      answer: lex.translit,
      rationale: "Forces transliteration production with inline tone marks.",
    },
    {
      id: `${vocabId}-context-mcq`,
      vocabId,
      type: "context_mcq",
      displayMode: "triplet",
      prompt: {
        text: `Choose the sentence that keeps the lesson meaning of this phrase.`,
        thai: lex.thai,
        translit: lex.translit,
        english: lex.english,
      },
      options: contextOptions,
      answer: `Use ${lex.thai} in polite beginner conversation`,
      rationale: "Checks contextual understanding while preserving triplet exposure.",
    },
  ];
}

function stage6Quiz(script: ScriptMaster): { itemBank: QuizItemBank; quiz: QuizSet; newLex: Lexeme[] } {
  const currentLex = dedupeLexemes(script.sections.flatMap((s) => s.languageFocus));
  const knownIds = new Set(script.context.knownVocabulary.map((k) => k.vocabId).filter(Boolean));
  const newLex = currentLex.filter((lex) => lex.vocabId && !knownIds.has(lex.vocabId));
  const quizLex = newLex.length > 0 ? newLex : currentLex;

  const bankItems = quizLex.flatMap((lex) => makeQuizItemsForLexeme(lex, quizLex));

  const bankCoverage = quizLex.map((lex) => {
    const vocabId = lex.vocabId ?? deterministicVocabId(lex);
    return {
      vocabId,
      thai: lex.thai,
      itemCount: bankItems.filter((i) => i.vocabId === vocabId).length,
    };
  });

  const itemBank: QuizItemBank = {
    schemaVersion: 1,
    lessonId: script.lessonId,
    generatedAt: nowIso(),
    sourceScript: "script-master.json",
    items: bankItems,
    coverage: {
      minimumItemsPerNewVocab: 3,
      perVocab: bankCoverage,
      pass: bankCoverage.every((c) => c.itemCount >= 3),
    },
  };

  const mandatory = quizLex
    .map((lex) => bankItems.find((item) => item.vocabId === (lex.vocabId ?? "") && item.type === "thai_to_english"))
    .filter((item): item is QuizItem => Boolean(item));

  const extrasPool = bankItems.filter((item) => item.type !== "thai_to_english");
  const targetQuestionCount = Math.min(16, Math.max(8, quizLex.length * 2));
  const extrasNeeded = Math.max(0, targetQuestionCount - mandatory.length);
  const extras = extrasPool.slice(0, extrasNeeded);

  const selected = [...mandatory, ...extras];

  const questions: QuizSet["questions"] = selected.map((item, idx) => ({
    ...item,
    id: `q${String(idx + 1).padStart(2, "0")}`,
    bankItemId: item.id,
  }));

  const quizCoverage = quizLex.map((lex) => {
    const vocabId = lex.vocabId ?? deterministicVocabId(lex);
    return {
      vocabId,
      thai: lex.thai,
      quizItemCount: questions.filter((q) => q.vocabId === vocabId).length,
    };
  });

  const quiz: QuizSet = {
    schemaVersion: 1,
    lessonId: script.lessonId,
    passScore: 80,
    generatedAt: nowIso(),
    itemBankPath: "quiz-item-bank.json",
    questions,
    coverage: {
      minimumQuizItemsPerNewVocab: 1,
      perVocab: quizCoverage,
      pass: quizCoverage.every((c) => c.quizItemCount >= 1),
    },
  };

  return { itemBank, quiz, newLex: quizLex };
}

function renderSpoken(script: ScriptMaster): string {
  return [
    `# Spoken Script — ${script.lessonId} (${script.title})`,
    "",
    ...script.sections.flatMap((s) => [
      `## ${s.heading}`,
      ...s.spokenNarration,
      "",
      "Core triplets:",
      ...s.languageFocus.map((l) => `- ${l.thai} | ${l.translit} | ${l.english}`),
      "",
      "Drills:",
      ...s.drills.map((d) => `- ${d}`),
      "",
    ]),
    "## Roleplay",
    ...script.roleplay.lines.map((l) => `- ${l.speaker}: ${l.thai} | ${l.translit} | ${l.english}`),
    "",
    "## Recap",
    ...script.recap.map((r) => `- ${r}`),
    "",
  ].join("\n");
}

function renderVisual(script: ScriptMaster): string {
  return [
    `# Visual Script — ${script.lessonId} (${script.title})`,
    "",
    ...script.sections.flatMap((s, idx) => [
      `## ${s.heading}`,
      ...s.languageFocus.map((l) => `- ${l.thai} | ${l.translit} | ${l.english}`),
      `- ASSET_SOURCE: url: <https://www.pexels.com/search/${encodeURIComponent(`${script.title} ${s.heading}`)}/>`,
      idx === script.sections.length - 1 ? "" : "",
    ]),
    "## Asset policy",
    "- Source internet assets first; generated imagery is disabled by default.",
    "",
  ].join("\n");
}

function readStageResultsFromStatus(lessonId: string): Record<StageId, "PASS" | "FAIL" | "SKIP"> {
  const statusPath = join(lessonPath(root, lessonId), "status.json");
  const defaults: Record<StageId, "PASS" | "FAIL" | "SKIP"> = {
    "0": "SKIP",
    "1": "SKIP",
    "2": "SKIP",
    "3": "SKIP",
    "4": "SKIP",
    "5": "SKIP",
    "6": "SKIP",
    "7": "SKIP",
  };

  if (!existsSync(statusPath)) return defaults;
  const existing = readJson<LessonStatus>(statusPath);
  if (!existing.stageResults) return defaults;
  return { ...defaults, ...existing.stageResults };
}

function writeStatus(
  lessonId: string,
  state: LessonStatus["state"],
  stageResults: Record<StageId, "PASS" | "FAIL" | "SKIP">,
  notes?: string[],
): void {
  const path = join(lessonPath(root, lessonId), "status.json");
  writeJson(path, {
    lessonId,
    state,
    updatedAt: nowIso(),
    validatedAt: state === "READY_TO_RECORD" ? nowIso() : null,
    stageResults,
    notes,
  } satisfies LessonStatus);
}

function stagePrerequisiteIssues(lessonId: string, stage: StageId): string[] {
  const lpath = lessonPath(root, lessonId);
  const requiredByStage: Record<StageId, string[]> = {
    "0": [],
    "1": ["context.json"],
    "2": ["script-master.json", "script-spoken.md", "script-visual.md"],
    "3": ["qa-report.md"],
    "4": ["remotion.json", "asset-provenance.json"],
    "5": ["pdf-source.json", "pdf.md", "pdf.pdf"],
    "6": ["flashcards.json", "vocab-export.json"],
    "7": ["quiz-item-bank.json", "quiz.json"],
  };

  const issues: string[] = [];
  for (const file of requiredByStage[stage]) {
    const path = join(lpath, file);
    if (!existsSync(path)) issues.push(`Missing prerequisite for stage ${stage}: ${file}`);
  }

  if (stage === "3") {
    const qaPath = join(lpath, "qa-report.md");
    if (existsSync(qaPath)) {
      const qa = readFileSync(qaPath, "utf8");
      if (qa.includes("Result: FAIL")) {
        issues.push("QA report is FAIL; downstream stages are blocked.");
      }
    }
  }

  return issues;
}

async function executeStage(lessonId: string, stage: StageId, strict: boolean): Promise<{ code: number; meta?: string }> {
  const lpath = lessonPath(root, lessonId);
  if (!existsSync(lpath)) {
    console.error(`Lesson path not found: ${lpath}`);
    return { code: 1 };
  }

  if (strict) {
    const preIssues = stagePrerequisiteIssues(lessonId, stage);
    if (stage !== "0" && preIssues.length > 0) {
      for (const issue of preIssues) console.error(issue);
      return { code: 3, meta: preIssues.join(" | ") };
    }
  }

  if (stage === "0") {
    const context = stage0ContextLoader(lessonId);
    writeJson(join(lpath, "context.json"), context);
    const bucketSummary = context.reviewBuckets
      .map((b) => `${b.bucket}:${b.lessonId ?? "none"}${b.vocabIds.length ? `(${b.vocabIds.length})` : ""}`)
      .join(", ");
    return { code: 0, meta: `reviewBuckets=${bucketSummary}` };
  }

  if (stage === "1") {
    const context = readJson<LessonContext>(join(lpath, "context.json"));
    const script = stage1ScriptGeneration(lessonId, context);
    writeJson(join(lpath, "script-master.json"), script);
    writeText(join(lpath, "script-spoken.md"), renderSpoken(script));
    writeText(join(lpath, "script-visual.md"), renderVisual(script));
    rebuildVocabIndex();
    return { code: 0, meta: `generated sections=${script.sections.length}` };
  }

  if (stage === "2") {
    const qa = stage2QaLoop(lessonId);
    writeText(join(lpath, "qa-report.md"), qa.report);
    return { code: qa.pass ? 0 : 2, meta: `qa=${qa.pass ? "PASS" : "FAIL"}` };
  }

  const script = readJson<ScriptMaster>(join(lpath, "script-master.json"));

  if (stage === "3") {
    const remotion = stage3Remotion(script);
    writeJson(join(lpath, "remotion.json"), remotion);
    writeJson(join(lpath, "asset-provenance.json"), stage3Provenance(remotion));
    return { code: 0, meta: `scenes=${remotion.scenes.length}` };
  }

  if (stage === "4") {
    const pdf = stage4Pdf(script);
    writeJson(join(lpath, "pdf-source.json"), pdf);
    writeText(join(lpath, "pdf.md"), renderPdfMd(pdf));
    await renderLessonPdfById(root, lessonId);
    return { code: 0, meta: "pdf.md + pdf.pdf generated" };
  }

  if (stage === "5") {
    const deck = stage5Flashcards(script);
    writeJson(join(lpath, "flashcards.json"), deck);
    writeJson(join(lpath, "vocab-export.json"), lessonVocabExport(script, deck));
    rebuildVocabIndex();
    const global = rebuildGlobalVocabExport();
    return { code: 0, meta: `cards=${deck.cards.length}, globalCards=${global.cards.length}` };
  }

  if (stage === "6") {
    const quizData = stage6Quiz(script);
    writeJson(join(lpath, "quiz-item-bank.json"), quizData.itemBank);
    writeJson(join(lpath, "quiz.json"), quizData.quiz);
    const coverageSummary = quizData.itemBank.coverage.perVocab
      .map((p) => `${p.vocabId}:${p.itemCount}/${quizData.quiz.coverage.perVocab.find((q) => q.vocabId === p.vocabId)?.quizItemCount ?? 0}`)
      .join(", ");
    return { code: quizData.itemBank.coverage.pass && quizData.quiz.coverage.pass ? 0 : 2, meta: `coverage=${coverageSummary}` };
  }

  // stage 7 release gate
  const issues = validateLessonDir(lpath, root);
  const schemaIssues = validateLessonSchemas(lpath, root);
  const allIssues = [...issues, ...schemaIssues];
  const ready = allIssues.length === 0;
  if (!ready) {
    for (const issue of allIssues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
  }
  return { code: ready ? 0 : 2, meta: ready ? "release-gate=PASS" : `release-gate=FAIL(${allIssues.length})` };
}

async function runLesson(lessonId: string, strict = true): Promise<number> {
  const stageResults: Record<StageId, "PASS" | "FAIL" | "SKIP"> = {
    "0": "SKIP",
    "1": "SKIP",
    "2": "SKIP",
    "3": "SKIP",
    "4": "SKIP",
    "5": "SKIP",
    "6": "SKIP",
    "7": "SKIP",
  };

  const notes: string[] = [];

  for (const stage of STAGES) {
    const result = await executeStage(lessonId, stage, strict);
    if (result.code !== 0) {
      stageResults[stage] = "FAIL";
      notes.push(`stage ${stage} failed: ${result.meta ?? `code ${result.code}`}`);
      writeStatus(lessonId, "DRAFT", stageResults, notes);
      logRun(`${lessonId}: stage ${stage} failed (code ${result.code}) — fail-stop engaged.`);
      return result.code;
    }

    stageResults[stage] = "PASS";
    if (result.meta) notes.push(`stage ${stage}: ${result.meta}`);

    if (stage === "2") {
      const qa = readFileSync(join(lessonPath(root, lessonId), "qa-report.md"), "utf8");
      if (qa.includes("Result: FAIL")) {
        stageResults[stage] = "FAIL";
        notes.push("stage 2 QA failed; downstream stages blocked");
        writeStatus(lessonId, "DRAFT", stageResults, notes);
        logRun(`${lessonId}: blocked by QA hard gate at stage 2.`);
        return 2;
      }
    }
  }

  writeStatus(lessonId, "READY_TO_RECORD", stageResults, notes);
  logRun(`${lessonId}: pipeline completed with strict hard gates and marked READY_TO_RECORD.`);
  return 0;
}

async function runBatch(lessons: string[], strict = true): Promise<number> {
  for (const lesson of lessons) {
    const code = await runLesson(lesson, strict);
    if (code !== 0) return code;
  }
  return 0;
}

function runValidate(): number {
  const lesson = getArg("--lesson");
  const issues = lesson ? validateLessonDir(lessonPath(root, lesson), root) : validateAll(root);

  if (issues.length === 0) {
    console.log("Validation passed.");
    return 0;
  }

  for (const issue of issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  return 1;
}

function runValidateSchemas(): number {
  const lesson = getArg("--lesson");
  const issues = lesson ? validateLessonSchemas(lessonPath(root, lesson), root) : validateAllSchemas(root);

  if (issues.length === 0) {
    console.log("Schema validation passed.");
    return 0;
  }

  for (const issue of issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  return 1;
}


interface AuditStringResult {
  value: string;
  changed: boolean;
  issues: ValidationIssue[];
  autoFixes: string[];
  manualReview: string[];
}

function auditStringValue(value: string, label: string, fix: boolean): AuditStringResult {
  const check = checkTransliterationPolicy(value, true);
  const issues: ValidationIssue[] = check.issues.map((issue) => ({ path: label, message: issue.message }));

  if (!fix || check.ok) {
    return {
      value,
      changed: false,
      issues,
      autoFixes: [],
      manualReview: [],
    };
  }

  const repaired = repairTransliteration(value);
  const postCheck = checkTransliterationPolicy(repaired.value, true);

  const postIssues = postCheck.issues.map((issue) => ({
    path: label,
    message: `after auto-fix: ${issue.message}`,
  }));

  return {
    value: repaired.value,
    changed: repaired.value !== value,
    issues: postIssues,
    autoFixes: repaired.autoFixes.map((note) => `${label}: ${note}`),
    manualReview: repaired.manualReview.map((note) => `${label}: ${note}`),
  };
}

interface JsonAuditResult {
  value: unknown;
  changed: boolean;
  issues: ValidationIssue[];
  autoFixes: string[];
  manualReview: string[];
}

function auditJsonNode(node: unknown, label: string, fix: boolean, keyHint: string | null): JsonAuditResult {
  if (typeof node === "string") {
    if (keyHint === "translit" || keyHint === "phonetics") {
      const audited = auditStringValue(node, label, fix);
      return {
        value: audited.value,
        changed: audited.changed,
        issues: audited.issues,
        autoFixes: audited.autoFixes,
        manualReview: audited.manualReview,
      };
    }

    if (node.includes("|")) {
      const parts = node.split("|").map((part) => part.trim());
      if (parts.length >= 3) {
        const tripletLabel = `${label}.triplet.translit`;
        const audited = auditStringValue(parts[1] ?? "", tripletLabel, fix);
        const rebuilt = `${parts[0] ?? ""} | ${audited.value} | ${parts.slice(2).join(" | ")}`;
        return {
          value: audited.changed ? rebuilt : node,
          changed: audited.changed,
          issues: audited.issues,
          autoFixes: audited.autoFixes,
          manualReview: audited.manualReview,
        };
      }
    }

    return { value: node, changed: false, issues: [], autoFixes: [], manualReview: [] };
  }

  if (Array.isArray(node)) {
    let changed = false;
    const issues: ValidationIssue[] = [];
    const autoFixes: string[] = [];
    const manualReview: string[] = [];

    const out = node.map((entry, idx) => {
      const child = auditJsonNode(entry, `${label}[${idx}]`, fix, null);
      if (child.changed) changed = true;
      issues.push(...child.issues);
      autoFixes.push(...child.autoFixes);
      manualReview.push(...child.manualReview);
      return child.value;
    });

    return {
      value: out,
      changed,
      issues,
      autoFixes,
      manualReview,
    };
  }

  if (node && typeof node === "object") {
    let changed = false;
    const issues: ValidationIssue[] = [];
    const autoFixes: string[] = [];
    const manualReview: string[] = [];

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const child = auditJsonNode(value, `${label}.${key}`, fix, key);
      if (child.changed) changed = true;
      issues.push(...child.issues);
      autoFixes.push(...child.autoFixes);
      manualReview.push(...child.manualReview);
      out[key] = child.value;
    }

    return {
      value: out,
      changed,
      issues,
      autoFixes,
      manualReview,
    };
  }

  return { value: node, changed: false, issues: [], autoFixes: [], manualReview: [] };
}

function auditJsonFile(path: string, fix: boolean): {
  issues: ValidationIssue[];
  changed: boolean;
  nextRaw: string;
  autoFixes: string[];
  manualReview: string[];
} {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const audited = auditJsonNode(parsed, path, fix, null);

    const driftIssues = scanTextForTransliterationDrift(raw).map((drift) => ({
      path: `${path}#line-${drift.line}`,
      message: drift.message,
    }));

    const nextRaw = JSON.stringify(audited.value, null, 2) + "\n";

    return {
      issues: [...audited.issues, ...driftIssues],
      changed: fix && audited.changed,
      nextRaw,
      autoFixes: audited.autoFixes,
      manualReview: audited.manualReview,
    };
  } catch {
    return {
      issues: [{ path, message: "invalid JSON (translit-audit could not parse)" }],
      changed: false,
      nextRaw: "",
      autoFixes: [],
      manualReview: [],
    };
  }
}

function auditMarkdownFile(path: string, fix: boolean): {
  issues: ValidationIssue[];
  changed: boolean;
  nextRaw: string;
  autoFixes: string[];
  manualReview: string[];
} {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n");

  const issues: ValidationIssue[] = [];
  const autoFixes: string[] = [];
  const manualReview: string[] = [];
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.includes("|")) continue;

    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 3) continue;

    const label = `${path}#line-${i + 1}.triplet.translit`;
    const audited = auditStringValue(parts[1] ?? "", label, fix);
    issues.push(...audited.issues);
    autoFixes.push(...audited.autoFixes);
    manualReview.push(...audited.manualReview);

    if (fix && audited.changed) {
      lines[i] = `${parts[0] ?? ""} | ${audited.value} | ${parts.slice(2).join(" | ")}`;
      changed = true;
    }
  }

  const nextRaw = lines.join("\n");
  const driftScanRaw = fix ? nextRaw : raw;
  const driftIssues = scanTextForTransliterationDrift(driftScanRaw).map((drift) => ({
    path: `${path}#line-${drift.line}`,
    message: drift.message,
  }));

  return {
    issues: [...issues, ...driftIssues],
    changed,
    nextRaw,
    autoFixes,
    manualReview,
  };
}

function collectLessonAuditTargets(lessonId: string): string[] {
  const targets: string[] = [];
  const lessonDir = lessonPath(root, lessonId);
  if (!existsSync(lessonDir) || !statSync(lessonDir).isDirectory()) {
    return targets;
  }

  const lessonFiles = [
    "context.json",
    "script-master.json",
    "script-spoken.md",
    "script-visual.md",
    "remotion.json",
    "pdf-source.json",
    "pdf.md",
    "vocab-export.json",
    "quiz-item-bank.json",
    "quiz.json",
    "flashcards.json",
  ];

  for (const file of lessonFiles) {
    const path = join(lessonDir, file);
    if (existsSync(path)) targets.push(path);
  }

  const remotionEpisode = remotionEpisodePathForLesson(root, lessonId);
  if (existsSync(remotionEpisode)) targets.push(remotionEpisode);

  return targets;
}

function collectGlobalAuditTargets(): string[] {
  const targets = new Set<string>();

  for (const dir of listLessonDirs(root)) {
    targets.add(join(dir, "context.json"));
    targets.add(join(dir, "script-master.json"));
    targets.add(join(dir, "script-spoken.md"));
    targets.add(join(dir, "script-visual.md"));
    targets.add(join(dir, "remotion.json"));
    targets.add(join(dir, "pdf-source.json"));
    targets.add(join(dir, "pdf.md"));
    targets.add(join(dir, "vocab-export.json"));
    targets.add(join(dir, "quiz-item-bank.json"));
    targets.add(join(dir, "quiz.json"));
    targets.add(join(dir, "flashcards.json"));
  }

  targets.add(join(root, "course", "vocab", "vocab-index.json"));
  targets.add(join(root, "course", "exports", "flashcards-global.json"));

  const remotionDataDir = join(root, "thaiwith-nine-remotion", "src", "data");
  if (existsSync(remotionDataDir) && statSync(remotionDataDir).isDirectory()) {
    for (const file of readdirSync(remotionDataDir)) {
      if (/^episode-\d{3}\.json$/.test(file)) targets.add(join(remotionDataDir, file));
    }
  }

  return Array.from(targets).filter((path) => existsSync(path)).sort();
}

function parseLessonListArg(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function runTranslitAudit(): number {
  const fix = hasFlag("--fix");
  const requestedLessons = parseLessonListArg(getArg("--lesson"));

  const targets =
    requestedLessons.length > 0
      ? requestedLessons.flatMap((lessonId) => collectLessonAuditTargets(lessonId))
      : collectGlobalAuditTargets();

  const uniqueTargets = Array.from(new Set(targets)).sort();
  if (uniqueTargets.length === 0) {
    console.error("No transliteration audit targets found.");
    return 1;
  }

  const issues: ValidationIssue[] = [];
  const autoFixes: string[] = [];
  const manualReview: string[] = [];
  const changedFiles: string[] = [];

  for (const path of uniqueTargets) {
    if (path.endsWith(".json")) {
      const audited = auditJsonFile(path, fix);
      issues.push(...audited.issues);
      autoFixes.push(...audited.autoFixes);
      manualReview.push(...audited.manualReview);
      if (fix && audited.changed) {
        writeFileSync(path, audited.nextRaw, "utf8");
        changedFiles.push(path);
      }
      continue;
    }

    if (path.endsWith(".md")) {
      const audited = auditMarkdownFile(path, fix);
      issues.push(...audited.issues);
      autoFixes.push(...audited.autoFixes);
      manualReview.push(...audited.manualReview);
      if (fix && audited.changed) {
        writeFileSync(path, audited.nextRaw, "utf8");
        changedFiles.push(path);
      }
    }
  }

  const dedupedIssues = Array.from(new Map(issues.map((issue) => [`${issue.path}|${issue.message}`, issue])).values());
  const dedupedFixes = Array.from(new Set(autoFixes));
  const dedupedManual = Array.from(new Set(manualReview));

  if (fix && changedFiles.length > 0) {
    console.log(`Auto-fixed transliteration in ${changedFiles.length} file(s).`);
  }

  if (dedupedFixes.length > 0) {
    for (const note of dedupedFixes) {
      console.log(`FIX: ${note}`);
    }
  }

  if (dedupedManual.length > 0) {
    for (const note of dedupedManual) {
      console.error(`MANUAL: ${note}`);
    }
  }

  if (dedupedIssues.length > 0) {
    for (const issue of dedupedIssues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
  }

  if (dedupedIssues.length === 0 && dedupedManual.length === 0) {
    console.log("Transliteration audit passed.");
    return 0;
  }

  return 2;
}

function runSetStatus(): number {
  const lesson = getArg("--lesson");
  const state = getArg("--state") as LessonStatus["state"] | null;
  if (!lesson || !state) {
    console.error("Missing --lesson or --state");
    return 1;
  }
  writeStatus(lesson, state, readStageResultsFromStatus(lesson));
  logRun(`Set ${lesson} state to ${state}.`);
  console.log(`Updated ${lesson} => ${state}`);
  return 0;
}

function runTouchRunlog(): number {
  const message = getArg("--message");
  if (!message) {
    console.error("Missing --message");
    return 1;
  }
  logRun(message);
  console.log("Runlog updated.");
  return 0;
}

async function runSingleStage(lesson: string, stage: StageId, strict: boolean): Promise<number> {
  const result = await executeStage(lesson, stage, strict);
  const stageResults = readStageResultsFromStatus(lesson);
  stageResults[stage] = result.code === 0 ? "PASS" : "FAIL";
  const state = result.code === 0 ? "DRAFT" : "DRAFT";
  writeStatus(lesson, state, stageResults, [result.meta ?? `stage ${stage} code ${result.code}`]);
  if (result.code !== 0) {
    console.error(result.meta ?? `Stage ${stage} failed`);
  }
  return result.code;
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  if (!cmd) {
    printUsage();
    return 1;
  }

  switch (cmd) {
    case "validate":
      return runValidate();
    case "validate-schemas":
      return runValidateSchemas();
    case "translit-audit":
      return runTranslitAudit();
    case "set-status":
      return runSetStatus();
    case "touch-runlog":
      return runTouchRunlog();
    case "stage": {
      const lesson = getArg("--lesson");
      const stage = getArg("--stage") as StageId | null;
      const strict = hasFlag("--strict") || !hasFlag("--no-strict");
      if (!lesson || !stage || !STAGES.includes(stage)) return 1;
      return runSingleStage(lesson, stage, strict);
    }
    case "run-lesson": {
      const lesson = getArg("--lesson");
      const strict = hasFlag("--strict") || !hasFlag("--no-strict");
      if (!lesson) return 1;
      return runLesson(lesson, strict);
    }
    case "run-batch": {
      const lessonsCsv = getArg("--lessons");
      const strict = hasFlag("--strict") || !hasFlag("--no-strict");
      if (!lessonsCsv) return 1;
      return runBatch(
        lessonsCsv
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        strict,
      );
    }
    default:
      printUsage();
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
