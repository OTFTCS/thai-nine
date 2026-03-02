import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { listLessonDirs, readJson } from "./fs.ts";
import { validateSchemaTargets } from "./schema-runner.ts";
import {
  checkTransliterationPolicy,
  extractTripletTranslitSegments,
  scanTextForTransliterationDrift,
} from "./transliteration-policy.ts";
import type {
  AssetProvenance,
  FlashcardsDeck,
  LessonStatus,
  QuizItem,
  QuizItemBank,
  QuizSet,
  RemotionPlan,
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
  "remotion.json",
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

export function remotionEpisodePathForLesson(root: string, lessonId: string): string {
  const lessonNum = Number((lessonId.split("-")[1] ?? "L000").replace(/^L/, ""));
  const episodeNum = String(Math.max(lessonNum, 0)).padStart(3, "0");
  return join(root, "thaiwith-nine-remotion", "src", "data", `episode-${episodeNum}.json`);
}

function pushPolicyIssues(text: string, label: string, issues: ValidationIssue[], requireToneMark = true): void {
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
  pushPolicyIssues(thing.translit ?? "", label, issues);
}

function checkScriptMaster(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<ScriptMaster>(path);

  if (!Array.isArray(data.sections) || data.sections.length < 3) {
    issues.push({ path, message: "script-master sections must contain >=3 entries" });
    return issues;
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
      if (parts[1]) pushPolicyIssues(parts[1], `${path}#sections.${section.id}.onScreenBullets[${idx}]`, issues);
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

function checkRemotion(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<RemotionPlan>(path);

  if (data.scenes.some((s) => s.assets.some((a) => a.sourcePolicy !== "internet-first"))) {
    issues.push({ path, message: "remotion assets must use internet-first policy" });
  }

  for (const [sceneIdx, scene] of data.scenes.entries()) {
    for (const [idx, tf] of scene.thaiFocus.entries()) {
      enforceTriplet(tf, `${path}#scenes[${sceneIdx}].thaiFocus[${idx}]`, issues);
    }

    for (const [assetIdx, asset] of scene.assets.entries()) {
      if (!asset.sourceUrl.startsWith("https://")) {
        issues.push({ path, message: `scene[${sceneIdx}] asset[${assetIdx}] sourceUrl must be https://` });
      }
      if (isBlank(asset.license)) {
        issues.push({ path, message: `scene[${sceneIdx}] asset[${assetIdx}] missing license` });
      }
    }
  }

  return issues;
}

function checkMarkdownTriplets(raw: string, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const segment of extractTripletTranslitSegments(raw)) {
    pushPolicyIssues(segment.translit, `${path}#line-${segment.line}`, issues);
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

function checkAssetProvenance(path: string, remotionPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = parseJsonFile<AssetProvenance>(path);

  if (!existsSync(remotionPath)) {
    issues.push({ path, message: "asset-provenance requires remotion.json to cross-check assets" });
    return issues;
  }

  const remotion = parseJsonFile<RemotionPlan>(remotionPath);
  const provenanceById = new Map(data.assets.map((a) => [a.assetId, a]));

  for (const scene of remotion.scenes) {
    for (const asset of scene.assets) {
      const prov = provenanceById.get(asset.assetId);
      if (!prov) {
        issues.push({ path, message: `missing provenance entry for assetId ${asset.assetId}` });
        continue;
      }
      if (prov.sourceUrl !== asset.sourceUrl) {
        issues.push({ path, message: `provenance sourceUrl mismatch for assetId ${asset.assetId}` });
      }
      if (isBlank(prov.license)) {
        issues.push({ path, message: `provenance license missing for assetId ${asset.assetId}` });
      }
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
  const scriptPath = join(lessonDir, "script-master.json");
  const bankPath = join(lessonDir, "quiz-item-bank.json");
  const quizPath = join(lessonDir, "quiz.json");
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

export function validateRemotionDataFile(path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!existsSync(path)) return issues;

  let data: unknown;
  try {
    data = parseJsonFile<unknown>(path);
  } catch {
    issues.push({ path, message: "remotion episode data is not valid JSON" });
    return issues;
  }

  if (!Array.isArray(data)) {
    issues.push({ path, message: "remotion episode data must be an array" });
    return issues;
  }

  for (const [idx, scene] of data.entries()) {
    if (!scene || typeof scene !== "object") continue;
    const obj = scene as Record<string, unknown>;
    const phonetics = typeof obj.phonetics === "string" ? obj.phonetics : null;
    if (phonetics) {
      pushPolicyIssues(phonetics, `${path}#scene[${idx}].phonetics`, issues);
      continue;
    }

    if (obj.type === "term") {
      issues.push({ path: `${path}#scene[${idx}]`, message: "term scene is missing phonetics transliteration" });
    }
  }

  const raw = readFileSync(path, "utf8");
  issues.push(...checkMarkdownForbiddenSymbols(raw, path));

  return issues;
}

export function validateRemotionDataForLesson(root: string, lessonId: string): ValidationIssue[] {
  const episodePath = remotionEpisodePathForLesson(root, lessonId);
  if (!existsSync(episodePath)) return [];
  return validateRemotionDataFile(episodePath);
}

export function validateAllRemotionData(root: string): ValidationIssue[] {
  const dataDir = join(root, "thaiwith-nine-remotion", "src", "data");
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) return [];

  const issues: ValidationIssue[] = [];
  const files = readdirSync(dataDir)
    .filter((file) => /^episode-\d{3}\.json$/.test(file))
    .sort();
  for (const file of files) {
    issues.push(...validateRemotionDataFile(join(dataDir, file)));
  }

  return issues;
}

function lessonSchemaTargets(lessonDir: string): Array<{ path: string; schemaFile: string; required?: boolean }> {
  return [
    { path: join(lessonDir, "context.json"), schemaFile: "context.schema.json", required: false },
    { path: join(lessonDir, "script-master.json"), schemaFile: "script-master.schema.json", required: false },
    { path: join(lessonDir, "remotion.json"), schemaFile: "remotion.schema.json", required: false },
    { path: join(lessonDir, "asset-provenance.json"), schemaFile: "asset-provenance.schema.json", required: false },
    { path: join(lessonDir, "pdf-source.json"), schemaFile: "pdf-source.schema.json", required: false },
    { path: join(lessonDir, "flashcards.json"), schemaFile: "flashcards.schema.json", required: false },
    { path: join(lessonDir, "vocab-export.json"), schemaFile: "vocab-export.schema.json", required: false },
    { path: join(lessonDir, "quiz-item-bank.json"), schemaFile: "quiz-item-bank.schema.json", required: false },
    { path: join(lessonDir, "quiz.json"), schemaFile: "quiz.schema.json", required: false },
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
  const statusPath = join(lessonDir, "status.json");

  if (!existsSync(statusPath)) {
    issues.push({ path: lessonDir, message: "Missing status.json" });
    return issues;
  }

  const status = readJson<LessonStatus>(statusPath);

  if (status.state === "READY_TO_RECORD") {
    for (const file of REQUIRED_READY_FILES) {
      const filePath = join(lessonDir, file);
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

  const context = join(lessonDir, "context.json");
  if (existsSync(context)) issues.push(...checkContext(context));

  const scriptMaster = join(lessonDir, "script-master.json");
  if (existsSync(scriptMaster)) issues.push(...checkScriptMaster(scriptMaster));

  const spoken = join(lessonDir, "script-spoken.md");
  if (existsSync(spoken)) issues.push(...checkSpokenScript(spoken));

  const visual = join(lessonDir, "script-visual.md");
  if (existsSync(visual)) issues.push(...checkVisualScript(visual));

  const remotion = join(lessonDir, "remotion.json");
  if (existsSync(remotion)) issues.push(...checkRemotion(remotion));

  const provenance = join(lessonDir, "asset-provenance.json");
  if (existsSync(provenance)) issues.push(...checkAssetProvenance(provenance, remotion));

  const pdfSource = join(lessonDir, "pdf-source.json");
  if (existsSync(pdfSource)) issues.push(...checkPdfSource(pdfSource));

  const pdf = join(lessonDir, "pdf.md");
  if (existsSync(pdf)) issues.push(...checkPdf(pdf));

  const flashcards = join(lessonDir, "flashcards.json");
  if (existsSync(flashcards)) issues.push(...checkFlashcards(flashcards));

  const vocabExport = join(lessonDir, "vocab-export.json");
  if (existsSync(vocabExport)) issues.push(...checkVocabExport(vocabExport));

  const quizBank = join(lessonDir, "quiz-item-bank.json");
  if (existsSync(quizBank)) issues.push(...checkQuizBank(quizBank));

  const quiz = join(lessonDir, "quiz.json");
  if (existsSync(quiz)) issues.push(...checkQuiz(quiz));

  if (existsSync(statusPath)) issues.push(...checkStatus(statusPath));

  issues.push(...checkCoverageCrossFiles(lessonDir));

  const lessonId = lessonIdFromLessonDir(lessonDir);
  issues.push(...validateRemotionDataForLesson(root, lessonId));

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

  globalIssues.push(...validateAllRemotionData(root));

  return [...lessonIssues, ...globalIssues];
}
