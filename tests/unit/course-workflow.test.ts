import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { lessonArtifactFileName } from "../../src/lib/course-artifacts.ts";
import { fixupScriptVocabIds } from "../../course/tools/lib/vocab.ts";
import {
  readBlueprintLessonRows,
  reportHasPassResult,
  reportIsFreshAgainst,
  resolveBlueprintLesson,
  selectNextPlannedLesson,
  selectNextWorkflowLesson,
  type BlueprintLessonRow,
  type ProduceLessonState,
} from "../../course/tools/lib/produce-lesson.ts";
import { validateLessonDir } from "../../course/tools/lib/validators.ts";
import { listReusableLessonIds } from "../../course/tools/lib/reusable-lessons.ts";
import type { LessonStatus, ScriptMaster } from "../../course/tools/lib/types.ts";

function makeStatus(
  lessonId: string,
  state: LessonStatus["state"]
): LessonStatus {
  return {
    lessonId,
    state,
    updatedAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
    validatedAt: null,
  };
}

function sampleRow(lessonId: string): BlueprintLessonRow {
  const [moduleId] = lessonId.split("-");
  return {
    trackId: "T01",
    trackTitle: "Foundations",
    cefrBand: "A0",
    moduleId: moduleId ?? "M00",
    moduleTitle: "Sample Module",
    moduleExitOutcome: "Sample exit outcome",
    lessonId,
    lessonTitle: `Title ${lessonId}`,
    lessonPrimaryOutcome: "Primary",
    lessonSecondaryOutcome: "Secondary",
    grammarFunctionPrimary: "Primary grammar",
    grammarFunctionSecondary: "Secondary grammar",
    newVocabCore: "foo",
    newChunksCore: "bar",
    reviewVocabRequired: "baz",
    scriptTarget: "script target",
    listeningTarget: "listening target",
    speakingTarget: "speaking target",
    lessonQuizFocus: "quiz focus",
    moduleQuizLink: `${moduleId}-QUIZ`,
    flashcardTags: `${moduleId}; sample`,
    notes: "notes",
    sourceInspiration: "source",
  };
}

function workflowState(
  lessonId: string,
  phase: ProduceLessonState["phase"]
): ProduceLessonState {
  return {
    schemaVersion: 1,
    lessonId,
    blueprintRow: sampleRow(lessonId),
    qaAttempts: 1,
    phase,
    producedArtifacts: [],
    finalState: "DRAFT",
    updatedAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
  };
}

test("blueprint csv helper reads lessons from the real file", () => {
  const rows = readBlueprintLessonRows(process.cwd());
  assert.ok(rows.length >= 180);
  assert.equal(rows[0]?.lessonId, "M01-L001");
});

test("stage-1 prompt includes targeted conceptual anchor guidance", () => {
  const prompt = readFileSync(
    join(
      process.cwd(),
      "course",
      "prompts",
      "agent-prompts",
      "stage-1-script-generation.prompt.md"
    ),
    "utf8"
  );

  assert.match(prompt, /identify up to 3 high-risk concepts/i);
  assert.match(prompt, /translation-first, usage-first explanation style/i);
  assert.match(prompt, /explanation-research\.md/i);
  assert.match(prompt, /keep them spoken-first/i);
  assert.match(prompt, /do not force analogies into concrete vocabulary lessons/i);
});

test("editorial QA prompt and research note design require conceptual clarity", () => {
  const editorialPrompt = readFileSync(
    join(
      process.cwd(),
      "course",
      "prompts",
      "agent-prompts",
      "stage-1-editorial-qa.prompt.md"
    ),
    "utf8"
  );
  const designNote = readFileSync(
    join(process.cwd(), "course", "research", "prerecorded-language-lesson-design.md"),
    "utf8"
  );

  assert.match(editorialPrompt, /Conceptual clarity: PASS\/FAIL/i);
  assert.match(editorialPrompt, /misleading one-to-one English equivalent/i);
  assert.match(editorialPrompt, /explanation-research\.md/i);
  assert.match(editorialPrompt, /translation-first/i);
  assert.match(designNote, /Use conceptual anchors for slippery concepts/i);
});

test("selectNextPlannedLesson uses blueprint order", () => {
  const rows = [sampleRow("M02-L001"), sampleRow("M01-L004"), sampleRow("M01-L005")];
  const chosen = selectNextPlannedLesson(rows, (lessonId) => {
    if (lessonId === "M01-L005") {
      return makeStatus(lessonId, "PLANNED");
    }
    if (lessonId === "M01-L004") {
      return makeStatus(lessonId, "PLANNED");
    }
    return makeStatus(lessonId, "BACKLOG");
  });

  assert.equal(chosen?.lessonId, "M01-L004");
});

test("resolveBlueprintLesson prefers explicit lesson over auto-selection", () => {
  const rows = [sampleRow("M01-L004"), sampleRow("M02-L001")];
  const chosen = resolveBlueprintLesson(rows, "M02-L001", () =>
    makeStatus("M01-L004", "PLANNED")
  );

  assert.equal(chosen?.lessonId, "M02-L001");
});

test("selectNextWorkflowLesson resumes unfinished workflow before untouched planned lessons", () => {
  const rows = [sampleRow("M01-L004"), sampleRow("M01-L005")];
  const chosen = selectNextWorkflowLesson(
    rows,
    (lessonId) =>
      lessonId === "M01-L005"
        ? makeStatus(lessonId, "PLANNED")
        : makeStatus(lessonId, "DRAFT"),
    (lessonId) =>
      lessonId === "M01-L004" ? workflowState(lessonId, "awaiting_stage1") : null
  );

  assert.equal(chosen?.lessonId, "M01-L004");
});

test("fixupScriptVocabIds recomputes deterministic ids and is idempotent", () => {
  const script: ScriptMaster = {
    schemaVersion: 1,
    lessonId: "M01-L004",
    title: "Sample",
    objective: "Objective",
    context: {
      schemaVersion: 1,
      lessonId: "M01-L004",
      priorLessons: [],
      knownVocabulary: [],
      knownGrammar: [],
      reviewBuckets: [
        { bucket: "last", offset: 1, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus3", offset: 3, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus6", offset: 6, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus8", offset: 8, lessonId: null, vocabIds: [], sample: [] },
      ],
    },
    sections: [
      {
        id: "s1",
        heading: "Heading",
        purpose: "Purpose",
        spokenNarration: ["one", "two", "three"],
        onScreenBullets: ["สวัสดี | sà-wàt-dii | hello"],
        drills: ["Repeat"],
        languageFocus: [
          {
            thai: "สวัสดี",
            translit: "sà-wàt-dii",
            english: "hello",
            vocabId: "v-0000000000",
          },
        ],
      },
    ],
    roleplay: {
      scenario: "Scenario",
      lines: [
        { speaker: "A", thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" },
        { speaker: "B", thai: "ครับ", translit: "khráp", english: "male polite ending" },
        { speaker: "A", thai: "ขอบคุณ", translit: "khàawp-khun", english: "thank you" },
        { speaker: "B", thai: "ได้", translit: "dâai", english: "can" },
        { speaker: "A", thai: "ใช่", translit: "châi", english: "yes" },
        { speaker: "B", thai: "ไม่ใช่", translit: "mâi châi", english: "no" },
      ],
    },
    recap: ["item 1", "item 2"],
    qaChecks: [],
    policies: {
      transliteration: "PTM_ADAPTED_INLINE_TONES",
      imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT",
    },
  };

  const fixed = fixupScriptVocabIds(script);
  const fixedAgain = fixupScriptVocabIds(fixed);

  assert.match(
    fixed.sections[0]?.languageFocus[0]?.vocabId ?? "",
    /^v-[a-f0-9]{10}$/
  );
  assert.deepEqual(fixedAgain, fixed);
});

test("non-legacy lessons require teachingFrame and visualPlan", () => {
  const root = mkdtempSync(join(tmpdir(), "thai-nine-workflow-"));
  const lessonDir = join(root, "course", "modules", "M01", "L004");
  mkdirSync(lessonDir, { recursive: true });

  const script: ScriptMaster = {
    schemaVersion: 1,
    lessonId: "M01-L004",
    title: "Sample",
    objective: "Objective",
    context: {
      schemaVersion: 1,
      lessonId: "M01-L004",
      priorLessons: [],
      knownVocabulary: [],
      knownGrammar: [],
      reviewBuckets: [
        { bucket: "last", offset: 1, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus3", offset: 3, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus6", offset: 6, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus8", offset: 8, lessonId: null, vocabIds: [], sample: [] },
      ],
    },
    sections: [
      {
        id: "s1",
        heading: "Heading",
        purpose: "Purpose",
        spokenNarration: ["one", "two", "three"],
        onScreenBullets: ["สวัสดี | sà-wàt-dii | hello"],
        drills: ["Repeat"],
        languageFocus: [
          {
            thai: "สวัสดี",
            translit: "sà-wàt-dii",
            english: "hello",
            vocabId: "v-0000000000",
          },
        ],
      },
      {
        id: "s2",
        heading: "Heading 2",
        purpose: "Purpose",
        spokenNarration: ["one", "two", "three"],
        onScreenBullets: ["ขอบคุณ | khàawp-khun | thank you"],
        drills: ["Repeat"],
        languageFocus: [
          {
            thai: "ขอบคุณ",
            translit: "khàawp-khun",
            english: "thank you",
            vocabId: "v-0000000000",
          },
        ],
      },
      {
        id: "s3",
        heading: "Heading 3",
        purpose: "Purpose",
        spokenNarration: ["one", "two", "three"],
        onScreenBullets: ["ครับ | khráp | male polite ending"],
        drills: ["Repeat"],
        languageFocus: [
          {
            thai: "ครับ",
            translit: "khráp",
            english: "male polite ending",
            vocabId: "v-0000000000",
          },
        ],
      },
      {
        id: "s4",
        heading: "Heading 4",
        purpose: "Purpose",
        spokenNarration: ["one", "two", "three"],
        onScreenBullets: ["ค่ะ | khâ | female polite ending"],
        drills: ["Repeat"],
        languageFocus: [
          {
            thai: "ค่ะ",
            translit: "khâ",
            english: "female polite ending",
            vocabId: "v-0000000000",
          },
        ],
      },
    ],
    roleplay: {
      scenario: "Scenario",
      lines: [
        { speaker: "A", thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" },
        { speaker: "B", thai: "ครับ", translit: "khráp", english: "male polite ending" },
        { speaker: "A", thai: "ขอบคุณ", translit: "khàawp-khun", english: "thank you" },
        { speaker: "B", thai: "ได้", translit: "dâai", english: "can" },
        { speaker: "A", thai: "ใช่", translit: "châi", english: "yes" },
        { speaker: "B", thai: "ไม่ใช่", translit: "mâi châi", english: "no" },
      ],
    },
    recap: ["item 1", "item 2"],
    qaChecks: [],
    policies: {
      transliteration: "PTM_ADAPTED_INLINE_TONES",
      imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT",
    },
  };

  writeFileSync(
    join(lessonDir, lessonArtifactFileName("M01-L004", "script-master.json")),
    JSON.stringify(script, null, 2)
  );
  writeFileSync(
    join(lessonDir, "status.json"),
    JSON.stringify(
      {
        lessonId: "M01-L004",
        state: "DRAFT",
        updatedAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
        validatedAt: null,
      },
      null,
      2
    )
  );

  const issues = validateLessonDir(lessonDir, root);

  assert.ok(issues.some((issue) => issue.message.includes("require teachingFrame")));
  assert.ok(issues.some((issue) => issue.message.includes("requires visualPlan")));
});

test("reusable lesson gating excludes legacy ready lessons", () => {
  const root = mkdtempSync(join(tmpdir(), "thai-nine-reuse-"));
  const legacyDir = join(root, "course", "modules", "M01", "L001");
  const reusableDir = join(root, "course", "modules", "M01", "L004");
  mkdirSync(legacyDir, { recursive: true });
  mkdirSync(reusableDir, { recursive: true });

  const legacyScript: ScriptMaster = {
    schemaVersion: 1,
    lessonId: "M01-L001",
    title: "Legacy",
    objective: "Legacy",
    context: {
      schemaVersion: 1,
      lessonId: "M01-L001",
      priorLessons: [],
      knownVocabulary: [],
      knownGrammar: [],
      reviewBuckets: [
        { bucket: "last", offset: 1, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus3", offset: 3, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus6", offset: 6, lessonId: null, vocabIds: [], sample: [] },
        { bucket: "minus8", offset: 8, lessonId: null, vocabIds: [], sample: [] },
      ],
    },
    sections: [
      {
        id: "s1",
        heading: "Legacy",
        purpose: "Legacy",
        spokenNarration: ["one"],
        onScreenBullets: ["สวัสดี | sà-wàt-dii | hello"],
        drills: ["Repeat"],
        languageFocus: [
          { thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello", vocabId: "v-0000000000" },
        ],
      },
    ],
    roleplay: {
      scenario: "Legacy",
      lines: [
        { speaker: "A", thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" },
        { speaker: "B", thai: "สวัสดี", translit: "sà-wàt-dii", english: "hello" },
        { speaker: "A", thai: "ขอบคุณ", translit: "khàawp-khun", english: "thank you" },
      ],
    },
    recap: ["one", "two", "three"],
    qaChecks: [],
    policies: {
      transliteration: "PTM_ADAPTED_INLINE_TONES",
      imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT",
    },
  };

  const reusableScript: ScriptMaster = {
    ...legacyScript,
    lessonId: "M01-L004",
    title: "Reusable",
    teachingFrame: {
      targetRuntimeMin: 8,
      targetRuntimeMax: 10,
      openingHook: "Hook",
      scenario: "Scenario",
      learnerTakeaway: "Takeaway",
    },
    context: {
      ...legacyScript.context,
      lessonId: "M01-L004",
    },
    sections: legacyScript.sections.map((section) => ({
      ...section,
      visualPlan: {
        leftPanelLayout: "focus-card",
        onScreenGoal: "Goal",
        teachingVisuals: ["Visual 1", "Visual 2"],
        teacherCues: ["Cue"],
        imageSupport: {
          helpful: false,
          priority: "avoid",
          rationale: "Text-only",
          searchQueries: [],
          sourceHints: ["text-only"],
        },
      },
    })),
  };

  writeFileSync(
    join(legacyDir, lessonArtifactFileName("M01-L003", "script-master.json")),
    JSON.stringify(legacyScript, null, 2)
  );
  writeFileSync(
    join(reusableDir, lessonArtifactFileName("M01-L004", "script-master.json")),
    JSON.stringify(reusableScript, null, 2)
  );
  writeFileSync(
    join(legacyDir, "status.json"),
    JSON.stringify({ lessonId: "M01-L001", state: "READY_TO_RECORD", updatedAt: new Date().toISOString(), validatedAt: new Date().toISOString() }, null, 2)
  );
  writeFileSync(
    join(reusableDir, "status.json"),
    JSON.stringify({ lessonId: "M01-L004", state: "READY_TO_RECORD", updatedAt: new Date().toISOString(), validatedAt: new Date().toISOString() }, null, 2)
  );

  assert.deepEqual(listReusableLessonIds(root), ["M01-L004"]);
});

test("workflow artifact list includes the new QA reports", async () => {
  const module = await import("../../course/tools/lib/produce-lesson.ts");

  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("deck-source.json"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("deck.pptx"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("script-spoken.html"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("canva-content.json"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("canva-deck.pptx"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("canva-import-guide.md"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("editorial-qa-report.md"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("visual-qa-report.md"));
  assert.ok(module.WORKFLOW_ARTIFACT_FILES.includes("assessment-qa-report.md"));
});

test("visual QA prompt includes Canva-first checks", () => {
  const prompt = readFileSync(
    join(
      process.cwd(),
      "course",
      "prompts",
      "agent-prompts",
      "stage-3-visual-qa.prompt.md"
    ),
    "utf8"
  );

  assert.match(prompt, /canva-content\.json/i);
  assert.match(prompt, /Canva handoff quality: PASS\/FAIL/i);
  assert.match(prompt, /one-shot import/i);
  assert.match(prompt, /Sarabun/i);
  assert.match(prompt, /Thai \(PTM transliteration\)/i);
  assert.match(prompt, /recording anchor|presenter mode/i);
});

test("ready lessons require the PPTX deck artifact pack", () => {
  const root = mkdtempSync(join(tmpdir(), "thai-nine-ready-"));
  const lessonDir = join(root, "course", "modules", "M01", "L004");
  mkdirSync(lessonDir, { recursive: true });

  writeFileSync(
    join(lessonDir, "status.json"),
    JSON.stringify(
      {
        lessonId: "M01-L004",
        state: "READY_TO_RECORD",
        updatedAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
        validatedAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
      },
      null,
      2
    )
  );

  const issues = validateLessonDir(lessonDir, root);

  assert.ok(issues.some((issue) => issue.path.endsWith("M01-L004-deck-source.json")));
  assert.ok(issues.some((issue) => issue.path.endsWith("M01-L004-deck.pptx")));
});

test("report helpers detect PASS results and freshness", () => {
  const root = mkdtempSync(join(tmpdir(), "thai-nine-report-"));
  const sourcePath = join(root, lessonArtifactFileName("M01-L004", "script-master.json"));
  const reportPath = join(root, lessonArtifactFileName("M01-L004", "editorial-qa-report.md"));

  writeFileSync(sourcePath, JSON.stringify({ ok: true }, null, 2));
  writeFileSync(reportPath, "# Editorial QA Report\n\nResult: PASS\n");
  utimesSync(sourcePath, new Date("2026-03-11T00:00:00.000Z"), new Date("2026-03-11T00:00:00.000Z"));
  utimesSync(reportPath, new Date("2026-03-11T00:01:00.000Z"), new Date("2026-03-11T00:01:00.000Z"));

  assert.equal(reportHasPassResult("Result: PASS"), true);
  assert.equal(reportHasPassResult("Result: FAIL"), false);
  assert.equal(reportIsFreshAgainst(reportPath, [sourcePath]), true);

  writeFileSync(sourcePath, JSON.stringify({ ok: false }, null, 2));
  utimesSync(sourcePath, new Date("2026-03-11T00:02:00.000Z"), new Date("2026-03-11T00:02:00.000Z"));
  assert.equal(reportIsFreshAgainst(reportPath, [sourcePath]), false);
});
