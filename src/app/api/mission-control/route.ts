import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const COURSE_ROOT = path.join(ROOT, "course");

const REQUIRED_ARTIFACTS = [
  "brief.md",
  "script-spoken.md",
  "script-visual.md",
  "quiz.json",
  "pdf.pdf",
  "remotion.json",
  "flashcards.json",
  "qa-checklist.md",
  "status.json",
  "README.md",
] as const;

type Lesson = {
  lessonId: string;
  moduleId: string;
  lessonKey: string;
  state: string;
  updatedAt: string | null;
  artifacts: { name: string; exists: boolean }[];
};

type ModuleData = {
  moduleId: string;
  title: string;
  lessons: Lesson[];
};

function run(command: string) {
  try {
    return execSync(command, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

async function readText(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function parseManifestModuleTitles() {
  const manifest = await readText(path.join(COURSE_ROOT, "manifest.yaml"));
  const map = new Map<string, string>();

  let currentModule: string | null = null;
  for (const line of manifest.split("\n")) {
    const mod = line.match(/^\s*- id:\s*(M\d{2})\s*$/);
    if (mod) {
      currentModule = mod[1];
      continue;
    }

    if (currentModule) {
      const title = line.match(/^\s*title:\s*"?(.*?)"?\s*$/);
      if (title) {
        map.set(currentModule, title[1]);
        currentModule = null;
      }
    }
  }

  return map;
}

async function collectModules(): Promise<ModuleData[]> {
  const modulesDir = path.join(COURSE_ROOT, "modules");
  const moduleTitles = await parseManifestModuleTitles();

  let moduleEntries: fs.Dirent[] = [];
  try {
    moduleEntries = await fs.readdir(modulesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const modules: ModuleData[] = [];

  for (const entry of moduleEntries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const moduleId = entry.name;
    const modulePath = path.join(modulesDir, moduleId);
    const lessonEntries = (await fs.readdir(modulePath, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    const lessons: Lesson[] = [];

    for (const lessonDir of lessonEntries) {
      const lessonKey = lessonDir.name;
      const lessonId = `${moduleId}-${lessonKey}`;
      const basePath = path.join(modulePath, lessonKey);
      const statusPath = path.join(basePath, "status.json");

      let state = "UNKNOWN";
      let updatedAt: string | null = null;

      try {
        const status = JSON.parse(await fs.readFile(statusPath, "utf8")) as {
          state?: string;
          updatedAt?: string | null;
        };
        state = status.state ?? state;
        updatedAt = status.updatedAt ?? null;
      } catch {
        // keep defaults
      }

      const artifacts = await Promise.all(
        REQUIRED_ARTIFACTS.map(async (name) => ({
          name,
          exists: await exists(path.join(basePath, name)),
        }))
      );

      lessons.push({ lessonId, moduleId, lessonKey, state, updatedAt, artifacts });
    }

    modules.push({
      moduleId,
      title: moduleTitles.get(moduleId) ?? moduleId,
      lessons,
    });
  }

  return modules;
}

function buildTodos(modules: ModuleData[]) {
  const todos: { lessonId: string; priority: "high" | "medium"; task: string }[] = [];

  for (const moduleData of modules) {
    for (const lesson of moduleData.lessons) {
      const done = lesson.artifacts.filter((a) => a.exists).length;
      const total = lesson.artifacts.length;

      if (lesson.state !== "READY_TO_RECORD") {
        const missing = lesson.artifacts.filter((a) => !a.exists).map((a) => a.name);
        const task =
          missing.length > 0
            ? `Generate missing artifacts: ${missing.join(", ")}`
            : `Advance state from ${lesson.state} to READY_TO_RECORD`;

        const priority = lesson.moduleId === "M01" ? "high" : "medium";
        todos.push({ lessonId: lesson.lessonId, priority, task });

        if (done === total && lesson.state === "QA_PASS") {
          todos.push({
            lessonId: lesson.lessonId,
            priority,
            task: "Run release manager validation and mark READY_TO_RECORD",
          });
        }
      }
    }
  }

  return todos.slice(0, 30);
}

function buildAgentBoard(modules: ModuleData[]) {
  const allLessons = modules.flatMap((m) => m.lessons);

  const byState = (states: string[]) =>
    allLessons
      .filter((l) => states.includes(l.state))
      .slice(0, 12)
      .map((l) => l.lessonId);

  return {
    courseArchitect: byState(["BACKLOG", "PLANNED"]),
    lessonScripter: byState(["DRAFT", "IN_PROGRESS"]),
    linguisticQa: byState(["QA_FAIL", "QA_PENDING", "QA_REVIEW"]),
    releaseManager: byState(["QA_PASS"]),
    readyToRecord: byState(["READY_TO_RECORD"]),
  };
}

export async function GET() {
  const [missionControl, runlog, modules] = await Promise.all([
    readText(path.join(COURSE_ROOT, "mission-control.md")),
    readText(path.join(COURSE_ROOT, "runlogs", "latest.md")),
    collectModules(),
  ]);

  const allLessons = modules.flatMap((m) => m.lessons);
  const totals = {
    modules: modules.length,
    lessons: allLessons.length,
    ready: allLessons.filter((l) => l.state === "READY_TO_RECORD").length,
    planned: allLessons.filter((l) => l.state === "PLANNED" || l.state === "BACKLOG").length,
    inProgress: allLessons.filter((l) => !["READY_TO_RECORD", "BACKLOG", "PLANNED"].includes(l.state)).length,
  };

  const status = run("git status --short --branch");
  const branch = run("git branch --show-current");
  const commits = run("git log --oneline --decorate -n 12");

  const renderCandidates = [
    { label: "Episode 001 Preview", relPath: "episode001.mp4" },
    { label: "Episode 002 Preview", relPath: "episode002.mp4" },
    { label: "Legacy Preview", relPath: "video.mp4" },
  ];

  const renders = await Promise.all(
    renderCandidates.map(async (r) => ({
      ...r,
      exists: await exists(path.join(ROOT, "thaiwith-nine-remotion", "out", r.relPath)),
      url: `/api/mission-control/media?path=${encodeURIComponent(r.relPath)}`,
    }))
  );

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    branch,
    status,
    commits,
    missionControl,
    runlog,
    totals,
    modules,
    todos: buildTodos(modules),
    agentBoard: buildAgentBoard(modules),
    requiredArtifacts: REQUIRED_ARTIFACTS,
    renders,
  });
}
