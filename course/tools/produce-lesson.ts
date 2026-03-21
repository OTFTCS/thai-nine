#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
  lessonArtifactPath,
  lessonPath,
  readJson,
  resolveLessonArtifactPath,
  writeJson,
  writeText,
} from "./lib/fs.ts";
import { compareLessonIds } from "./lib/lesson-ids.ts";
import { listReusableLessonIds, readReusableLessonScript } from "./lib/reusable-lessons.ts";
import {
  listProducedArtifacts,
  newestMtimeMs,
  reportHasPassResult,
  reportIsFreshAgainst,
  readBlueprintLessonRows,
  readLessonStatus,
  resolveBlueprintLesson,
  stage1FilesExist,
  type BlueprintLessonRow,
  type ProduceLessonState,
} from "./lib/produce-lesson.ts";
import type { LessonContext, LessonStatus, ScriptMaster } from "./lib/types.ts";

const root = resolve(process.cwd());
const MAX_QA_ATTEMPTS = 3;
const MAX_EXEMPLARS = 3;

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function workflowStatePath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "produce-lesson-state.json");
}

function stage1WorkOrderPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-stage1-work-order.md");
}

function stage1InputPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-stage1-input.json");
}

function repairWorkOrderPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-stage2-repair-work-order.md");
}

function repairInputPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-stage2-repair-input.json");
}

function editorialQaReportPath(lessonId: string): string {
  return lessonArtifactPath(root, lessonId, "editorial-qa-report.md");
}

function editorialQaWorkOrderPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-editorial-qa-work-order.md");
}

function editorialQaInputPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-editorial-qa-input.json");
}

function visualQaReportPath(lessonId: string): string {
  return lessonArtifactPath(root, lessonId, "visual-qa-report.md");
}

function visualQaWorkOrderPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-visual-qa-work-order.md");
}

function visualQaInputPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-visual-qa-input.json");
}

function assessmentQaReportPath(lessonId: string): string {
  return lessonArtifactPath(root, lessonId, "assessment-qa-report.md");
}

function lessonFilePath(lessonId: string, baseName: string): string {
  return lessonArtifactPath(root, lessonId, baseName);
}

function resolveLessonFilePath(lessonId: string, baseName: string): string {
  return resolveLessonArtifactPath(root, lessonId, baseName);
}

function assessmentQaWorkOrderPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-assessment-qa-work-order.md");
}

function assessmentQaInputPath(lessonId: string): string {
  return join(lessonPath(root, lessonId), "codex-assessment-qa-input.json");
}

function readWorkflowState(
  lessonId: string,
  blueprintRow: BlueprintLessonRow
): ProduceLessonState {
  const path = workflowStatePath(lessonId);
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      lessonId,
      blueprintRow,
      qaAttempts: 0,
      phase: "selected",
      producedArtifacts: [],
      finalState: readLessonStatus(root, lessonId).state,
      updatedAt: nowIso(),
    };
  }

  return readJson<ProduceLessonState>(path);
}

function readExistingWorkflowState(lessonId: string): ProduceLessonState | null {
  const path = workflowStatePath(lessonId);
  if (!existsSync(path)) {
    return null;
  }
  return readJson<ProduceLessonState>(path);
}

function writeWorkflowState(state: ProduceLessonState): void {
  writeJson(workflowStatePath(state.lessonId), {
    ...state,
    producedArtifacts: listProducedArtifacts(root, state.lessonId),
    finalState: readLessonStatus(root, state.lessonId).state,
    updatedAt: nowIso(),
  });
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function readOptional(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, "utf8");
}

type TransliterationOccurrence = {
  translit: string;
  source: string;
};

type TransliterationReviewEntry = {
  thai: string;
  translits: string[];
  occurrences: TransliterationOccurrence[];
};

function addTransliterationOccurrence(
  bucket: Map<string, TransliterationOccurrence[]>,
  thai: string | null | undefined,
  translit: string | null | undefined,
  source: string
): void {
  const normalizedThai = (thai ?? "").trim();
  const normalizedTranslit = (translit ?? "").trim();
  if (!normalizedThai || !normalizedTranslit) {
    return;
  }

  const current = bucket.get(normalizedThai) ?? [];
  current.push({ translit: normalizedTranslit, source });
  bucket.set(normalizedThai, current);
}

function buildTransliterationReview(
  lessonId: string,
  scriptMaster: ScriptMaster,
  flashcardsJson: Record<string, unknown>,
  quizItemBankJson: Record<string, unknown>,
  quizJson: Record<string, unknown>,
  vocabExportJson: Record<string, unknown>
) {
  const occurrences = new Map<string, TransliterationOccurrence[]>();

  for (const [sectionIndex, section] of scriptMaster.sections.entries()) {
    for (const lex of section.languageFocus) {
      addTransliterationOccurrence(
        occurrences,
        lex.thai,
        lex.translit,
        `script-master.sections[${sectionIndex}].languageFocus`
      );
    }
  }

  if (scriptMaster.roleplay) {
    for (const [lineIndex, line] of scriptMaster.roleplay.lines.entries()) {
      addTransliterationOccurrence(
        occurrences,
        line.thai,
        line.translit,
        `script-master.roleplay.lines[${lineIndex}]`
      );
    }
  }

  const flashcards = Array.isArray((flashcardsJson as { cards?: unknown[] }).cards)
    ? ((flashcardsJson as { cards: Array<Record<string, unknown>> }).cards ?? [])
    : [];
  for (const [index, card] of flashcards.entries()) {
    addTransliterationOccurrence(
      occurrences,
      typeof card.front === "string" ? card.front : undefined,
      typeof card.translit === "string" ? card.translit : undefined,
      `flashcards.cards[${index}]`
    );
  }

  const vocabCards = Array.isArray((vocabExportJson as { cards?: unknown[] }).cards)
    ? ((vocabExportJson as { cards: Array<Record<string, unknown>> }).cards ?? [])
    : [];
  for (const [index, card] of vocabCards.entries()) {
    addTransliterationOccurrence(
      occurrences,
      typeof card.thai === "string" ? card.thai : undefined,
      typeof card.translit === "string" ? card.translit : undefined,
      `vocab-export.cards[${index}]`
    );
  }

  const quizBankItems = Array.isArray((quizItemBankJson as { items?: unknown[] }).items)
    ? ((quizItemBankJson as { items: Array<Record<string, unknown>> }).items ?? [])
    : [];
  for (const [index, item] of quizBankItems.entries()) {
    const prompt = (item.prompt ?? {}) as Record<string, unknown>;
    addTransliterationOccurrence(
      occurrences,
      typeof prompt.thai === "string" ? prompt.thai : undefined,
      typeof prompt.translit === "string" ? prompt.translit : undefined,
      `quiz-item-bank.items[${index}].prompt`
    );
  }

  const quizQuestions = Array.isArray((quizJson as { questions?: unknown[] }).questions)
    ? ((quizJson as { questions: Array<Record<string, unknown>> }).questions ?? [])
    : [];
  for (const [index, question] of quizQuestions.entries()) {
    const prompt = (question.prompt ?? {}) as Record<string, unknown>;
    addTransliterationOccurrence(
      occurrences,
      typeof prompt.thai === "string" ? prompt.thai : undefined,
      typeof prompt.translit === "string" ? prompt.translit : undefined,
      `quiz.questions[${index}].prompt`
    );
  }

  const entries: TransliterationReviewEntry[] = [...occurrences.entries()]
    .map(([thai, items]) => ({
      thai,
      translits: [...new Set(items.map((item) => item.translit))].sort(),
      occurrences: items,
    }))
    .sort((left, right) => left.thai.localeCompare(right.thai));

  const inconsistentEntries = entries.filter((entry) => entry.translits.length > 1);
  const riskyVowelEntries = entries.filter((entry) => /[ึื]/u.test(entry.thai));

  return {
    lessonId,
    totalTrackedForms: entries.length,
    inconsistentEntries,
    riskyVowelEntries,
    entries,
  };
}

function runPipeline(args: string[]): void {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "course/tools/pipeline-cli.ts", ...args],
    {
      cwd: root,
      encoding: "utf8",
    }
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(
      `pipeline-cli failed for args "${args.join(" ")}" with code ${result.status ?? 1}`
    );
  }
}

function buildStage1Packet(lessonId: string, blueprintRow: BlueprintLessonRow) {
  const lessonDir = lessonPath(root, lessonId);
  const contextPath = resolveLessonFilePath(lessonId, "context.json");
  const promptPath = join(
    root,
    "course",
    "prompts",
    "agent-prompts",
    "stage-1-script-generation.prompt.md"
  );
  const schemaPath = join(root, "course", "schemas", "script-master.schema.json");
  const deckSchemaPath = join(root, "course", "schemas", "deck-source.schema.json");
  const transliterationPolicyPath = join(
    root,
    "course",
    "transliteration-policy.md"
  );
  const deckDesignSystemPath = join(
    root,
    "course",
    "Start with L001 and Review Uploaded Files",
    "design_system.py"
  );

  const reusableLessonIds = listReusableLessonIds(root);
  const exemplars = reusableLessonIds
    .filter((candidateLessonId) => candidateLessonId !== lessonId)
    .sort(compareLessonIds)
    .slice(0, MAX_EXEMPLARS)
    .map((exemplarLessonId) => ({
      lessonId: exemplarLessonId,
      briefPath: resolveLessonFilePath(exemplarLessonId, "brief.md"),
      briefMd: readRequired(resolveLessonFilePath(exemplarLessonId, "brief.md")),
      scriptPath: resolveLessonFilePath(exemplarLessonId, "script-master.json"),
      scriptMaster: readReusableLessonScript(root, exemplarLessonId) as ScriptMaster,
    }));
  const scopeResearchPath = join(lessonDir, "scope-research.md");
  const usageResearchPath = join(lessonDir, "usage-research.md");
  const visualResearchPath = join(lessonDir, "visual-research.md");

  return {
    schemaVersion: 1,
    lessonId,
    lessonDir,
    outputFiles: {
      brief: lessonFilePath(lessonId, "brief.md"),
      scriptMaster: lessonFilePath(lessonId, "script-master.json"),
      scriptSpoken: lessonFilePath(lessonId, "script-spoken.md"),
      scriptVisual: lessonFilePath(lessonId, "script-visual.md"),
    },
    blueprintRow,
    contextPath,
    context: readJson<LessonContext>(contextPath),
    promptPath,
    promptMd: readRequired(promptPath),
    scriptMasterSchemaPath: schemaPath,
    scriptMasterSchema: readJson<Record<string, unknown>>(
      join(root, "course", "schemas", "script-master.schema.json")
    ),
    deckSchemaPath,
    deckSchema: readJson<Record<string, unknown>>(deckSchemaPath),
    transliterationPolicyPath,
    transliterationPolicyMd: readRequired(transliterationPolicyPath),
    researchNotes: {
      scopePath: scopeResearchPath,
      scopeMd: readOptional(scopeResearchPath),
      usagePath: usageResearchPath,
      usageMd: readOptional(usageResearchPath),
      visualPath: visualResearchPath,
      visualMd: readOptional(visualResearchPath),
    },
    deckDesignSystemPath,
    deckDesignSystemPy: readRequired(deckDesignSystemPath),
    reusableLessonIds,
    exemplars,
  };
}

function buildStage1WorkOrder(
  lessonId: string,
  blueprintRow: BlueprintLessonRow
): string {
  const packetPath = stage1InputPath(lessonId);
  return [
    `# Codex Stage 1 Work Order — ${lessonId}`,
    "",
    `Target lesson directory: \`${lessonPath(root, lessonId)}\``,
    "",
    "Use the input packet and prompt below to author lesson content.",
    "",
    "## Required outputs",
    `- \`${lessonFilePath(lessonId, "brief.md")}\``,
    `- \`${lessonFilePath(lessonId, "script-master.json")}\``,
    `- \`${lessonFilePath(lessonId, "script-spoken.md")}\``,
    `- \`${lessonFilePath(lessonId, "script-visual.md")}\``,
    "",
    "## Required research notes",
    `- \`${join(lessonPath(root, lessonId), "scope-research.md")}\``,
    `- \`${join(lessonPath(root, lessonId), "usage-research.md")}\``,
    `- \`${join(lessonPath(root, lessonId), "visual-research.md")}\``,
    "- Review existing notes if present, or write them before or alongside the stage-1 files.",
    "",
    "## Constraints",
    "- Do not edit downstream deterministic artifacts.",
    "- Keep `languageFocus[].vocabId` as `v-0000000000` placeholders only.",
    "- The script must satisfy the schema and prompt requirements in the input packet.",
    "- Plan visuals for the left teaching area only; the right third stays reserved for Nine.",
    "- Make image choices explicit: useful real-world image, useful icon/diagram, or text-only by design.",
    "- Identify up to 3 high-risk concepts and give each a concise conceptual anchor only when it improves clarity or retention.",
    "",
    "## Curriculum target",
    `- Module: ${blueprintRow.moduleId} — ${blueprintRow.moduleTitle}`,
    `- Lesson: ${blueprintRow.lessonId} — ${blueprintRow.lessonTitle}`,
    `- CEFR: ${blueprintRow.cefrBand}`,
    `- Primary outcome: ${blueprintRow.lessonPrimaryOutcome}`,
    `- Secondary outcome: ${blueprintRow.lessonSecondaryOutcome}`,
    "",
    "## Quality target",
    "- Follow the blueprint row and prompt rigorously; do not imitate archived or legacy lessons.",
    "",
    "## Input packet",
    `- \`${packetPath}\``,
    "",
    "Write the four required files, then rerun the same `produce-lesson` command.",
    "",
  ].join("\n");
}

function buildRepairPacket(lessonId: string, blueprintRow: BlueprintLessonRow) {
  const lessonDir = lessonPath(root, lessonId);
  const promptPath = join(
    root,
    "course",
    "prompts",
    "agent-prompts",
    "stage-2-qa-repair.prompt.md"
  );

  return {
    schemaVersion: 1,
    lessonId,
    lessonDir,
    blueprintRow,
    promptPath,
    promptMd: readRequired(promptPath),
    qaReportPath: resolveLessonFilePath(lessonId, "qa-report.md"),
    qaReportMd: readRequired(resolveLessonFilePath(lessonId, "qa-report.md")),
    scriptMasterPath: resolveLessonFilePath(lessonId, "script-master.json"),
    scriptMaster: readJson<ScriptMaster>(resolveLessonFilePath(lessonId, "script-master.json")),
    scriptSpokenPath: resolveLessonFilePath(lessonId, "script-spoken.md"),
    scriptSpokenMd: readRequired(resolveLessonFilePath(lessonId, "script-spoken.md")),
    scriptVisualPath: resolveLessonFilePath(lessonId, "script-visual.md"),
    scriptVisualMd: readRequired(resolveLessonFilePath(lessonId, "script-visual.md")),
  };
}

function buildEditorialQaPacket(lessonId: string, blueprintRow: BlueprintLessonRow) {
  const lessonDir = lessonPath(root, lessonId);
  const promptPath = join(
    root,
    "course",
    "prompts",
    "agent-prompts",
    "stage-1-editorial-qa.prompt.md"
  );

  return {
    schemaVersion: 1,
    lessonId,
    lessonDir,
    blueprintRow,
    promptPath,
    promptMd: readRequired(promptPath),
    contextPath: resolveLessonFilePath(lessonId, "context.json"),
    contextJson: readJson<LessonContext>(resolveLessonFilePath(lessonId, "context.json")),
    scopeResearchPath: join(lessonDir, "scope-research.md"),
    scopeResearchMd: readOptional(join(lessonDir, "scope-research.md")),
    usageResearchPath: join(lessonDir, "usage-research.md"),
    usageResearchMd: readOptional(join(lessonDir, "usage-research.md")),
    briefPath: resolveLessonFilePath(lessonId, "brief.md"),
    briefMd: readRequired(resolveLessonFilePath(lessonId, "brief.md")),
    scriptMasterPath: resolveLessonFilePath(lessonId, "script-master.json"),
    scriptMaster: readJson<ScriptMaster>(resolveLessonFilePath(lessonId, "script-master.json")),
    scriptSpokenPath: resolveLessonFilePath(lessonId, "script-spoken.md"),
    scriptSpokenMd: readRequired(resolveLessonFilePath(lessonId, "script-spoken.md")),
    scriptVisualPath: resolveLessonFilePath(lessonId, "script-visual.md"),
    scriptVisualMd: readRequired(resolveLessonFilePath(lessonId, "script-visual.md")),
    outputReportPath: editorialQaReportPath(lessonId),
  };
}

function buildVisualQaPacket(lessonId: string, blueprintRow: BlueprintLessonRow) {
  const lessonDir = lessonPath(root, lessonId);
  const promptPath = join(
    root,
    "course",
    "prompts",
    "agent-prompts",
    "stage-3-visual-qa.prompt.md"
  );

  return {
    schemaVersion: 1,
    lessonId,
    lessonDir,
    blueprintRow,
    promptPath,
    promptMd: readRequired(promptPath),
    briefPath: resolveLessonFilePath(lessonId, "brief.md"),
    briefMd: readRequired(resolveLessonFilePath(lessonId, "brief.md")),
    scriptMasterPath: resolveLessonFilePath(lessonId, "script-master.json"),
    scriptMaster: readJson<ScriptMaster>(resolveLessonFilePath(lessonId, "script-master.json")),
    scriptSpokenPath: resolveLessonFilePath(lessonId, "script-spoken.md"),
    scriptSpokenMd: readRequired(resolveLessonFilePath(lessonId, "script-spoken.md")),
    scriptVisualPath: resolveLessonFilePath(lessonId, "script-visual.md"),
    scriptVisualMd: readRequired(resolveLessonFilePath(lessonId, "script-visual.md")),
    deckSourcePath: resolveLessonFilePath(lessonId, "deck-source.json"),
    deckSourceJson: readJson<Record<string, unknown>>(resolveLessonFilePath(lessonId, "deck-source.json")),
    deckPptxPath: resolveLessonFilePath(lessonId, "deck.pptx"),
    assetProvenancePath: resolveLessonFilePath(lessonId, "asset-provenance.json"),
    assetProvenanceJson: readJson<Record<string, unknown>>(
      resolveLessonFilePath(lessonId, "asset-provenance.json")
    ),
    canvaContentPath: resolveLessonFilePath(lessonId, "canva-content.json"),
    canvaContentJson: readJson<Record<string, unknown>>(resolveLessonFilePath(lessonId, "canva-content.json")),
    canvaDeckPath: resolveLessonFilePath(lessonId, "canva-deck.pptx"),
    canvaImportGuidePath: resolveLessonFilePath(lessonId, "canva-import-guide.md"),
    canvaImportGuideMd: readRequired(resolveLessonFilePath(lessonId, "canva-import-guide.md")),
    outputReportPath: visualQaReportPath(lessonId),
  };
}

function buildAssessmentQaPacket(lessonId: string, blueprintRow: BlueprintLessonRow) {
  const lessonDir = lessonPath(root, lessonId);
  const promptPath = join(
    root,
    "course",
    "prompts",
    "agent-prompts",
    "stage-6-assessment-qa.prompt.md"
  );
  const scriptMaster = readJson<ScriptMaster>(resolveLessonFilePath(lessonId, "script-master.json"));
  const flashcardsJson = readJson<Record<string, unknown>>(resolveLessonFilePath(lessonId, "flashcards.json"));
  const quizItemBankJson = readJson<Record<string, unknown>>(
    resolveLessonFilePath(lessonId, "quiz-item-bank.json")
  );
  const quizJson = readJson<Record<string, unknown>>(resolveLessonFilePath(lessonId, "quiz.json"));
  const vocabExportJson = readJson<Record<string, unknown>>(resolveLessonFilePath(lessonId, "vocab-export.json"));

  return {
    schemaVersion: 1,
    lessonId,
    lessonDir,
    blueprintRow,
    promptPath,
    promptMd: readRequired(promptPath),
    briefPath: resolveLessonFilePath(lessonId, "brief.md"),
    briefMd: readRequired(resolveLessonFilePath(lessonId, "brief.md")),
    scriptMasterPath: resolveLessonFilePath(lessonId, "script-master.json"),
    scriptMaster,
    scriptSpokenPath: resolveLessonFilePath(lessonId, "script-spoken.md"),
    scriptSpokenMd: readRequired(resolveLessonFilePath(lessonId, "script-spoken.md")),
    pdfPath: resolveLessonFilePath(lessonId, "pdf.md"),
    pdfMd: readRequired(resolveLessonFilePath(lessonId, "pdf.md")),
    flashcardsPath: resolveLessonFilePath(lessonId, "flashcards.json"),
    flashcardsJson,
    vocabExportPath: resolveLessonFilePath(lessonId, "vocab-export.json"),
    vocabExportJson,
    quizItemBankPath: resolveLessonFilePath(lessonId, "quiz-item-bank.json"),
    quizItemBankJson,
    quizPath: resolveLessonFilePath(lessonId, "quiz.json"),
    quizJson,
    transliterationReview: buildTransliterationReview(
      lessonId,
      scriptMaster,
      flashcardsJson,
      quizItemBankJson,
      quizJson,
      vocabExportJson
    ),
    outputReportPath: assessmentQaReportPath(lessonId),
  };
}

function buildRepairWorkOrder(
  lessonId: string,
  attemptNumber: number
): string {
  return [
    `# Codex Stage 2 Repair Work Order — ${lessonId}`,
    "",
    `QA attempt: ${attemptNumber}/${MAX_QA_ATTEMPTS}`,
    "",
    "Fix only the issues listed in the QA report.",
    "",
    "## Allowed edits",
    `- \`${lessonFilePath(lessonId, "script-master.json")}\``,
    `- \`${lessonFilePath(lessonId, "script-spoken.md")}\``,
    `- \`${lessonFilePath(lessonId, "script-visual.md")}\``,
    "",
    "## Do not touch",
    "- `context.json`",
    "- any stage 3-7 artifact",
    "- lesson identity, scope, or curriculum target",
    "",
    "## Input packet",
    `- \`${repairInputPath(lessonId)}\``,
    "",
    "After making fixes, rerun the same `produce-lesson` command.",
    "",
  ].join("\n");
}

function buildEditorialQaWorkOrder(lessonId: string): string {
  return [
    `# Codex Editorial QA Work Order — ${lessonId}`,
    "",
    "Review the authored lesson for pedagogical and dialogue-quality issues before deterministic QA.",
    "",
    "## Required output",
    `- \`${editorialQaReportPath(lessonId)}\``,
    "",
    "## Allowed edits",
    `- \`${lessonFilePath(lessonId, "script-master.json")}\``,
    `- \`${lessonFilePath(lessonId, "script-spoken.md")}\``,
    `- \`${lessonFilePath(lessonId, "script-visual.md")}\``,
    "",
    "## Review focus",
    "- roleplay realism and turn logic",
    "- question/answer coherence",
    "- phrase-use pragmatics (for example thank-you, apology, yes/no, no-problem used in sensible contexts)",
    "- explanation clarity for nuanced vocabulary and grammar function",
    "- conceptual anchors for high-risk concepts should be accurate, concise, and non-misleading",
    "- whether the lesson sounds like a real teaching session rather than a phrase checklist",
    "",
    "## Decision rule",
    "- Fix issues directly in the lesson files first when you can.",
    `- Write \`${lessonArtifactPath(root, lessonId, "editorial-qa-report.md")}\` with \`Result: PASS\` only if the lesson is coherent after your review.`,
    "- Use the report format from the prompt, including the conceptual-clarity check line.",
    "- Use `Result: FAIL` only if unresolved issues remain after your best repair pass.",
    "",
    "## Input packet",
    `- \`${editorialQaInputPath(lessonId)}\``,
    "",
    "After writing the report, rerun the same `produce-lesson` command.",
    "",
  ].join("\n");
}

function buildVisualQaWorkOrder(lessonId: string): string {
  return [
    `# Codex Visual QA Work Order — ${lessonId}`,
    "",
    "Review the visual teaching plan after deterministic stage 3.",
    "",
    "## Required output",
    `- \`${visualQaReportPath(lessonId)}\``,
    "",
    "## Allowed edits",
    `- \`${lessonFilePath(lessonId, "script-master.json")}\``,
    `- \`${lessonFilePath(lessonId, "script-visual.md")}\``,
    "",
    "## Review focus",
    "- left two-thirds teaching readability",
    "- right-third camera-safe compliance",
    "- overlay density and pacing",
    "- whether slide layout and asset choice support the spoken teaching",
    "- whether text-only/icon/image decisions make instructional sense",
    "- whether conceptual anchors stay spoken-first unless a simple visual reduces load",
    "",
    "## Decision rule",
    "- Fix script visual-plan issues directly in the allowed files when needed.",
    `- Write \`${lessonArtifactPath(root, lessonId, "visual-qa-report.md")}\` with \`Result: PASS\` only if the visual plan is recordable.`,
    "- Use `Result: FAIL` only if unresolved layout or teaching-visual issues remain.",
    "",
    "## Input packet",
    `- \`${visualQaInputPath(lessonId)}\``,
    "",
    "After writing the report, rerun the same `produce-lesson` command.",
    "",
  ].join("\n");
}

function buildAssessmentQaWorkOrder(lessonId: string): string {
  return [
    `# Codex Assessment QA Work Order — ${lessonId}`,
    "",
    "Review flashcards, quiz quality, and final transliteration correctness after deterministic stages 5 and 6.",
    "",
    "## Required output",
    `- \`${assessmentQaReportPath(lessonId)}\``,
    "",
    "## Allowed edits",
    "- None in v1. This review is read-only.",
    "",
    "## Review focus",
    "- flashcards should be study-worthy, not noisy extraction",
    "- quiz questions should match lesson goals",
    "- distractors should be plausible",
    "- prompts should be unambiguous",
    "- assessment should not be technically valid but pedagogically weak",
    "- transliteration should stay correct and consistent across script, PDF, flashcards, vocab export, and quiz artifacts",
    "- check high-risk vowel cases carefully, especially Thai forms containing อึ / อื",
    "",
    "## Decision rule",
    "- If the source lesson content is the problem, report it clearly instead of patching around it here.",
    `- Write \`${lessonArtifactPath(root, lessonId, "assessment-qa-report.md")}\` with \`Result: PASS\` only if the assessment pack and transliteration layer are good enough to release.`,
    "- Use `Result: FAIL` if the lesson still needs source fixes before assessment can be trusted.",
    "",
    "## Input packet",
    `- \`${assessmentQaInputPath(lessonId)}\``,
    "",
    "After writing the report, rerun the same `produce-lesson` command.",
    "",
  ].join("\n");
}

function printSummary(lessonId: string, state: ProduceLessonState): void {
  const artifacts = listProducedArtifacts(root, lessonId);
  console.log("");
  console.log(`Lesson: ${lessonId}`);
  console.log(`Workflow phase: ${state.phase}`);
  console.log(`QA attempts: ${state.qaAttempts}`);
  console.log(`Final state: ${readLessonStatus(root, lessonId).state}`);
  console.log("Artifacts:");
  for (const artifact of artifacts) {
    console.log(`- ${artifact}`);
  }
}

function resolveLesson(): BlueprintLessonRow {
  const explicitLesson = getArg("--lesson");
  const useNext = process.argv.includes("--next");
  const rows = readBlueprintLessonRows(root);

  if (!useNext && !explicitLesson) {
    throw new Error("Provide --lesson <ID> or --next.");
  }

  const resolvedLesson = resolveBlueprintLesson(rows, explicitLesson, (lessonId) =>
    readLessonStatus(root, lessonId),
  (lessonId) =>
    readExistingWorkflowState(lessonId)
  );
  if (!resolvedLesson) {
    if (explicitLesson) {
      throw new Error(`Lesson ${explicitLesson} not found in blueprint CSV.`);
    }
    throw new Error("No PLANNED lesson found in blueprint order.");
  }
  return resolvedLesson;
}

function ensureStage0(lessonId: string): void {
  runPipeline(["stage", "--lesson", lessonId, "--stage", "0"]);
}

function ensureFixedVocabIds(lessonId: string): void {
  runPipeline(["fixup-vocabids", "--lesson", lessonId]);
}

function ensureStage1WorkOrder(
  lessonId: string,
  blueprintRow: BlueprintLessonRow,
  state: ProduceLessonState
): ProduceLessonState {
  const packet = buildStage1Packet(lessonId, blueprintRow);
  writeJson(stage1InputPath(lessonId), packet);
  writeText(stage1WorkOrderPath(lessonId), buildStage1WorkOrder(lessonId, blueprintRow));

  if (!stage1FilesExist(root, lessonId)) {
    const nextState: ProduceLessonState = {
      ...state,
      phase: "awaiting_stage1",
      producedArtifacts: listProducedArtifacts(root, lessonId),
      finalState: readLessonStatus(root, lessonId).state,
      updatedAt: nowIso(),
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Stage 1 files are missing. Use ${stage1WorkOrderPath(
        lessonId
      )} and rerun this command after writing the required files.`
    );
    process.exit(0);
  }

  return state;
}

function stage1SourcePaths(lessonId: string): string[] {
  return ["brief.md", "script-master.json", "script-spoken.md", "script-visual.md"].map(
    (file) => resolveLessonFilePath(lessonId, file)
  );
}

function visualQaSourcePaths(lessonId: string): string[] {
  return ["script-master.json", "script-spoken.md", "script-visual.md"].map((file) =>
    resolveLessonFilePath(lessonId, file)
  );
}

function assessmentQaSourcePaths(lessonId: string): string[] {
  return ["script-master.json", "flashcards.json", "quiz-item-bank.json", "quiz.json"].map(
    (file) => resolveLessonFilePath(lessonId, file)
  );
}

function visualStage3OutputPaths(lessonId: string): string[] {
  return ["deck-source.json", "deck.pptx", "asset-provenance.json"].map((file) =>
    resolveLessonFilePath(lessonId, file)
  );
}

function sourcesNeedStage3Regeneration(lessonId: string): boolean {
  return (
    newestMtimeMs(visualQaSourcePaths(lessonId)) >
    newestMtimeMs(visualStage3OutputPaths(lessonId))
  );
}

function qaBackfillIsCurrent(lessonId: string): boolean {
  const editorialReport = editorialQaReportPath(lessonId);
  const visualReport = visualQaReportPath(lessonId);
  const assessmentReport = assessmentQaReportPath(lessonId);

  return (
    existsSync(editorialReport) &&
    reportHasPassResult(readRequired(editorialReport)) &&
    reportIsFreshAgainst(editorialReport, stage1SourcePaths(lessonId)) &&
    existsSync(visualReport) &&
    reportHasPassResult(readRequired(visualReport)) &&
    reportIsFreshAgainst(visualReport, visualQaSourcePaths(lessonId)) &&
    existsSync(assessmentReport) &&
    reportHasPassResult(readRequired(assessmentReport)) &&
    reportIsFreshAgainst(assessmentReport, assessmentQaSourcePaths(lessonId))
  );
}

function markLessonDraftForFailedQa(lessonId: string): void {
  if (readLessonStatus(root, lessonId).state !== "READY_TO_RECORD") {
    return;
  }

  runPipeline(["set-status", "--lesson", lessonId, "--state", "DRAFT"]);
}

function ensureEditorialQaReview(
  lessonId: string,
  blueprintRow: BlueprintLessonRow,
  state: ProduceLessonState
): ProduceLessonState {
  writeJson(editorialQaInputPath(lessonId), buildEditorialQaPacket(lessonId, blueprintRow));
  writeText(editorialQaWorkOrderPath(lessonId), buildEditorialQaWorkOrder(lessonId));

  const reportPath = editorialQaReportPath(lessonId);
  const nextBaseState: ProduceLessonState = {
    ...state,
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    updatedAt: nowIso(),
  };

  if (!existsSync(reportPath)) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_editorial_qa",
      failureReason: undefined,
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Editorial QA report is missing. Use ${editorialQaWorkOrderPath(
        lessonId
      )} and rerun this command after writing ${reportPath}.`
    );
    process.exit(0);
  }

  if (!reportIsFreshAgainst(reportPath, stage1SourcePaths(lessonId))) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_editorial_qa",
      failureReason: "Editorial QA report is stale after stage 1 edits",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Editorial QA report is stale. Re-run the review using ${editorialQaWorkOrderPath(
        lessonId
      )} and rerun this command.`
    );
    process.exit(0);
  }

  const reportMd = readRequired(reportPath);
  if (!reportHasPassResult(reportMd)) {
    markLessonDraftForFailedQa(lessonId);
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "editorial_qa_failed",
      failureReason: "Editorial QA report did not pass",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    throw new Error(
      `Editorial QA reported unresolved issues. Review ${reportPath}, update the lesson files, and rerun the same command.`
    );
  }

  const nextState: ProduceLessonState = {
    ...nextBaseState,
    phase: "editorial_qa_passed",
    failureReason: undefined,
  };
  writeWorkflowState(nextState);
  return nextState;
}

function ensureVisualQaReview(
  lessonId: string,
  blueprintRow: BlueprintLessonRow,
  state: ProduceLessonState
): ProduceLessonState {
  writeJson(visualQaInputPath(lessonId), buildVisualQaPacket(lessonId, blueprintRow));
  writeText(visualQaWorkOrderPath(lessonId), buildVisualQaWorkOrder(lessonId));

  const reportPath = visualQaReportPath(lessonId);
  const nextBaseState: ProduceLessonState = {
    ...state,
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    updatedAt: nowIso(),
  };

  if (!existsSync(reportPath)) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_visual_qa",
      failureReason: undefined,
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Visual QA report is missing. Use ${visualQaWorkOrderPath(
        lessonId
      )} and rerun this command after writing ${reportPath}.`
    );
    process.exit(0);
  }

  if (!reportIsFreshAgainst(reportPath, visualQaSourcePaths(lessonId))) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_visual_qa",
      failureReason: "Visual QA report is stale after lesson script edits",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Visual QA report is stale. Re-run the review using ${visualQaWorkOrderPath(
        lessonId
      )} and rerun this command.`
    );
    process.exit(0);
  }

  const reportMd = readRequired(reportPath);
  if (!reportHasPassResult(reportMd)) {
    markLessonDraftForFailedQa(lessonId);
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "visual_qa_failed",
      failureReason: "Visual QA report did not pass",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    throw new Error(
      `Visual QA reported unresolved issues. Review ${reportPath}, update the lesson files, and rerun the same command.`
    );
  }

  const nextState: ProduceLessonState = {
    ...nextBaseState,
    phase: "visual_qa_passed",
    failureReason: undefined,
  };
  writeWorkflowState(nextState);
  return nextState;
}

function ensureAssessmentQaReview(
  lessonId: string,
  blueprintRow: BlueprintLessonRow,
  state: ProduceLessonState
): ProduceLessonState {
  writeJson(
    assessmentQaInputPath(lessonId),
    buildAssessmentQaPacket(lessonId, blueprintRow)
  );
  writeText(
    assessmentQaWorkOrderPath(lessonId),
    buildAssessmentQaWorkOrder(lessonId)
  );

  const reportPath = assessmentQaReportPath(lessonId);
  const nextBaseState: ProduceLessonState = {
    ...state,
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    updatedAt: nowIso(),
  };

  if (!existsSync(reportPath)) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_assessment_qa",
      failureReason: undefined,
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Assessment QA report is missing. Use ${assessmentQaWorkOrderPath(
        lessonId
      )} and rerun this command after writing ${reportPath}.`
    );
    process.exit(0);
  }

  if (!reportIsFreshAgainst(reportPath, assessmentQaSourcePaths(lessonId))) {
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "awaiting_assessment_qa",
      failureReason: "Assessment QA report is stale after assessment or script edits",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    console.log("");
    console.log(
      `Assessment QA report is stale. Re-run the review using ${assessmentQaWorkOrderPath(
        lessonId
      )} and rerun this command.`
    );
    process.exit(0);
  }

  const reportMd = readRequired(reportPath);
  if (!reportHasPassResult(reportMd)) {
    markLessonDraftForFailedQa(lessonId);
    const nextState: ProduceLessonState = {
      ...nextBaseState,
      phase: "assessment_qa_failed",
      failureReason: "Assessment QA report did not pass",
    };
    writeWorkflowState(nextState);
    printSummary(lessonId, nextState);
    throw new Error(
      `Assessment QA reported unresolved issues. Review ${reportPath}, update the lesson files, and rerun the same command.`
    );
  }

  const nextState: ProduceLessonState = {
    ...nextBaseState,
    phase: "assessment_qa_passed",
    failureReason: undefined,
  };
  writeWorkflowState(nextState);
  return nextState;
}

function runQaAndMaybeStop(
  lessonId: string,
  blueprintRow: BlueprintLessonRow,
  state: ProduceLessonState
): ProduceLessonState {
  const qaResult = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "course/tools/pipeline-cli.ts",
      "stage",
      "--lesson",
      lessonId,
      "--stage",
      "2",
      "--strict",
    ],
    {
      cwd: root,
      encoding: "utf8",
    }
  );

  if (qaResult.stdout) {
    process.stdout.write(qaResult.stdout);
  }
  if (qaResult.stderr) {
    process.stderr.write(qaResult.stderr);
  }

  if (qaResult.status === 0) {
    const nextState: ProduceLessonState = {
      ...state,
      phase: "qa_passed",
      producedArtifacts: listProducedArtifacts(root, lessonId),
      finalState: readLessonStatus(root, lessonId).state,
      updatedAt: nowIso(),
    };
    writeWorkflowState(nextState);
    return nextState;
  }

  const qaAttempts = state.qaAttempts + 1;
  writeJson(repairInputPath(lessonId), buildRepairPacket(lessonId, blueprintRow));
  writeText(repairWorkOrderPath(lessonId), buildRepairWorkOrder(lessonId, qaAttempts));

  const nextState: ProduceLessonState = {
    ...state,
    qaAttempts,
    phase: "qa_failed",
    failureReason: `Stage 2 QA failed on attempt ${qaAttempts}`,
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    updatedAt: nowIso(),
  };
  writeWorkflowState(nextState);
  printSummary(lessonId, nextState);
  markLessonDraftForFailedQa(lessonId);

  if (qaAttempts >= MAX_QA_ATTEMPTS) {
    throw new Error(
      `Stage 2 QA failed ${qaAttempts} times. Review ${repairWorkOrderPath(
        lessonId
      )} before retrying manually.`
    );
  }

  throw new Error(
    `Stage 2 QA failed. Fix the lesson using ${repairWorkOrderPath(
      lessonId
    )} and rerun the same command.`
  );
}

function runStage3(lessonId: string): void {
  runPipeline(["stage", "--lesson", lessonId, "--stage", "3", "--strict"]);
}

function runStages4To6(lessonId: string): void {
  for (const stage of ["4", "5", "6"] as const) {
    runPipeline(["stage", "--lesson", lessonId, "--stage", stage, "--strict"]);
  }
}

function runStage7AndMarkReady(lessonId: string): void {
  runPipeline(["stage", "--lesson", lessonId, "--stage", "7", "--strict"]);
  runPipeline(["set-status", "--lesson", lessonId, "--state", "READY_TO_RECORD"]);
}

function hasStage4To6Artifacts(lessonId: string): boolean {
  return ["pdf-source.json", "pdf.md", "pdf.pdf", "flashcards.json", "vocab-export.json", "quiz-item-bank.json", "quiz.json"].every(
    (file) => existsSync(join(lessonPath(root, lessonId), file))
  );
}

async function main(): Promise<number> {
  const blueprintRow = resolveLesson();
  const lessonId = blueprintRow.lessonId;
  const currentStatus = readLessonStatus(root, lessonId);
  const existingWorkflowState = readWorkflowState(lessonId, blueprintRow);

  if (currentStatus.state === "READY_TO_RECORD" && qaBackfillIsCurrent(lessonId)) {
    const existingState = readWorkflowState(lessonId, blueprintRow);
    const completedState: ProduceLessonState = {
      ...existingState,
      phase: "completed",
      failureReason: undefined,
      producedArtifacts: listProducedArtifacts(root, lessonId),
      finalState: currentStatus.state,
      updatedAt: nowIso(),
    };
    writeWorkflowState(completedState);
    printSummary(lessonId, completedState);
    console.log("");
    console.log(`${lessonId} is already READY_TO_RECORD.`);
    return 0;
  }

  if (currentStatus.state === "READY_TO_RECORD") {
    console.log(
      `${lessonId} is READY_TO_RECORD but QA backfill is missing or stale. Refreshing QA workflow.`
    );
  }

  let state = existingWorkflowState;
  ensureStage0(lessonId);
  state = {
    ...state,
    phase: "selected",
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    updatedAt: nowIso(),
  };
  writeWorkflowState(state);

  state = ensureStage1WorkOrder(lessonId, blueprintRow, state);
  ensureFixedVocabIds(lessonId);
  state = ensureEditorialQaReview(lessonId, blueprintRow, state);
  state = runQaAndMaybeStop(lessonId, blueprintRow, state);
  runStage3(lessonId);
  state = ensureVisualQaReview(lessonId, blueprintRow, state);
  if (sourcesNeedStage3Regeneration(lessonId)) {
    runStage3(lessonId);
  }
  const resumeAtAssessmentGate =
    existingWorkflowState.phase === "awaiting_assessment_qa" &&
    hasStage4To6Artifacts(lessonId);

  if (!resumeAtAssessmentGate) {
    runStages4To6(lessonId);
  }
  state = ensureAssessmentQaReview(lessonId, blueprintRow, state);
  runStage7AndMarkReady(lessonId);

  const completedState: ProduceLessonState = {
    ...state,
    phase: "completed",
    producedArtifacts: listProducedArtifacts(root, lessonId),
    finalState: readLessonStatus(root, lessonId).state,
    failureReason: undefined,
    updatedAt: nowIso(),
  };
  writeWorkflowState(completedState);
  printSummary(lessonId, completedState);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
