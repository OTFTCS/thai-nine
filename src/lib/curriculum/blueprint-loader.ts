import { promises as fs } from "node:fs";
import path from "node:path";
import type { PlacementBand } from "@/types/assessment";
import type { CurriculumBlueprint, CurriculumModule, CurriculumTrack, Lesson } from "@/types/lesson";
import type { ModuleRecommendation, PlacementRecommendationMap } from "@/lib/quiz/lesson-recommendations";

const BLUEPRINT_PATH = path.join(
  process.cwd(),
  "course",
  "exports",
  "full-thai-course-blueprint.csv"
);

const BAND_TO_MODULE_ID: Record<PlacementBand, string> = {
  "A1.0": "M01", // A0: First Contact and Courtesy
  "A1.1": "M02", // A0: Sounds
  "A1.2": "M03", // A1: Building Simple Sentences
  "A2.0": "M07", // A2: Reading Fluency and Pronunciation Control
  "A2.1": "M08", // A2: Food
  "B1-ish": "M11", // B1: Friends
};

type BlueprintRow = {
  trackId: string;
  trackTitle: string;
  cefrBand: string;
  moduleId: string;
  moduleTitle: string;
  moduleExitOutcome: string;
  lessonId: string;
  lessonTitle: string;
  lessonPrimaryOutcome: string;
  lessonSecondaryOutcome: string;
  lessonQuizFocus: string;
  moduleQuizLink: string;
  flashcardTags: string[];
  notes: string;
};

type CurriculumCache = {
  curriculum: CurriculumBlueprint;
  recommendations: PlacementRecommendationMap;
};

let cache: CurriculumCache | null = null;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function splitLines(csvText: string) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function parseCsvRows(csvText: string): BlueprintRow[] {
  const lines = splitLines(csvText);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const required = [
    "track_id",
    "track_title",
    "cefr_band",
    "module_id",
    "module_title",
    "module_exit_outcome",
    "lesson_id",
    "lesson_title",
    "lesson_primary_outcome",
    "lesson_secondary_outcome",
    "lesson_quiz_focus",
    "module_quiz_link",
    "flashcard_tags",
    "notes",
  ] as const;

  for (const field of required) {
    if (!headerIndex.has(field)) {
      throw new Error(`Blueprint CSV is missing required field: ${field}`);
    }
  }

  const rows: BlueprintRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const get = (field: (typeof required)[number]) =>
      (cells[headerIndex.get(field) ?? -1] ?? "").trim();

    rows.push({
      trackId: get("track_id"),
      trackTitle: get("track_title"),
      cefrBand: get("cefr_band"),
      moduleId: get("module_id"),
      moduleTitle: get("module_title"),
      moduleExitOutcome: get("module_exit_outcome"),
      lessonId: get("lesson_id"),
      lessonTitle: get("lesson_title"),
      lessonPrimaryOutcome: get("lesson_primary_outcome"),
      lessonSecondaryOutcome: get("lesson_secondary_outcome"),
      lessonQuizFocus: get("lesson_quiz_focus"),
      moduleQuizLink: get("module_quiz_link"),
      flashcardTags: get("flashcard_tags")
        .split(";")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: get("notes"),
    });
  }

  return rows;
}

function buildCurriculum(rows: BlueprintRow[]): CurriculumBlueprint {
  const tracksById = new Map<string, CurriculumTrack>();
  const modulesById = new Map<string, CurriculumModule>();
  const lessons: Lesson[] = [];
  const lessonById: Record<string, Lesson> = {};
  const moduleById: Record<string, CurriculumModule> = {};

  for (const row of rows) {
    const existingTrack = tracksById.get(row.trackId);
    if (!existingTrack) {
      tracksById.set(row.trackId, {
        id: row.trackId,
        title: row.trackTitle,
        cefrBand: row.cefrBand,
        order: tracksById.size + 1,
        modules: [],
      });
    }

    let module = modulesById.get(row.moduleId);
    if (!module) {
      module = {
        id: row.moduleId,
        title: row.moduleTitle,
        trackId: row.trackId,
        trackTitle: row.trackTitle,
        cefrBand: row.cefrBand,
        exitOutcome: row.moduleExitOutcome,
        order: modulesById.size + 1,
        lessons: [],
      };
      modulesById.set(row.moduleId, module);
      tracksById.get(row.trackId)?.modules.push(module);
    }

    if (lessonById[row.lessonId]) {
      throw new Error(`Duplicate lesson id in blueprint CSV: ${row.lessonId}`);
    }

    const lesson: Lesson = {
      id: row.lessonId,
      title: row.lessonTitle,
      moduleId: row.moduleId,
      moduleTitle: row.moduleTitle,
      moduleExitOutcome: row.moduleExitOutcome,
      moduleQuizLink: row.moduleQuizLink,
      trackId: row.trackId,
      trackTitle: row.trackTitle,
      cefrBand: row.cefrBand,
      primaryOutcome: row.lessonPrimaryOutcome,
      secondaryOutcome: row.lessonSecondaryOutcome,
      quizFocus: row.lessonQuizFocus,
      flashcardTags: row.flashcardTags,
      notes: row.notes,
      availabilityState: "coming_soon",
      sortOrder: lessons.length + 1,
      moduleOrder: module.order,
      lessonOrder: module.lessons.length + 1,
    };

    module.lessons.push(lesson);
    lessons.push(lesson);
    lessonById[lesson.id] = lesson;
  }

  for (const module of modulesById.values()) {
    moduleById[module.id] = module;
  }

  return {
    tracks: [...tracksById.values()],
    modules: [...modulesById.values()],
    lessons,
    lessonById,
    moduleById,
  };
}

function toModuleRecommendation(module: CurriculumModule): ModuleRecommendation {
  const lessonLinks = module.lessons.slice(0, 3).map((lesson) => ({
    title: `${lesson.id}: ${lesson.title}`,
    href: `/lessons/${lesson.id}`,
  }));

  return {
    moduleId: module.id,
    moduleTitle: module.title,
    lessonLinks,
  };
}

function buildPlacementRecommendations(
  curriculum: CurriculumBlueprint
): PlacementRecommendationMap {
  const fallbackModule = curriculum.modules[0];

  if (!fallbackModule) {
    throw new Error("Blueprint curriculum has no modules.");
  }

  const map = {} as PlacementRecommendationMap;
  for (const band of Object.keys(BAND_TO_MODULE_ID) as PlacementBand[]) {
    const preferredModule = curriculum.moduleById[BAND_TO_MODULE_ID[band]];
    map[band] = toModuleRecommendation(preferredModule ?? fallbackModule);
  }

  return map;
}

async function loadCache(): Promise<CurriculumCache> {
  if (cache) {
    return cache;
  }

  const csvText = await fs.readFile(BLUEPRINT_PATH, "utf8");
  const rows = parseCsvRows(csvText);
  const curriculum = buildCurriculum(rows);
  const recommendations = buildPlacementRecommendations(curriculum);
  cache = { curriculum, recommendations };
  return cache;
}

export async function getBlueprintCurriculum(): Promise<CurriculumBlueprint> {
  const loaded = await loadCache();
  return loaded.curriculum;
}

export async function getBlueprintLessons(): Promise<Lesson[]> {
  const curriculum = await getBlueprintCurriculum();
  return curriculum.lessons;
}

export async function getBlueprintLessonById(lessonId: string): Promise<Lesson | null> {
  const curriculum = await getBlueprintCurriculum();
  return curriculum.lessonById[lessonId] ?? null;
}

export async function getBlueprintPlacementRecommendations(): Promise<PlacementRecommendationMap> {
  const loaded = await loadCache();
  return loaded.recommendations;
}
