import { join } from "node:path";
import { readJson, resolveLessonArtifactPath, writeJson } from "./lib/fs.ts";
import { readBlueprintLessonRows, findBlueprintRow } from "./lib/produce-lesson.ts";
import type { RemotionPlan } from "./lib/types.ts";

type ExportedLessonScene = {
  id: string;
  startFrame: number;
  durationInFrames: number;
  title: string;
  guidance: string | null;
  objective: string;
  overlays: string[];
  voiceover: string[];
  thaiFocus: Array<{ thai: string; translit: string; english: string }>;
  layout: string;
  visualStrategy: {
    onScreenGoal: string;
    teachingVisuals: string[];
    teacherCues: string[];
    imageUsage: "real-image" | "icon" | "text-only";
    rationale: string;
  } | null;
};

type ExportedLessonVideo = {
  schemaVersion: 1;
  compositionId: "GeneratedLessonPlan";
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  episodeTitle: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  safeZoneLabel: string;
  scenes: ExportedLessonScene[];
};

function parseArgs(argv: string[]): { lessonId: string | null } {
  let lessonId: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--lesson") {
      lessonId = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return { lessonId };
}

function exportLesson(root: string, lessonId: string): ExportedLessonVideo {
  const blueprintRows = readBlueprintLessonRows(root);
  const row = findBlueprintRow(blueprintRows, lessonId);
  if (!row) {
    throw new Error(`Lesson ${lessonId} was not found in full-thai-course-blueprint.csv`);
  }

  const remotionPath = resolveLessonArtifactPath(root, lessonId, "remotion.json");
  const remotion = readJson<RemotionPlan>(remotionPath);
  const fps = 30;
  const width = remotion.canvas?.width ?? 1920;
  const height = remotion.canvas?.height ?? 1080;
  let currentFrame = 0;

  const scenes: ExportedLessonScene[] = remotion.scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.seconds * fps));
    const [title, guidance, ...overlayItems] = scene.overlays;
    const exportedScene: ExportedLessonScene = {
      id: scene.id,
      startFrame: currentFrame,
      durationInFrames,
      title: title ?? scene.id,
      guidance: guidance ?? null,
      objective: scene.teachingObjective ?? "",
      overlays: overlayItems,
      voiceover: scene.voiceover,
      thaiFocus: scene.thaiFocus,
      layout: scene.layout ?? "focus-card",
      visualStrategy: scene.visualStrategy ?? null,
    };
    currentFrame += durationInFrames;
    return exportedScene;
  });

  return {
    schemaVersion: 1,
    compositionId: "GeneratedLessonPlan",
    lessonId,
    lessonTitle: row.lessonTitle,
    moduleTitle: row.moduleTitle,
    episodeTitle: `${lessonId} · ${row.lessonTitle}`,
    fps,
    width,
    height,
    durationInFrames: currentFrame,
    safeZoneLabel:
      remotion.canvas?.safeZoneLabel ?? "Right third reserved for Nine camera",
    scenes,
  };
}

function main() {
  const root = process.cwd();
  const { lessonId } = parseArgs(process.argv.slice(2));
  if (!lessonId) {
    throw new Error("Usage: node --experimental-strip-types course/tools/export-remotion-lesson.ts --lesson M01-L001");
  }

  const exported = exportLesson(root, lessonId);
  const outputPath = join(
    root,
    "thaiwith-nine-remotion",
    "src",
    "data",
    "lesson-generated.json"
  );
  writeJson(outputPath, exported);
  console.log(`Exported ${lessonId} to ${outputPath}`);
}

main();
