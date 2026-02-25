#!/usr/bin/env node
import { appendFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeJson, lessonPath } from "./lib/fs.ts";
import { validateAll, validateLessonDir } from "./lib/validators.ts";
import type { LessonStatus } from "./lib/types.ts";

const root = resolve(process.cwd());

function nowIso(): string {
  return new Date().toISOString();
}

function nowLog(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok", hour12: false }).replace(" ", " ") + " +07";
}

function logRun(message: string): void {
  const logPath = join(root, "course", "runlogs", "latest.md");
  appendFileSync(logPath, `\n## ${nowLog()}\n- ${message}\n`, "utf8");
}

function printUsage(): void {
  console.log(`course pipeline CLI

Commands:
  validate [--lesson M01-L001]
  set-status --lesson M01-L001 --state DRAFT|READY_TO_RECORD|PLANNED|BACKLOG
  touch-runlog --message "text"
`);
}

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1] ?? null;
}

function runValidate(): number {
  const lesson = getArg("--lesson");
  const issues = lesson
    ? validateLessonDir(lessonPath(root, lesson))
    : validateAll(root);

  if (issues.length === 0) {
    console.log("Validation passed.");
    return 0;
  }

  for (const issue of issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }
  return 1;
}

function runSetStatus(): number {
  const lesson = getArg("--lesson");
  const state = getArg("--state") as LessonStatus["state"] | null;
  if (!lesson || !state) {
    console.error("Missing --lesson or --state");
    return 1;
  }

  const path = join(lessonPath(root, lesson), "status.json");
  if (!existsSync(path)) {
    console.error(`status.json not found for ${lesson}`);
    return 1;
  }

  const next: LessonStatus = {
    lessonId: lesson,
    state,
    updatedAt: nowIso(),
    validatedAt: state === "READY_TO_RECORD" ? nowIso() : null,
  };

  writeJson(path, next);
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

function main(): number {
  const cmd = process.argv[2];
  if (!cmd) {
    printUsage();
    return 1;
  }

  switch (cmd) {
    case "validate":
      return runValidate();
    case "set-status":
      return runSetStatus();
    case "touch-runlog":
      return runTouchRunlog();
    default:
      printUsage();
      return 1;
  }
}

process.exit(main());
