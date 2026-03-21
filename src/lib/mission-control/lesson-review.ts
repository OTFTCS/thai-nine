import { promises as fs } from "node:fs";
import path from "node:path";
import {
  lessonArtifactCandidateNames,
  lessonArtifactFileName,
} from "@/lib/course-artifacts";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";
import type { Lesson } from "@/types/lesson";

const ROOT = process.cwd();
const COURSE_ROOT = path.join(ROOT, "course");
const MODULES_ROOT = path.join(COURSE_ROOT, "modules");

export const MISSION_CONTROL_ARTIFACTS = [
  "brief.md",
  "script-master.json",
  "script-spoken.md",
  "script-spoken.html",
  "script-visual.md",
  "editorial-qa-report.md",
  "qa-report.md",
  "status.json",
  "deck-source.json",
  "deck.pptx",
  "asset-provenance.json",
  "pdf.pdf",
  "pdf.md",
  "flashcards.json",
  "quiz.json",
  "visual-qa-report.md",
  "assessment-qa-report.md",
] as const;

export type MissionControlArtifactName = (typeof MISSION_CONTROL_ARTIFACTS)[number];

export type MissionControlLessonArtifact = {
  name: MissionControlArtifactName;
  fileName: string;
  exists: boolean;
  relPath: string;
  viewHref: string;
  mediaHref: string;
  isJson: boolean;
  isMarkdown: boolean;
  isPdf: boolean;
  isPptx: boolean;
};

type LessonStatus = {
  lessonId: string;
  state?: string;
  updatedAt?: string | null;
  validatedAt?: string | null;
  stageResults?: Record<string, string>;
  notes?: string[];
};

type ScriptMaster = {
  objective?: string;
  teachingFrame?: {
    targetRuntimeMin?: number;
    targetRuntimeMax?: number;
    openingHook?: string;
    scenario?: string;
    learnerTakeaway?: string;
  };
  sections?: Array<{
    id?: string;
    heading?: string;
    purpose?: string;
    drills?: string[];
    languageFocus?: Array<{ thai?: string; translit?: string; english?: string }>;
  }>;
  recap?: string[];
};

type DeckSource = {
  slides?: Array<{
    id?: string;
    estimatedSeconds?: number;
    layout?: string;
    title?: string;
    assets?: Array<{ assetId?: string; kind?: string; query?: string; sourceUrl?: string }>;
    visualStrategy?: {
      imageUsage?: string;
      onScreenGoal?: string;
    };
  }>;
};

type FlashcardsDeck = {
  cards?: Array<{
    id?: string;
    front?: string;
    back?: string;
    translit?: string;
    tags?: string[];
  }>;
};

type QuizSet = {
  passScore?: number;
  questions?: Array<{
    id?: string;
    prompt?: {
      text?: string;
      thai?: string;
      translit?: string;
      english?: string;
    };
    type?: string;
    displayMode?: string;
  }>;
};

export type MissionControlLessonReview = {
  lesson: {
    id: string;
    key: string;
    moduleId: string;
    moduleTitle: string;
    trackId: string;
    trackTitle: string;
    cefrBand: string;
    title: string;
    primaryOutcome: string;
    secondaryOutcome: string;
    quizFocus: string;
    flashcardTags: string[];
    notes: string;
    lessonDir: string;
  };
  status: {
    state: string;
    updatedAt: string | null;
    validatedAt: string | null;
    stageResults: Record<string, string>;
    notes: string[];
    raw: LessonStatus | null;
  };
  artifacts: MissionControlLessonArtifact[];
  content: {
    briefMd: string | null;
    scriptSpokenMd: string | null;
    scriptVisualMd: string | null;
    editorialQaReportMd: string | null;
    qaReportMd: string | null;
    visualQaReportMd: string | null;
    assessmentQaReportMd: string | null;
    statusJson: LessonStatus | null;
    deckSourceJson: DeckSource | null;
    quizJson: QuizSet | null;
    flashcardsJson: FlashcardsDeck | null;
    scriptMasterJson: ScriptMaster | null;
  };
  previews: {
    deckUrl: string | null;
    deckExists: boolean;
    deckLabel: string | null;
    pdfUrl: string | null;
    pdfExists: boolean;
  };
  checks: {
    qaPass: boolean | null;
    editorialQaPass: boolean | null;
    visualQaPass: boolean | null;
    assessmentQaPass: boolean | null;
    coreArtifactsPresent: number;
    totalArtifacts: number;
    missingArtifacts: string[];
    schemaReadyArtifacts: number;
    slideCount: number;
    quizQuestionCount: number;
    flashcardCount: number;
  };
};

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLessonArtifactPath(
  lessonDir: string,
  lessonId: string,
  baseName: string
) {
  for (const candidate of lessonArtifactCandidateNames(lessonId, baseName)) {
    const candidatePath = path.join(lessonDir, candidate);
    if (await exists(candidatePath)) {
      return candidatePath;
    }
  }

  return path.join(lessonDir, lessonArtifactFileName(lessonId, baseName));
}

async function readTextIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function lessonParts(lessonId: string) {
  const match = /^(M\d{2})-(L\d{3})$/.exec(lessonId);
  if (!match) {
    return null;
  }

  return { moduleId: match[1], lessonKey: match[2] };
}

function courseRelPath(moduleId: string, lessonKey: string, fileName: string) {
  return `modules/${moduleId}/${lessonKey}/${fileName}`;
}

function viewHref(relPath: string) {
  return `/mission-control/view?path=${encodeURIComponent(relPath)}`;
}

function mediaHref(relPath: string) {
  return `/api/mission-control/media?path=${encodeURIComponent(relPath)}`;
}

export async function loadMissionControlLessonReview(
  lessonId: string
): Promise<MissionControlLessonReview | null> {
  const parts = lessonParts(lessonId);
  if (!parts) {
    return null;
  }

  const curriculum = await getBlueprintCurriculum();
  const blueprintLesson = curriculum.lessonById[lessonId] as Lesson | undefined;
  if (!blueprintLesson) {
    return null;
  }

  const lessonDir = path.join(MODULES_ROOT, parts.moduleId, parts.lessonKey);
  if (!(await exists(lessonDir))) {
    return null;
  }

  const artifacts = await Promise.all(
    MISSION_CONTROL_ARTIFACTS.map(async (name) => {
      const resolvedPath = await resolveLessonArtifactPath(lessonDir, lessonId, name);
      const fileName = path.basename(resolvedPath);
      const relPath = courseRelPath(parts.moduleId, parts.lessonKey, fileName);
      const fileExists = await exists(resolvedPath);
      return {
        name,
        fileName,
        exists: fileExists,
        relPath,
        viewHref: viewHref(relPath),
        mediaHref: mediaHref(relPath),
        isJson: name.endsWith(".json"),
        isMarkdown: name.endsWith(".md"),
        isPdf: name.endsWith(".pdf"),
        isPptx: name.endsWith(".pptx"),
      } satisfies MissionControlLessonArtifact;
    })
  );

  const [
    briefMd,
    scriptSpokenMd,
    scriptVisualMd,
    editorialQaReportMd,
    qaReportMd,
    visualQaReportMd,
    assessmentQaReportMd,
    statusJson,
    deckSourceJson,
    quizJson,
    flashcardsJson,
    scriptMasterJson,
  ] = await Promise.all([
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "brief.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "script-spoken.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "script-visual.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "editorial-qa-report.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "qa-report.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "visual-qa-report.md")),
    readTextIfExists(await resolveLessonArtifactPath(lessonDir, lessonId, "assessment-qa-report.md")),
    readJsonIfExists<LessonStatus>(path.join(lessonDir, "status.json")),
    readJsonIfExists<DeckSource>(await resolveLessonArtifactPath(lessonDir, lessonId, "deck-source.json")),
    readJsonIfExists<QuizSet>(await resolveLessonArtifactPath(lessonDir, lessonId, "quiz.json")),
    readJsonIfExists<FlashcardsDeck>(await resolveLessonArtifactPath(lessonDir, lessonId, "flashcards.json")),
    readJsonIfExists<ScriptMaster>(await resolveLessonArtifactPath(lessonDir, lessonId, "script-master.json")),
  ]);

  const deckArtifact = artifacts.find((artifact) => artifact.name === "deck.pptx");
  const pdfArtifact = artifacts.find((artifact) => artifact.name === "pdf.pdf");
  const qaPass = qaReportMd
    ? /Result:\s+PASS/.test(qaReportMd)
    : statusJson?.stageResults?.["2"] === "PASS"
    ? true
    : statusJson?.stageResults?.["2"] === "FAIL"
    ? false
    : null;
  const editorialQaPass = editorialQaReportMd
    ? /Result:\s+PASS/.test(editorialQaReportMd)
    : null;
  const visualQaPass = visualQaReportMd
    ? /Result:\s+PASS/.test(visualQaReportMd)
    : null;
  const assessmentQaPass = assessmentQaReportMd
    ? /Result:\s+PASS/.test(assessmentQaReportMd)
    : null;

  const missingArtifacts = artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.name);
  const coreArtifactsPresent = artifacts.filter((artifact) => artifact.exists).length;
  const totalArtifacts = artifacts.length;
  const schemaReadyArtifacts = artifacts.filter(
    (artifact) =>
      artifact.exists &&
      ["brief.md", "script-master.json", "script-spoken.md", "script-visual.md", "qa-report.md", "status.json"].includes(artifact.name)
  ).length;

  return {
    lesson: {
      id: lessonId,
      key: parts.lessonKey,
      moduleId: blueprintLesson.moduleId,
      moduleTitle: blueprintLesson.moduleTitle,
      trackId: blueprintLesson.trackId,
      trackTitle: blueprintLesson.trackTitle,
      cefrBand: blueprintLesson.cefrBand,
      title: blueprintLesson.title,
      primaryOutcome: blueprintLesson.primaryOutcome,
      secondaryOutcome: blueprintLesson.secondaryOutcome,
      quizFocus: blueprintLesson.quizFocus,
      flashcardTags: blueprintLesson.flashcardTags,
      notes: blueprintLesson.notes,
      lessonDir,
    },
    status: {
      state: statusJson?.state ?? "UNKNOWN",
      updatedAt: statusJson?.updatedAt ?? null,
      validatedAt: statusJson?.validatedAt ?? null,
      stageResults: statusJson?.stageResults ?? {},
      notes: statusJson?.notes ?? [],
      raw: statusJson,
    },
    artifacts,
    content: {
      briefMd,
      scriptSpokenMd,
      scriptVisualMd,
      editorialQaReportMd,
      qaReportMd,
      visualQaReportMd,
      assessmentQaReportMd,
      statusJson,
      deckSourceJson,
      quizJson,
      flashcardsJson,
      scriptMasterJson,
    },
    previews: {
      deckUrl: deckArtifact?.exists ? deckArtifact.mediaHref : null,
      deckExists: deckArtifact?.exists ?? false,
      deckLabel: deckArtifact?.exists ? deckArtifact.fileName : null,
      pdfUrl: pdfArtifact?.exists ? pdfArtifact.mediaHref : null,
      pdfExists: pdfArtifact?.exists ?? false,
    },
    checks: {
      qaPass,
      editorialQaPass,
      visualQaPass,
      assessmentQaPass,
      coreArtifactsPresent,
      totalArtifacts,
      missingArtifacts,
      schemaReadyArtifacts,
      slideCount: deckSourceJson?.slides?.length ?? 0,
      quizQuestionCount: quizJson?.questions?.length ?? 0,
      flashcardCount: flashcardsJson?.cards?.length ?? 0,
    },
  };
}
