#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderLessonPdfById } from "./export-pdf.ts";
import {
  lessonArtifactPath,
  lessonPath,
  listLessonDirs,
  readJson,
  resolveLessonArtifactPath,
  resolveLessonDirArtifactPath,
  writeJson,
  writeText,
} from "./lib/fs.ts";
import { compareLessonIds, lessonIdFromDir, parseLessonRef } from "./lib/lesson-ids.ts";
import { listReusableLessonIds, readReusableLessonScript } from "./lib/reusable-lessons.ts";
import {
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
import {
  canonicalLexemeKey,
  dedupeLexemes,
  deterministicVocabId,
  fixupScriptVocabIds,
  withVocabId,
} from "./lib/vocab.ts";
import type {
  AssetProvenance,
  DeckSource,
  FlashcardsDeck,
  LessonContext,
  LessonStatus,
  Lexeme,
  PdfSource,
  QuizItem,
  QuizItemBank,
  QuizSet,

  ScriptMaster,
  StageId,
  ValidationIssue,
  VocabExport,
  VocabIndex,
} from "./lib/types.ts";

const root = resolve(process.cwd());
const STAGES: readonly StageId[] = ["0", "1", "2", "3", "4", "5", "6", "7"] as const;

function lessonFile(lessonId: string, baseName: string): string {
  return lessonArtifactPath(root, lessonId, baseName);
}

function resolveLessonFile(lessonId: string, baseName: string): string {
  return resolveLessonArtifactPath(root, lessonId, baseName);
}

function resolveLessonDirFile(lessonDir: string, baseName: string): string {
  return resolveLessonDirArtifactPath(lessonDir, lessonIdFromDir(lessonDir), baseName);
}

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
  fixup-vocabids --lesson M01-L001
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function reportHasPassResult(reportPath: string): boolean {
  if (!existsSync(reportPath)) {
    return false;
  }

  return /Result:\s+PASS\b/.test(readFileSync(reportPath, "utf8"));
}

function newestMtimeMs(paths: string[]): number {
  return Math.max(
    ...paths.map((path) => {
      if (!existsSync(path)) {
        return 0;
      }
      return statSync(path).mtimeMs;
    })
  );
}

function reportIsFreshAgainst(reportPath: string, sourcePaths: string[]): boolean {
  if (!existsSync(reportPath)) {
    return false;
  }

  return statSync(reportPath).mtimeMs >= newestMtimeMs(sourcePaths);
}

function roleplayLineLooksQuestionLike(line: {
  thai: string;
  translit: string;
  english: string;
}): boolean {
  const joined = `${line.thai} ${line.translit} ${line.english}`.toLowerCase();
  return (
    joined.includes("?") ||
    joined.includes("ไหม") ||
    joined.includes("mái") ||
    joined.includes("mai") ||
    joined.includes("can you") ||
    joined.includes("do you") ||
    joined.includes("is it") ||
    joined.includes("are you") ||
    joined.includes("right?")
  );
}

function roleplayLineLooksYesNoAnswer(line: {
  thai: string;
  translit: string;
  english: string;
}): boolean {
  const thai = line.thai.trim();
  const translit = line.translit.trim().toLowerCase();
  return (
    thai === "ใช่" ||
    thai === "ไม่ใช่" ||
    thai.startsWith("ใช่") ||
    thai.startsWith("ไม่ใช่") ||
    translit === "châi" ||
    translit === "mâi châi" ||
    translit.startsWith("châi ") ||
    translit.startsWith("mâi châi ")
  );
}

function lessonAppearsToTargetQuestions(script: ScriptMaster): boolean {
  const joined = [
    script.objective,
    ...script.sections.flatMap((section) => [
      section.heading,
      section.purpose,
      ...section.drills,
      ...section.languageFocus.flatMap((lex) => [lex.thai, lex.translit, lex.english]),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return (
    joined.includes("?") ||
    joined.includes("question") ||
    joined.includes("ask") ||
    joined.includes("request") ||
    joined.includes("ไหม") ||
    joined.includes("mái") ||
    joined.includes("can you")
  );
}

function stageQaSourcePaths(lessonId: string, reportFile: string): string[] {
  if (reportFile === "editorial-qa-report.md") {
    return ["brief.md", "script-master.json", "script-spoken.md", "script-visual.md"].map(
      (file) => resolveLessonFile(lessonId, file)
    );
  }

  if (reportFile === "visual-qa-report.md") {
    return ["script-master.json", "script-spoken.md", "script-visual.md"].map((file) =>
      resolveLessonFile(lessonId, file)
    );
  }

  if (reportFile === "assessment-qa-report.md") {
    return ["script-master.json", "flashcards.json", "quiz-item-bank.json", "quiz.json"].map(
      (file) => resolveLessonFile(lessonId, file)
    );
  }

  return [];
}

function scriptMastersForModule(moduleId: string): Array<{ lessonId: string; script: ScriptMaster }> {
  return listReusableLessonIds(root)
    .filter((lessonId) => lessonId.startsWith(`${moduleId}-`))
    .map((lessonId) => ({
      lessonId,
      script: readReusableLessonScript(root, lessonId),
    }))
    .filter(
      (entry): entry is { lessonId: string; script: ScriptMaster } =>
        Boolean(entry.script)
    );
}

function collectPriorScriptMasters(lessonId: string): Array<{ lessonId: string; script: ScriptMaster }> {
  const { moduleId, lessonNum } = parseLessonRef(lessonId);
  return scriptMastersForModule(moduleId).filter((p) => parseLessonRef(p.lessonId).lessonNum < lessonNum);
}

function rebuildVocabIndex(): VocabIndex {
  const allScripts = listReusableLessonIds(root).map((lessonId) => ({
    lessonId,
    script: readReusableLessonScript(root, lessonId),
  }));

  const byId = new Map<string, VocabIndex["entries"][number]>();

  for (const lesson of allScripts) {
    const script = lesson.script;
    if (!script) {
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
  const isLegacyLesson = compareLessonIds(script.lessonId, "M01-L004") < 0;
  const lexemes = script.sections.flatMap((s) => s.languageFocus);
  const translits = [
    ...lexemes.map((l) => l.translit),
    ...script.roleplay.lines.map((l) => l.translit),
    ...script.sections.flatMap((s) => s.onScreenBullets.map((b) => b.split("|")[1]?.trim() ?? "")),
  ];

  // Mid-tone words in PTM have no diacritical mark by convention, so don't require tone marks
  const translitIssues = translits.filter((t) => !checkTransliterationPolicy(t, false).ok);

  const tripletIssue = script.sections.some((s) =>
    s.languageFocus.some((l) => !l.thai || !l.translit || !l.english || !l.vocabId) ||
    s.onScreenBullets.some((b) => b.split("|").map((p) => p.trim()).length < 3),
  );

  const reusedReviewItems = script.context.reviewBuckets
    .flatMap((bucket) => bucket.sample)
    .filter((lex) =>
      script.sections.some((section) =>
        section.languageFocus.some(
          (focus) =>
            focus.thai.trim() === lex.thai.trim() &&
            focus.translit.trim().toLowerCase() ===
              lex.translit.trim().toLowerCase() &&
            focus.english.trim().toLowerCase() ===
              lex.english.trim().toLowerCase()
        )
      )
    ).length;

  const hasTeachingFrame =
    !!script.teachingFrame &&
    script.teachingFrame.openingHook.trim().length > 0 &&
    script.teachingFrame.scenario.trim().length > 0 &&
    script.teachingFrame.learnerTakeaway.trim().length > 0;

  const visualPlans = script.sections.map((section) => ({
    sectionId: section.id,
    plan: section.visualPlan,
  }));
  const visualPlanIssues = visualPlans
    .filter(({ plan }) => {
      if (!plan) return true;
      if (plan.onScreenGoal.trim().length === 0) return true;
      if (plan.teachingVisuals.length < 2) return true;
      if (plan.teacherCues.length < 1) return true;
      if (plan.imageSupport.rationale.trim().length === 0) return true;
      if (plan.imageSupport.sourceHints.length < 1) return true;
      if (plan.imageSupport.helpful && plan.imageSupport.searchQueries.length < 1) return true;
      return false;
    })
    .map(({ sectionId }) => sectionId);

  const sectionsWithConcreteAssetPlan = visualPlans.filter(({ plan }) =>
    !!plan &&
    plan.imageSupport.helpful &&
    plan.imageSupport.priority !== "avoid" &&
    plan.imageSupport.searchQueries.length >= 1
  ).length;
  const roleplayLineKeys = script.roleplay.lines.map((line) =>
    [line.speaker, line.thai, line.translit, line.english]
      .map((part) => part.trim().toLowerCase())
      .join("|")
  );
  const hasDuplicateRoleplayLines =
    new Set(roleplayLineKeys).size !== roleplayLineKeys.length;
  const hasSpeakerTurnBreak = script.roleplay.lines.some((line, index, lines) => {
    if (index === 0) {
      return false;
    }
    return line.speaker.trim() === lines[index - 1]?.speaker.trim();
  });
  const hasQuestionLikeRoleplayLine = script.roleplay.lines.some((line) =>
    roleplayLineLooksQuestionLike(line)
  );
  const answerParticleWithoutQuestion = script.roleplay.lines.some((line, index, lines) => {
    if (!roleplayLineLooksYesNoAnswer(line)) {
      return false;
    }

    return !lines
      .slice(Math.max(0, index - 2), index)
      .some((candidate) => roleplayLineLooksQuestionLike(candidate));
  });
  const expectsQuestionRoleplay = lessonAppearsToTargetQuestions(script);

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
      id: "section-count",
      description: "Lesson contains at least 4 teaching sections",
      pass: isLegacyLesson || script.sections.length >= 4,
      evidence: isLegacyLesson
        ? `Legacy lesson exemption applied with ${script.sections.length} sections`
        : `Lesson contains ${script.sections.length} sections`,
    },
    {
      id: "section-depth",
      description: "Each section includes at least 3 spoken narration lines",
      pass:
        isLegacyLesson ||
        script.sections.every((s) => s.spokenNarration.length >= 3),
      evidence:
        isLegacyLesson
          ? "Legacy lesson exemption applied"
          : script.sections.every((s) => s.spokenNarration.length >= 3)
          ? "Each section has >=3 spoken narration lines"
          : "At least one section has fewer than 3 spoken narration lines",
    },
    {
      id: "roleplay",
      description: "Scenario roleplay included and substantial",
      pass: isLegacyLesson || script.roleplay.lines.length >= 6,
      evidence: `Roleplay contains ${script.roleplay.lines.length} lines`,
    },
    {
      id: "roleplay-duplicates",
      description: "Roleplay does not repeat exact lines",
      pass: !hasDuplicateRoleplayLines,
      evidence: hasDuplicateRoleplayLines
        ? "Duplicate exact roleplay lines detected"
        : "All roleplay lines are distinct",
    },
    {
      id: "roleplay-turn-taking",
      description: "Roleplay alternates speakers cleanly",
      pass: !hasSpeakerTurnBreak,
      evidence: hasSpeakerTurnBreak
        ? "Adjacent roleplay lines reuse the same speaker label"
        : "Roleplay alternates speakers line by line",
    },
    {
      id: "roleplay-answer-logic",
      description: "Yes/no answer particles appear only after a nearby question or confirmation turn",
      pass: !answerParticleWithoutQuestion,
      evidence: answerParticleWithoutQuestion
        ? "Found ใช่ / ไม่ใช่ style answer line without a nearby question turn"
        : "Answer particles follow question-like turns when used",
    },
    {
      id: "roleplay-question-target",
      description: "Question-target lessons include at least one question-like roleplay turn",
      pass: !expectsQuestionRoleplay || hasQuestionLikeRoleplayLine,
      evidence: !expectsQuestionRoleplay
        ? "Lesson does not appear to target question formation directly"
        : hasQuestionLikeRoleplayLine
        ? "Roleplay includes a question-like turn"
        : "Lesson targets questions or requests but roleplay contains no question-like turn",
    },
    {
      id: "recap",
      description: "Recap includes at least 3 review items",
      pass: script.recap.length >= 3,
      evidence: `Recap contains ${script.recap.length} items`,
    },
    {
      id: "review-reuse",
      description: "Lesson reuses at least 2 prior items when prior lesson context exists",
      pass: script.context.priorLessons.length === 0 || reusedReviewItems >= 2,
      evidence:
        script.context.priorLessons.length === 0
          ? "No prior lessons available; review reuse check not required"
          : `Reused ${reusedReviewItems} prior vocabulary items in language focus`,
    },
    {
      id: "teaching-frame",
      description: "Lesson includes a clear teaching frame with runtime and learner takeaway",
      pass: isLegacyLesson || hasTeachingFrame,
      evidence: isLegacyLesson
        ? "Legacy lesson exemption applied"
        : hasTeachingFrame
        ? `Teaching frame: ${script.teachingFrame?.scenario}`
        : "teachingFrame is missing or incomplete",
    },
    {
      id: "visual-plan",
      description: "Each section includes a left-panel visual plan and explicit image decision",
      pass: isLegacyLesson || visualPlanIssues.length === 0,
      evidence: isLegacyLesson
        ? "Legacy lesson exemption applied"
        : visualPlanIssues.length === 0
        ? "Every section includes visualPlan with usable teaching visuals and image rationale"
        : `Missing or incomplete visualPlan in sections: ${visualPlanIssues.join(", ")}`,
    },
    {
      id: "asset-research",
      description: "Lesson provides at least one concrete image research query when visuals would help",
      pass: isLegacyLesson || sectionsWithConcreteAssetPlan >= 1,
      evidence: isLegacyLesson
        ? "Legacy lesson exemption applied"
        : `Sections with concrete asset research queries: ${sectionsWithConcreteAssetPlan}`,
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
    visualPlan: {
      leftPanelLayout: "focus-card" as const,
      onScreenGoal: `Show ${s.heading.toLowerCase()} clearly in the left teaching area.`,
      teachingVisuals: [s.heading, ...s.onScreenBullets.slice(0, 2)],
      teacherCues: ["Pause after each model line.", "Point attention to the Thai script before transliteration."],
      imageSupport: {
        helpful: true,
        priority: "supporting" as const,
        rationale: "A simple real-world anchor helps memory without replacing explicit explanation.",
        searchQueries: [`${seed.title} ${s.heading} thailand`],
        sourceHints: ["Pexels", "Wikimedia Commons"],
      },
    },
  }));

  const script: ScriptMaster = {
    schemaVersion: 1,
    lessonId,
    title: seed.title,
    objective: seed.objective,
    teachingFrame: {
      openingHook: `Open with the learner problem that ${seed.title.toLowerCase()} solves immediately.`,
      scenario: seed.roleplay.scenario,
      learnerTakeaway: seed.recap[0] ?? seed.objective,
    },
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
  const scriptPath = resolveLessonFile(lessonId, "script-master.json");
  const spokenPath = resolveLessonFile(lessonId, "script-spoken.md");
  const visualPath = resolveLessonFile(lessonId, "script-visual.md");
  const script = readJson<ScriptMaster>(scriptPath);
  const spoken = existsSync(spokenPath) ? readFileSync(spokenPath, "utf8") : "";
  const visual = existsSync(visualPath) ? readFileSync(visualPath, "utf8") : "";

  const checks = buildScriptQaChecks(script);

  const supplementalIssues = [
    ...transliterationHardCheck(spoken).map((m) => `${lessonFile(lessonId, "script-spoken.md").split("/").pop()}: ${m}`),
    ...transliterationHardCheck(visual).map((m) => `${lessonFile(lessonId, "script-visual.md").split("/").pop()}: ${m}`),
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
    "- Minimum 4 sections for non-legacy lessons",
    "- Minimum 3 spoken narration lines per section for non-legacy lessons",
    "- Drills per section",
    "- Minimum 6 roleplay lines for non-legacy lessons",
    "- No duplicate exact roleplay lines",
    "- Clean roleplay turn-taking and yes/no answer logic",
    "- Question-target lessons must contain a question-like roleplay turn",
    "- Minimum 3 recap items",
    "- Minimum 2 reused prior items when prior context exists",
    "- Teaching frame with runtime, scenario, and learner takeaway",
    "- Visual plan per section with explicit image decision and asset research",
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

  const updatedScript: ScriptMaster = {
    ...script,
    qaChecks: checks,
  };

  if (JSON.stringify(updatedScript) !== JSON.stringify(script)) {
    writeJson(scriptPath, updatedScript);
  }

  return { pass, report, checks };
}

function runFixupVocabIds(): number {
  const lesson = getArg("--lesson");
  if (!lesson) {
    console.error("Missing --lesson");
    return 1;
  }

  const scriptPath = resolveLessonFile(lesson, "script-master.json");
  if (!existsSync(scriptPath)) {
    console.error(`Missing ${lessonFile(lesson, "script-master.json").split("/").pop()} for ${lesson}`);
    return 1;
  }

  const script = readJson<ScriptMaster>(scriptPath);
  const fixed = fixupScriptVocabIds(script);
  const before = JSON.stringify(script);
  const after = JSON.stringify(fixed);

  if (before !== after) {
    writeJson(scriptPath, fixed);
    rebuildVocabIndex();
    console.log(`Recomputed vocabIds for ${lesson}.`);
  } else {
    console.log(`VocabIds already current for ${lesson}.`);
  }
  return 0;
}


function stage4Pdf(script: ScriptMaster): PdfSource {
  const lexicon = dedupeLexemes(script.sections.flatMap((s) => s.languageFocus));
  const triplets = lexicon.map((l) => `${l.thai} | ${l.translit} | ${l.english}`);
  const roleplayLines = script.roleplay.lines.map((line) => `${line.speaker}: ${line.thai} | ${line.translit} | ${line.english}`);
  const teachingFrameLines = script.teachingFrame
    ? [
        `Scenario: ${script.teachingFrame.scenario}`,
        `Learner takeaway: ${script.teachingFrame.learnerTakeaway}`,
      ]
    : [script.objective];
  const sectionTips = script.sections.flatMap((section) => [
    `${section.heading}: ${section.purpose}`,
    ...section.spokenNarration.slice(0, 2),
  ]);

  return {
    schemaVersion: 1,
    lessonId: script.lessonId,
    title: `${script.lessonId} — ${script.title}`,
    sections: [
      {
        heading: "What you will be able to say after this lesson",
        body: teachingFrameLines,
      },
      {
        heading: "Core phrases (Thai / Transliteration / English)",
        body: triplets,
      },
      {
        heading: "Teaching notes and explanation cues",
        body: sectionTips,
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
  for (const lessonId of listReusableLessonIds(root)) {
    const path = resolveLessonFile(lessonId, "vocab-export.json");
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
    sourceScript:
      lessonFile(script.lessonId, "script-master.json").split("/").pop() ??
      "script-master.json",
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
    itemBankPath:
      lessonFile(script.lessonId, "quiz-item-bank.json").split("/").pop() ??
      "quiz-item-bank.json",
    questions,
    coverage: {
      minimumQuizItemsPerNewVocab: 1,
      perVocab: quizCoverage,
      pass: quizCoverage.every((c) => c.quizItemCount >= 1),
    },
  };

  return { itemBank, quiz, newLex: quizLex };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

export function renderSpokenHtml(script: ScriptMaster): string {
  const sectionCards = script.sections
    .map((section) => {
      const narration = section.spokenNarration
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("\n");
      const triplets = section.languageFocus
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.thai)}</td><td>${escapeHtml(item.translit)}</td><td>${escapeHtml(item.english)}</td></tr>`
        )
        .join("\n");
      const drills = section.drills.map((drill) => `<li>${escapeHtml(drill)}</li>`).join("\n");

      return `
        <section class="card">
          <div class="eyebrow">${escapeHtml(section.id.toUpperCase())}</div>
          <h2>${escapeHtml(section.heading)}</h2>
          <p class="purpose">${escapeHtml(section.purpose)}</p>
          <div class="narration">${narration}</div>
          <h3>Core triplets</h3>
          <table>
            <thead>
              <tr><th>Thai</th><th>Transliteration</th><th>English</th></tr>
            </thead>
            <tbody>${triplets}</tbody>
          </table>
          <h3>Drills</h3>
          <ul>${drills}</ul>
        </section>
      `;
    })
    .join("\n");

  const roleplayRows = script.roleplay.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.speaker)}</td><td>${escapeHtml(line.thai)}</td><td>${escapeHtml(line.translit)}</td><td>${escapeHtml(line.english)}</td></tr>`
    )
    .join("\n");

  const recapItems = script.recap.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(script.lessonId)} Spoken Script</title>
    <style>
      :root {
        color-scheme: light;
        --page: #f4f1ea;
        --card: #fffdf9;
        --ink: #1f2933;
        --muted: #5b6670;
        --line: #d6d0c4;
        --accent: #8d5a2b;
        --thai: "Sarabun", "TH Sarabun New", "Noto Sans Thai Looped Regular", sans-serif;
        --latin: "Sarabun", "TH Sarabun New", "Noto Sans Thai Looped Regular", sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: var(--latin);
        background: var(--page);
        color: var(--ink);
        line-height: 1.55;
      }
      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 32px 24px 64px;
      }
      header {
        margin-bottom: 28px;
      }
      h1, h2, h3 {
        margin: 0 0 10px;
        font-family: var(--latin);
      }
      h1 {
        font-size: 2rem;
      }
      h2 {
        font-size: 1.45rem;
      }
      h3 {
        margin-top: 22px;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--accent);
      }
      .subhead {
        color: var(--muted);
        font-size: 1rem;
        margin-top: 8px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 22px 22px 18px;
        margin-bottom: 20px;
        box-shadow: 0 8px 24px rgba(31, 41, 51, 0.06);
      }
      .eyebrow {
        color: var(--accent);
        font-size: 0.9rem;
        font-weight: 700;
        margin-bottom: 8px;
        letter-spacing: 0.04em;
      }
      .purpose {
        color: var(--muted);
        margin-top: 0;
      }
      .narration p {
        margin: 0 0 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th {
        font-size: 0.92rem;
        color: var(--muted);
      }
      td:first-child, .thai {
        font-family: var(--thai);
        font-size: 1.1rem;
      }
      ul {
        margin: 10px 0 0 18px;
        padding: 0;
      }
      li {
        margin: 0 0 8px;
      }
      @media print {
        body {
          background: white;
        }
        main {
          max-width: none;
          padding: 0;
        }
        .card {
          box-shadow: none;
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="eyebrow">${escapeHtml(script.lessonId)}</div>
        <h1>Spoken Script — ${escapeHtml(script.title)}</h1>
        <p class="subhead">${escapeHtml(script.objective)}</p>
      </header>
      ${sectionCards}
      <section class="card">
        <div class="eyebrow">ROLEPLAY</div>
        <h2>${escapeHtml(script.roleplay.scenario)}</h2>
        <table>
          <thead>
            <tr><th>Speaker</th><th>Thai</th><th>Transliteration</th><th>English</th></tr>
          </thead>
          <tbody>${roleplayRows}</tbody>
        </table>
      </section>
      <section class="card">
        <div class="eyebrow">RECAP</div>
        <h2>What the learner should leave with</h2>
        <ul>${recapItems}</ul>
      </section>
    </main>
  </body>
</html>
`;
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
  const statusPath = resolveLessonFile(lessonId, "status.json");
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
  const path = resolveLessonFile(lessonId, "status.json");
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
  const requiredByStage: Record<StageId, string[]> = {
    "0": [],
    "1": ["context.json"],
    "2": [
      "script-master.json",
      "script-spoken.md",
      "script-visual.md",
      "editorial-qa-report.md",
    ],
    "3": ["qa-report.md"],
    "4": ["deck-source.json", "deck.pptx", "asset-provenance.json", "visual-qa-report.md"],
    "5": ["pdf-source.json", "pdf.md", "pdf.pdf"],
    "6": ["flashcards.json", "vocab-export.json"],
    "7": [
      "quiz-item-bank.json",
      "quiz.json",
      "editorial-qa-report.md",
      "visual-qa-report.md",
      "assessment-qa-report.md",
    ],
  };

  const issues: string[] = [];
  for (const file of requiredByStage[stage]) {
    const path = resolveLessonFile(lessonId, file);
    if (!existsSync(path)) issues.push(`Missing prerequisite for stage ${stage}: ${file}`);
  }

  if (stage === "3") {
    const qaPath = resolveLessonFile(lessonId, "qa-report.md");
    if (existsSync(qaPath)) {
      const qa = readFileSync(qaPath, "utf8");
      if (qa.includes("Result: FAIL")) {
        issues.push("QA report is FAIL; downstream stages are blocked.");
      }
    }
  }

  const requiredPassReports: Partial<Record<StageId, string[]>> = {
    "2": ["editorial-qa-report.md"],
    "4": ["visual-qa-report.md"],
    "7": [
      "editorial-qa-report.md",
      "visual-qa-report.md",
      "assessment-qa-report.md",
    ],
  };

  for (const reportFile of requiredPassReports[stage] ?? []) {
    const reportPath = resolveLessonFile(lessonId, reportFile);
    if (existsSync(reportPath) && !reportHasPassResult(reportPath)) {
      issues.push(`${reportFile} is not PASS; stage ${stage} is blocked.`);
    }
    if (
      existsSync(reportPath) &&
      reportHasPassResult(reportPath) &&
      !reportIsFreshAgainst(reportPath, stageQaSourcePaths(lessonId, reportFile))
    ) {
      issues.push(`${reportFile} is stale; rerun the corresponding QA review before stage ${stage}.`);
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
    writeJson(resolveLessonFile(lessonId, "context.json"), context);
    const bucketSummary = context.reviewBuckets
      .map((b) => `${b.bucket}:${b.lessonId ?? "none"}${b.vocabIds.length ? `(${b.vocabIds.length})` : ""}`)
      .join(", ");
    return { code: 0, meta: `reviewBuckets=${bucketSummary}` };
  }

  if (stage === "1") {
    const context = readJson<LessonContext>(resolveLessonFile(lessonId, "context.json"));
    const script = stage1ScriptGeneration(lessonId, context);
    writeJson(lessonFile(lessonId, "script-master.json"), script);
    writeText(lessonFile(lessonId, "script-spoken.md"), renderSpoken(script));
    writeText(lessonFile(lessonId, "script-spoken.html"), renderSpokenHtml(script));
    writeText(lessonFile(lessonId, "script-visual.md"), renderVisual(script));
    rebuildVocabIndex();
    return { code: 0, meta: `generated sections=${script.sections.length}` };
  }

  if (stage === "2") {
    const qa = stage2QaLoop(lessonId);
    writeText(lessonFile(lessonId, "qa-report.md"), qa.report);
    return { code: qa.pass ? 0 : 2, meta: `qa=${qa.pass ? "PASS" : "FAIL"}` };
  }

  const script = readJson<ScriptMaster>(resolveLessonFile(lessonId, "script-master.json"));
  writeText(lessonFile(lessonId, "script-spoken.html"), renderSpokenHtml(script));

  if (stage === "3") {
    const stage3Process = spawnSync(
      "python3",
      [
        join(root, "course", "tools", "render_lesson_deck.py"),
        "--repo-root",
        root,
        "--lesson",
        lessonId,
      ],
      {
        cwd: root,
        encoding: "utf8",
      }
    );
    if (stage3Process.stdout) {
      process.stdout.write(stage3Process.stdout);
    }
    if (stage3Process.stderr) {
      process.stderr.write(stage3Process.stderr);
    }
    if (stage3Process.status !== 0) {
      return {
        code: stage3Process.status ?? 1,
        meta: "pptx-stage3-failed",
      };
    }

    const deckSource = readJson<DeckSource>(resolveLessonFile(lessonId, "deck-source.json"));
    return { code: 0, meta: `slides=${deckSource.slides.length}` };
  }

  if (stage === "4") {
    const pdf = stage4Pdf(script);
    writeJson(lessonFile(lessonId, "pdf-source.json"), pdf);
    writeText(lessonFile(lessonId, "pdf.md"), renderPdfMd(pdf));
    await renderLessonPdfById(root, lessonId);
    return {
      code: 0,
      meta: `${lessonFile(lessonId, "pdf.md").split("/").pop()} + ${lessonFile(lessonId, "pdf.pdf").split("/").pop()} generated`,
    };
  }

  if (stage === "5") {
    const deck = stage5Flashcards(script);
    writeJson(lessonFile(lessonId, "flashcards.json"), deck);
    writeJson(lessonFile(lessonId, "vocab-export.json"), lessonVocabExport(script, deck));
    rebuildVocabIndex();
    const global = rebuildGlobalVocabExport();
    return { code: 0, meta: `cards=${deck.cards.length}, globalCards=${global.cards.length}` };
  }

  if (stage === "6") {
    const quizData = stage6Quiz(script);
    writeJson(lessonFile(lessonId, "quiz-item-bank.json"), quizData.itemBank);
    writeJson(lessonFile(lessonId, "quiz.json"), quizData.quiz);
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
      const qa = readFileSync(resolveLessonFile(lessonId, "qa-report.md"), "utf8");
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

function looksThaiLike(value: string): boolean {
  return /[\u0E00-\u0E7F]/u.test(value);
}

function translitPartIndex(parts: string[]): number | null {
  if (parts.length < 3) {
    return null;
  }

  if (parts.length >= 4 && looksThaiLike(parts[1] ?? "")) {
    return 2;
  }

  return 1;
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
      const translitIndex = translitPartIndex(parts);
      if (translitIndex !== null) {
        const tripletLabel = `${label}.triplet.translit`;
        const audited = auditStringValue(parts[translitIndex] ?? "", tripletLabel, fix);
        const rebuiltParts = [...parts];
        rebuiltParts[translitIndex] = audited.value;
        return {
          value: audited.changed ? rebuiltParts.join(" | ") : node,
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
    const translitIndex = translitPartIndex(parts);
    if (translitIndex === null) continue;

    const label = `${path}#line-${i + 1}.triplet.translit`;
    const audited = auditStringValue(parts[translitIndex] ?? "", label, fix);
    issues.push(...audited.issues);
    autoFixes.push(...audited.autoFixes);
    manualReview.push(...audited.manualReview);

    if (fix && audited.changed) {
      const rebuiltParts = [...parts];
      rebuiltParts[translitIndex] = audited.value;
      lines[i] = rebuiltParts.join(" | ");
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
    "deck-source.json",
    "canva-content.json",
    "pdf-source.json",
    "pdf.md",
    "vocab-export.json",
    "quiz-item-bank.json",
    "quiz.json",
    "flashcards.json",
  ];

  for (const file of lessonFiles) {
    const path = resolveLessonDirFile(lessonDir, file);
    if (existsSync(path)) targets.push(path);
  }

  return targets;
}

function collectGlobalAuditTargets(): string[] {
  const targets = new Set<string>();

  for (const dir of listLessonDirs(root)) {
    targets.add(resolveLessonDirFile(dir, "context.json"));
    targets.add(resolveLessonDirFile(dir, "script-master.json"));
    targets.add(resolveLessonDirFile(dir, "script-spoken.md"));
    targets.add(resolveLessonDirFile(dir, "script-visual.md"));
    targets.add(resolveLessonDirFile(dir, "deck-source.json"));
    targets.add(resolveLessonDirFile(dir, "canva-content.json"));
    targets.add(resolveLessonDirFile(dir, "pdf-source.json"));
    targets.add(resolveLessonDirFile(dir, "pdf.md"));
    targets.add(resolveLessonDirFile(dir, "vocab-export.json"));
    targets.add(resolveLessonDirFile(dir, "quiz-item-bank.json"));
    targets.add(resolveLessonDirFile(dir, "quiz.json"));
    targets.add(resolveLessonDirFile(dir, "flashcards.json"));
  }

  targets.add(join(root, "course", "vocab", "vocab-index.json"));
  targets.add(join(root, "course", "exports", "flashcards-global.json"));
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
  if (state === "READY_TO_RECORD") {
    rebuildVocabIndex();
    rebuildGlobalVocabExport();
  }
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
  const statusPath = join(lessonPath(root, lesson), "status.json");
  const previousStatus = existsSync(statusPath)
    ? readJson<LessonStatus>(statusPath)
    : ({
        lessonId: lesson,
        state: "BACKLOG",
        updatedAt: nowIso(),
        validatedAt: null,
      } satisfies LessonStatus);
  const state =
    result.code === 0
      ? previousStatus.state
      : "DRAFT";
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
    case "fixup-vocabids":
      return runFixupVocabIds();
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
