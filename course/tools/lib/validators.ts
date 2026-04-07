import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listLessonDirs, readJson, resolveLessonDirArtifactPath } from "./fs.ts";
import { compareLessonIds } from "./lesson-ids.ts";
import { validateSchemaTargets } from "./schema-runner.ts";
import {
  checkTransliterationPolicy,
  extractTripletTranslitSegments,
  scanTextForTransliterationDrift,
} from "./transliteration-policy.ts";
import type {
  AssetProvenance,
  CanvaContent,
  DeckSource,
  FlashcardsDeck,
  LessonStatus,
  QuizItem,
  QuizItemBank,
  QuizSet,

  ScriptMaster,
  ValidationIssue,
  VocabExport,
  VocabIndex,
  PdfSource,
  LessonContext,
} from "./types.ts";

const REQUIRED_READY_FILES = [
  "context.json",
  "script-master.json",
  "script-spoken.md",
  "script-visual.md",
  "qa-report.md",
  "deck-source.json",
  "deck.pptx",
  "asset-provenance.json",
  "pdf-source.json",
  "pdf.md",
  "pdf.pdf",
  "flashcards.json",
  "vocab-export.json",
  "quiz-item-bank.json",
  "quiz.json",
  "status.json",
];

const TRIPLET_LINE = /^[^|]+\|\s*[^|]+\|\s*[^|]+$/;

function parseJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

function deriveRootFromLessonDir(lessonDir: string): string {
  const marker = `${join("course", "modules")}`;
  const idx = lessonDir.indexOf(marker);
  if (idx === -1) return process.cwd();
  return lessonDir.slice(0, idx - 1);
}

function lessonIdFromLessonDir(lessonDir: string): string {
  const moduleId = basename(join(lessonDir, ".."));
  const lessonFolder = basename(lessonDir);
  return `${moduleId}-${lessonFolder}`;
}

function lessonArtifactPathForDir(lessonDir: string, baseName: string): string {
  return resolveLessonDirArtifactPath(
    lessonDir,
    lessonIdFromLessonDir(lessonDir),
    baseName
  );
}


function pushPolicyIssues(text: string, label: string, issues: ValidationIssue[], requireToneMark = false): void {
  const check = checkTransliterationPolicy(text, requireToneMark);
  for (const issue of check.issues) {
    issues.push({ path: label, message: issue.message });
  }
}

function enforceTriplet(thing: { thai?: string; translit?: string; english?: string }, label: string, issues: ValidationIssue[]): void {
  if (isBlank(thing.thai) || isBlank(thing.translit) || isBlank(thing.english)) {
    issues.push({ path: label, message: "missing Thai/translit/English triplet field" });
    return;
  }
  // Mid-tone words in PTM have no diacritical mark by convention, so don't require tone marks on individual languageFocus items
  pushPolicyIssues(thing.translit ?? "", label, issues, false);
}

function checkScriptMaster(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<ScriptMaster>(path);
  const isLegacyLesson = compareLessonIds(data.lessonId, "M01-L004") < 0;

  if (!Array.isArray(data.sections) || data.sections.length < 3) {
    issues.push({ path, message: "script-master sections must contain >=3 entries" });
    return issues;
  }

  if (!isLegacyLesson) {
    if (!data.teachingFrame) {
      issues.push({ path, message: "non-legacy lessons require teachingFrame" });
    } else {
      if (isBlank(data.teachingFrame.openingHook) || isBlank(data.teachingFrame.scenario) || isBlank(data.teachingFrame.learnerTakeaway)) {
        issues.push({ path, message: "teachingFrame must include openingHook, scenario, and learnerTakeaway" });
      }
    }

    // pronunciationFocus required from M01-L002 onwards
    if (compareLessonIds(data.lessonId, "M01-L001") > 0 && !data.pronunciationFocus) {
      issues.push({ path, message: "pronunciationFocus required for lessons after M01-L001" });
    }
  }

  for (const section of data.sections) {
    for (const [idx, lex] of section.languageFocus.entries()) {
      enforceTriplet(lex, `${path}#sections.${section.id}.languageFocus[${idx}]`, issues);
      if (isBlank(lex.vocabId)) {
        issues.push({ path, message: `languageFocus item missing vocabId in section ${section.id}` });
      }
    }

    for (const [idx, bullet] of section.onScreenBullets.entries()) {
      if (!TRIPLET_LINE.test(bullet)) {
        issues.push({ path, message: `onScreenBullets[${idx}] in ${section.id} must be Thai | translit | English` });
      }
      const parts = bullet.split("|").map((x) => x.trim());
      if (parts[1]) pushPolicyIssues(parts[1], `${path}#sections.${section.id}.onScreenBullets[${idx}]`, issues, false);
    }

    if (!isLegacyLesson) {
      const visualPlan = section.visualPlan;
      if (!visualPlan) {
        issues.push({ path, message: `section ${section.id} requires visualPlan` });
      } else {
        if (isBlank(visualPlan.onScreenGoal)) {
          issues.push({ path, message: `section ${section.id} visualPlan missing onScreenGoal` });
        }
        if (visualPlan.teachingVisuals.length < 2) {
          issues.push({ path, message: `section ${section.id} visualPlan needs >=2 teaching visuals` });
        }
        if (visualPlan.teacherCues.length < 1) {
          issues.push({ path, message: `section ${section.id} visualPlan needs >=1 teacher cue` });
        }
        if (isBlank(visualPlan.imageSupport.rationale)) {
          issues.push({ path, message: `section ${section.id} visualPlan imageSupport missing rationale` });
        }
        if (visualPlan.imageSupport.sourceHints.length < 1) {
          issues.push({ path, message: `section ${section.id} visualPlan imageSupport needs sourceHints` });
        }
        if (visualPlan.imageSupport.helpful && visualPlan.imageSupport.searchQueries.length < 1) {
          issues.push({ path, message: `section ${section.id} visualPlan marks imageSupport helpful but provides no searchQueries` });
        }
      }
    }
  }

  for (const [idx, line] of data.roleplay.lines.entries()) {
    enforceTriplet(line, `${path}#roleplay.lines[${idx}]`, issues);
  }

  return issues;
}

function checkContext(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<LessonContext>(path);

  for (const [idx, lex] of data.knownVocabulary.entries()) {
    enforceTriplet(lex, `${path}#knownVocabulary[${idx}]`, issues);
  }

  for (const [bucketIdx, bucket] of data.reviewBuckets.entries()) {
    for (const [sampleIdx, sample] of bucket.sample.entries()) {
      enforceTriplet(sample, `${path}#reviewBuckets[${bucketIdx}].sample[${sampleIdx}]`, issues);
    }
  }

  return issues;
}


function checkDeckSource(path: string, lessonDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<DeckSource>(path);
  const isLegacyLesson = compareLessonIds(data.lessonId, "M01-L004") < 0;

  if (data.slides.length < 6) {
    issues.push({ path, message: "deck-source must contain at least 6 slides" });
  }

  if (!isLegacyLesson) {
    if (
      Math.abs(data.canvas.leftTeachingFraction - 0.6667) > 0.02 ||
      Math.abs(data.canvas.rightCameraFraction - 0.3333) > 0.02
    ) {
      issues.push({
        path,
        message:
          "deck-source canvas must reserve roughly the right third for recording and left two-thirds for teaching",
      });
    }
  }

  for (const [slideIdx, slide] of data.slides.entries()) {
    if (slide.speakerNotes.length < 1) {
      issues.push({ path, message: `slide[${slideIdx}] requires speakerNotes` });
    }
    if (slide.textBlocks.length < 1) {
      issues.push({ path, message: `slide[${slideIdx}] requires textBlocks` });
    }
    if (slide.role === "teaching" && slide.thaiFocus.length < 1) {
      issues.push({ path, message: `teaching slide[${slideIdx}] requires thaiFocus` });
    }

    for (const asset of slide.assets) {
      if (asset.status === "resolved") {
        if (isBlank(asset.sourceUrl) || isBlank(asset.license) || isBlank(asset.localPath)) {
          issues.push({
            path,
            message: `slide[${slideIdx}] asset ${asset.assetId} must include sourceUrl, license, and localPath when resolved`,
          });
        } else if (!existsSync(join(lessonDir, asset.localPath ?? ""))) {
          issues.push({
            path: join(lessonDir, asset.localPath ?? ""),
            message: `resolved slide asset missing for ${asset.assetId}`,
          });
        }
      }

      if (asset.status === "fallback-text-only" && isBlank(asset.fallbackReason)) {
        issues.push({
          path,
          message: `slide[${slideIdx}] asset ${asset.assetId} must record fallbackReason when image resolution fails`,
        });
      }
    }
  }

  return issues;
}

function checkCanvaContent(path: string, lessonDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<CanvaContent>(path);

  if (!Array.isArray(data.slides) || data.slides.length < 1) {
    issues.push({ path, message: "canva-content must contain at least one slide" });
    return issues;
  }

  for (const [slideIdx, slide] of data.slides.entries()) {
    if (!existsSync(join(lessonDir, slide.backgroundPath))) {
      issues.push({
        path: join(lessonDir, slide.backgroundPath),
        message: `missing Canva background for slide[${slideIdx}]`,
      });
    }

    if (!Array.isArray(slide.elements) || slide.elements.length < 1) {
      issues.push({ path, message: `canva slide[${slideIdx}] requires at least one editable element` });
      continue;
    }

    for (const [elementIdx, element] of slide.elements.entries()) {
      if (element.kind === "text" && isBlank(element.value ?? "")) {
        issues.push({
          path,
          message: `canva slide[${slideIdx}] text element[${elementIdx}] is blank`,
        });
      }

      if (element.kind === "image" && element.localPath) {
        const imagePath = join(lessonDir, element.localPath);
        if (!existsSync(imagePath)) {
          issues.push({
            path: imagePath,
            message: `canva slide[${slideIdx}] image element[${elementIdx}] points to a missing file`,
          });
        }
      }
    }
  }

  return issues;
}

function checkMarkdownTriplets(raw: string, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const segment of extractTripletTranslitSegments(raw)) {
    pushPolicyIssues(segment.translit, `${path}#line-${segment.line}`, issues, false);
  }
  return issues;
}

function checkMarkdownForbiddenSymbols(raw: string, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const drifts = scanTextForTransliterationDrift(raw);
  for (const drift of drifts) {
    issues.push({ path: `${path}#line-${drift.line}`, message: drift.message });
  }
  return issues;
}

function checkSpokenScript(path: string): ValidationIssue[] {
  const raw = readFileSync(path, "utf8");
  return [...checkMarkdownTriplets(raw, path), ...checkMarkdownForbiddenSymbols(raw, path)];
}

function checkVisualScript(path: string): ValidationIssue[] {
  const raw = readFileSync(path, "utf8");
  return [...checkMarkdownTriplets(raw, path), ...checkMarkdownForbiddenSymbols(raw, path)];
}

function checkPdf(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const raw = readFileSync(path, "utf8");
  if (!raw.includes("# ")) issues.push({ path, message: "pdf.md must include top title" });
  if (!raw.includes("Answer Key")) issues.push({ path, message: "pdf.md must include answer key" });

  const tripletMatches = raw.match(/\|/g)?.length ?? 0;
  if (tripletMatches < 6) {
    issues.push({ path, message: "pdf.md appears to be missing sufficient triplet lines" });
  }

  issues.push(...checkMarkdownTriplets(raw, path));
  issues.push(...checkMarkdownForbiddenSymbols(raw, path));

  return issues;
}

function checkPdfSource(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<PdfSource>(path);

  for (const [sectionIdx, section] of data.sections.entries()) {
    for (const [lineIdx, line] of section.body.entries()) {
      if (!line.includes("|")) continue;
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 3) {
        issues.push({ path: `${path}#sections[${sectionIdx}].body[${lineIdx}]`, message: "triplet line must include Thai | translit | English" });
        continue;
      }
      pushPolicyIssues(parts[1] ?? "", `${path}#sections[${sectionIdx}].body[${lineIdx}]`, issues);
    }
  }

  return issues;
}

function checkFlashcards(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<FlashcardsDeck>(path);
  for (const [idx, card] of data.cards.entries()) {
    if (isBlank(card.vocabId)) issues.push({ path, message: `flashcard[${idx}] missing vocabId` });
    pushPolicyIssues(card.translit, `${path}#cards[${idx}].translit`, issues);
  }
  return issues;
}

function checkQuizItemDisplayMode(item: QuizItem, itemLabel: string, issues: ValidationIssue[]): void {
  const prompt =
    typeof item.prompt === "object" && item.prompt !== null
      ? (item.prompt as { text?: string; thai?: string; translit?: string; english?: string })
      : null;

  if (!prompt) {
    issues.push({ path: itemLabel, message: "quiz item prompt must be an object" });
    return;
  }

  if (item.displayMode === "triplet") {
    if (isBlank(prompt.thai) || isBlank(prompt.translit) || isBlank(prompt.english)) {
      issues.push({ path: itemLabel, message: "displayMode=triplet requires thai/translit/english in prompt" });
      return;
    }
    pushPolicyIssues(prompt.translit ?? "", `${itemLabel}.prompt.translit`, issues);
    return;
  }

  // quiz displayMode exceptions: non-triplet prompts are allowed to omit translit/english/thai.
  if (prompt.translit) {
    pushPolicyIssues(prompt.translit, `${itemLabel}.prompt.translit`, issues);
  }
}

function checkQuizBank(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<QuizItemBank>(path);

  if (!Array.isArray(data.items)) {
    issues.push({ path, message: "quiz item bank must contain an items array" });
    return issues;
  }

  for (const [idx, item] of data.items.entries()) {
    checkQuizItemDisplayMode(item, `${path}#items[${idx}]`, issues);
  }

  if (!data.coverage || typeof data.coverage !== "object" || !("pass" in data.coverage)) {
    issues.push({ path, message: "quiz item bank coverage object is missing" });
  } else if (!data.coverage.pass) {
    issues.push({ path, message: "quiz item bank coverage check reports FAIL" });
  }

  return issues;
}

function checkQuiz(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<QuizSet>(path);

  if (!Array.isArray(data.questions)) {
    issues.push({ path, message: "quiz must contain a questions array" });
    return issues;
  }

  for (const [idx, item] of data.questions.entries()) {
    checkQuizItemDisplayMode(item, `${path}#questions[${idx}]`, issues);
  }

  if (!data.coverage || typeof data.coverage !== "object" || !("pass" in data.coverage)) {
    issues.push({ path, message: "quiz coverage object is missing" });
  } else if (!data.coverage.pass) {
    issues.push({ path, message: "end-of-lesson quiz coverage check reports FAIL" });
  }

  return issues;
}

function checkAssetProvenance(path: string, deckSourcePath: string, lessonDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<AssetProvenance>(path);
  if (!existsSync(deckSourcePath)) {
    issues.push({ path, message: "asset-provenance requires deck-source.json to cross-check assets" });
    return issues;
  }

  const deckSource = parseJsonFile<DeckSource>(deckSourcePath);
  const provenanceById = new Map(data.assets.map((a) => [a.assetId, a]));
  const deckAssetIds = new Set<string>();

  for (const slide of deckSource.slides) {
    for (const asset of slide.assets) {
      deckAssetIds.add(asset.assetId);
      const prov = provenanceById.get(asset.assetId);
      if (!prov) {
        issues.push({ path, message: `missing provenance entry for assetId ${asset.assetId}` });
        continue;
      }

      if ((prov.status ?? "resolved") !== asset.status) {
        issues.push({ path, message: `provenance status mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.slideId ?? "") !== slide.id) {
        issues.push({ path, message: `provenance slideId mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.sourceProvider ?? "none") !== asset.sourceProvider) {
        issues.push({ path, message: `provenance sourceProvider mismatch for assetId ${asset.assetId}` });
      }

      if ((prov.sourceUrl ?? "") !== (asset.sourceUrl ?? "")) {
        issues.push({ path, message: `provenance sourceUrl mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.license ?? "") !== (asset.license ?? "")) {
        issues.push({ path, message: `provenance license mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.query ?? "") !== asset.query) {
        issues.push({ path, message: `provenance query mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.localPath ?? "") !== (asset.localPath ?? "")) {
        issues.push({ path, message: `provenance localPath mismatch for assetId ${asset.assetId}` });
      }
      if ((prov.fallbackReason ?? "") !== (asset.fallbackReason ?? "")) {
        issues.push({
          path,
          message: `provenance fallbackReason mismatch for assetId ${asset.assetId}`,
        });
      }

      if (asset.status === "resolved" && isBlank(prov.license)) {
        issues.push({ path, message: `provenance license missing for assetId ${asset.assetId}` });
      }
      if (asset.status === "resolved" && isBlank(prov.sourceUrl)) {
        issues.push({ path, message: `provenance sourceUrl missing for assetId ${asset.assetId}` });
      }
      if (asset.status === "resolved" && isBlank(prov.localPath)) {
        issues.push({ path, message: `provenance localPath missing for assetId ${asset.assetId}` });
      }
      if (asset.status === "resolved" && !existsSync(join(lessonDir, prov.localPath ?? ""))) {
        issues.push({
          path: join(lessonDir, prov.localPath ?? ""),
          message: `provenance local asset missing for ${asset.assetId}`,
        });
      }
    }
  }

  for (const assetId of provenanceById.keys()) {
    if (!deckAssetIds.has(assetId)) {
      issues.push({ path, message: `provenance entry ${assetId} does not exist in deck-source.json` });
    }
  }

  return issues;
}

function checkStatus(path: string): ValidationIssue[] {
  const status = readJson<LessonStatus>(path);
  const issues: ValidationIssue[] = [];
  if (status.state === "READY_TO_RECORD" && !status.validatedAt) {
    issues.push({ path, message: "READY_TO_RECORD requires validatedAt" });
  }

  if (status.stageResults?.["2"] === "FAIL") {
    const downstream = ["3", "4", "5", "6", "7"] as const;
    for (const stage of downstream) {
      if (status.stageResults[stage] === "PASS") {
        issues.push({ path, message: `QA fail-stop violated: stage ${stage} passed after stage 2 failed` });
      }
    }
  }

  return issues;
}

function checkCoverageCrossFiles(lessonDir: string): ValidationIssue[] {
  const scriptPath = lessonArtifactPathForDir(lessonDir, "script-master.json");
  const bankPath = lessonArtifactPathForDir(lessonDir, "quiz-item-bank.json");
  const quizPath = lessonArtifactPathForDir(lessonDir, "quiz.json");
  if (!existsSync(scriptPath) || !existsSync(bankPath) || !existsSync(quizPath)) return [];

  const script = parseJsonFile<ScriptMaster>(scriptPath);
  const bank = parseJsonFile<QuizItemBank>(bankPath);
  const quiz = parseJsonFile<QuizSet>(quizPath);
  const issues: ValidationIssue[] = [];

  const known = new Set((script.context.knownVocabulary ?? []).map((v) => v.vocabId).filter(Boolean));
  const currentLex = script.sections.flatMap((s) => s.languageFocus);
  const newLex = currentLex.filter((l) => l.vocabId && !known.has(l.vocabId));

  for (const lex of newLex) {
    const vocabId = lex.vocabId ?? "";
    const bankCount = bank.items.filter((i) => i.vocabId === vocabId).length;
    const quizCount = quiz.questions.filter((i) => i.vocabId === vocabId).length;
    if (bankCount < 3) {
      issues.push({ path: bankPath, message: `new vocab ${lex.thai} (${vocabId}) appears ${bankCount}x in item bank; need >=3` });
    }
    if (quizCount < 1) {
      issues.push({ path: quizPath, message: `new vocab ${lex.thai} (${vocabId}) appears ${quizCount}x in quiz; need >=1` });
    }
  }

  return issues;
}

function checkVocabExport(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<VocabExport>(path);
  for (const [idx, card] of data.cards.entries()) {
    pushPolicyIssues(card.translit, `${path}#cards[${idx}].translit`, issues);
  }
  return issues;
}

function checkVocabIndex(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<VocabIndex>(path);
  const seen = new Set<string>();
  for (const entry of data.entries) {
    if (seen.has(entry.id)) issues.push({ path, message: `duplicate vocab id ${entry.id}` });
    seen.add(entry.id);
    pushPolicyIssues(entry.translit, `${path}#${entry.id}.translit`, issues);
  }
  return issues;
}


function lessonSchemaTargets(lessonDir: string): Array<{ path: string; schemaFile: string; required?: boolean }> {
  return [
    { path: lessonArtifactPathForDir(lessonDir, "context.json"), schemaFile: "context.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "script-master.json"), schemaFile: "script-master.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "deck-source.json"), schemaFile: "deck-source.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "asset-provenance.json"), schemaFile: "asset-provenance.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "canva-content.json"), schemaFile: "canva-content.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "pdf-source.json"), schemaFile: "pdf-source.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "flashcards.json"), schemaFile: "flashcards.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "vocab-export.json"), schemaFile: "vocab-export.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "quiz-item-bank.json"), schemaFile: "quiz-item-bank.schema.json", required: false },
    { path: lessonArtifactPathForDir(lessonDir, "quiz.json"), schemaFile: "quiz.schema.json", required: false },
  ];
}

function globalSchemaTargets(): Array<{ path: string; schemaFile: string; required?: boolean }> {
  return [
    { path: join("course", "vocab", "vocab-index.json"), schemaFile: "vocab-index.schema.json", required: false },
    { path: join("course", "exports", "flashcards-global.json"), schemaFile: "vocab-export.schema.json", required: false },
  ];
}

export function validateLessonDir(lessonDir: string, rootInput?: string): ValidationIssue[] {
  const root = rootInput ?? deriveRootFromLessonDir(lessonDir);
  const issues: ValidationIssue[] = [];
  const statusPath = lessonArtifactPathForDir(lessonDir, "status.json");

  if (!existsSync(statusPath)) {
    issues.push({ path: lessonDir, message: "Missing status.json" });
    return issues;
  }

  const status = readJson<LessonStatus>(statusPath);

  if (status.state === "READY_TO_RECORD") {
    for (const file of REQUIRED_READY_FILES) {
      const filePath = lessonArtifactPathForDir(lessonDir, file);
      if (!existsSync(filePath)) {
        issues.push({ path: filePath, message: "Required file missing for READY_TO_RECORD" });
      }
    }
  }

  const lessonFolder = basename(lessonDir);
  if (!/^L\d{3}$/.test(lessonFolder)) {
    issues.push({ path: lessonDir, message: "Lesson folder must follow L### format" });
  }

  issues.push(...validateSchemaTargets(root, lessonSchemaTargets(lessonDir)));

  const context = lessonArtifactPathForDir(lessonDir, "context.json");
  if (existsSync(context)) issues.push(...checkContext(context));

  const scriptMaster = lessonArtifactPathForDir(lessonDir, "script-master.json");
  if (existsSync(scriptMaster)) issues.push(...checkScriptMaster(scriptMaster));

  const spoken = lessonArtifactPathForDir(lessonDir, "script-spoken.md");
  if (existsSync(spoken)) issues.push(...checkSpokenScript(spoken));

  const visual = lessonArtifactPathForDir(lessonDir, "script-visual.md");
  if (existsSync(visual)) issues.push(...checkVisualScript(visual));

  const deckSource = lessonArtifactPathForDir(lessonDir, "deck-source.json");
  if (existsSync(deckSource)) issues.push(...checkDeckSource(deckSource, lessonDir));

  const provenance = lessonArtifactPathForDir(lessonDir, "asset-provenance.json");
  if (existsSync(provenance)) {
    issues.push(...checkAssetProvenance(provenance, deckSource, lessonDir));
  }

  const canvaContent = lessonArtifactPathForDir(lessonDir, "canva-content.json");
  if (existsSync(canvaContent)) issues.push(...checkCanvaContent(canvaContent, lessonDir));

  const pdfSource = lessonArtifactPathForDir(lessonDir, "pdf-source.json");
  if (existsSync(pdfSource)) issues.push(...checkPdfSource(pdfSource));

  const pdf = lessonArtifactPathForDir(lessonDir, "pdf.md");
  if (existsSync(pdf)) issues.push(...checkPdf(pdf));

  const flashcards = lessonArtifactPathForDir(lessonDir, "flashcards.json");
  if (existsSync(flashcards)) issues.push(...checkFlashcards(flashcards));

  const vocabExport = lessonArtifactPathForDir(lessonDir, "vocab-export.json");
  if (existsSync(vocabExport)) issues.push(...checkVocabExport(vocabExport));

  const quizBank = lessonArtifactPathForDir(lessonDir, "quiz-item-bank.json");
  if (existsSync(quizBank)) issues.push(...checkQuizBank(quizBank));

  const quiz = lessonArtifactPathForDir(lessonDir, "quiz.json");
  if (existsSync(quiz)) issues.push(...checkQuiz(quiz));

  if (existsSync(statusPath)) issues.push(...checkStatus(statusPath));

  issues.push(...checkCoverageCrossFiles(lessonDir));

  return issues;
}

export function validateLessonSchemas(lessonDir: string, rootInput?: string): ValidationIssue[] {
  const root = rootInput ?? deriveRootFromLessonDir(lessonDir);
  return validateSchemaTargets(root, lessonSchemaTargets(lessonDir));
}

export function validateAllSchemas(root: string): ValidationIssue[] {
  const dirs = listLessonDirs(root);
  const lessonIssues = dirs.flatMap((dir) => validateLessonSchemas(dir, root));
  const globalIssues = validateSchemaTargets(root, globalSchemaTargets());
  return [...lessonIssues, ...globalIssues];
}

export function validateAll(root: string): ValidationIssue[] {
  const dirs = listLessonDirs(root);
  const lessonIssues = dirs.flatMap((dir) => validateLessonDir(dir, root));
  const globalIssues = validateSchemaTargets(root, globalSchemaTargets());

  const vocabIndexPath = join(root, "course", "vocab", "vocab-index.json");
  if (existsSync(vocabIndexPath)) {
    globalIssues.push(...checkVocabIndex(vocabIndexPath));
  }

  return [...lessonIssues, ...globalIssues];
}
