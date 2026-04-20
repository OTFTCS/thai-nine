import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CompetitorRow,
  ImageCarouselRow,
  LessonPipelineRow,
  PrioritiesRow,
  RecurringTaskRow,
  SocialsRow,
  TrackerSnapshot,
  WebsiteQuizRow,
} from "@/types/creator";

const TRACKER_FILENAME = "thai-nine-project-tracker.xlsx";

export function trackerPath(root = process.cwd()): string {
  return path.join(root, TRACKER_FILENAME);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
    if ("result" in value) {
      const r = (value as { result?: unknown }).result;
      if (r !== undefined && r !== null) return String(r);
    }
    if ("richText" in value && Array.isArray((value as { richText?: unknown[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText
        .map((rt) => rt.text ?? "")
        .join("");
    }
    if ("hyperlink" in value) {
      const h = value as { hyperlink?: string; text?: string };
      return h.text ?? h.hyperlink ?? "";
    }
  }
  return String(value);
}

function rowCells(worksheet: ExcelJS.Worksheet, rowIndex: number, cols: number): string[] {
  const row = worksheet.getRow(rowIndex);
  const out: string[] = [];
  for (let c = 1; c <= cols; c++) {
    out.push(cellText(row.getCell(c).value).trim());
  }
  return out;
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => c === "");
}

function isSectionRow(cells: string[]): boolean {
  // Section headers in the Socials sheet have the same text repeated across all cells.
  if (cells.length === 0 || !cells[0]) return false;
  const first = cells[0];
  const meaningful = cells.filter((c) => c !== "");
  if (meaningful.length < 2) return false;
  return meaningful.every((c) => c === first);
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

export async function readTracker(root = process.cwd()): Promise<TrackerSnapshot> {
  const wb = await loadWorkbook(trackerPath(root));

  const priorities: PrioritiesRow[] = [];
  const pSheet = wb.getWorksheet("Priorities");
  if (pSheet) {
    for (let r = 2; r <= pSheet.rowCount; r++) {
      const c = rowCells(pSheet, r, 7);
      if (isBlankRow(c)) continue;
      priorities.push({
        rowIndex: r,
        priority: c[0],
        area: c[1],
        currentStatus: c[2],
        keyBlocker: c[3],
        nextMilestone: c[4],
        targetDate: c[5],
        notes: c[6],
      });
    }
  }

  const lessonPipeline: LessonPipelineRow[] = [];
  const lpSheet = wb.getWorksheet("Lesson Pipeline");
  if (lpSheet) {
    for (let r = 2; r <= lpSheet.rowCount; r++) {
      const c = rowCells(lpSheet, r, 10);
      if (isBlankRow(c)) continue;
      lessonPipeline.push({
        rowIndex: r,
        lessonId: c[0],
        module: c[1],
        title: c[2],
        stage: c[3],
        status: c[4],
        scriptQuality: c[5],
        deckBuilt: c[6],
        qaPass: c[7],
        blocker: c[8],
        lastUpdated: c[9],
      });
    }
  }

  const socials: SocialsRow[] = [];
  const sSheet = wb.getWorksheet("Socials");
  if (sSheet) {
    let currentSection = "";
    for (let r = 2; r <= sSheet.rowCount; r++) {
      const c = rowCells(sSheet, r, 10);
      if (isBlankRow(c)) {
        socials.push({
          kind: "blank",
          rowIndex: r,
          num: "",
          title: "",
          contentType: "",
          category: "",
          platforms: "",
          status: "",
          datePosted: "",
          views: "",
          likes: "",
          link: "",
          sectionLabel: currentSection,
        });
        continue;
      }
      if (isSectionRow(c)) {
        currentSection = c[0];
        socials.push({
          kind: "section",
          rowIndex: r,
          sectionLabel: c[0],
          num: "",
          title: "",
          contentType: "",
          category: "",
          platforms: "",
          status: "",
          datePosted: "",
          views: "",
          likes: "",
          link: "",
        });
        continue;
      }
      socials.push({
        kind: "data",
        rowIndex: r,
        sectionLabel: currentSection,
        num: c[0],
        title: c[1],
        contentType: c[2],
        category: c[3],
        platforms: c[4],
        status: c[5],
        datePosted: c[6],
        views: c[7],
        likes: c[8],
        link: c[9],
      });
    }
  }

  const competitors: CompetitorRow[] = [];
  const cSheet = wb.getWorksheet("Competitor Accounts");
  if (cSheet) {
    for (let r = 2; r <= cSheet.rowCount; r++) {
      const c = rowCells(cSheet, r, 7);
      if (isBlankRow(c)) continue;
      competitors.push({
        rowIndex: r,
        account: c[0],
        platform: c[1],
        followers: c[2],
        posts: c[3],
        style: c[4],
        works: c[5],
        ideas: c[6],
      });
    }
  }

  const websiteQuiz: WebsiteQuizRow[] = [];
  const wSheet = wb.getWorksheet("Website & Quiz");
  if (wSheet) {
    for (let r = 2; r <= wSheet.rowCount; r++) {
      const c = rowCells(wSheet, r, 6);
      if (isBlankRow(c)) continue;
      websiteQuiz.push({
        rowIndex: r,
        task: c[0],
        area: c[1],
        status: c[2],
        priority: c[3],
        dependsOn: c[4],
        notes: c[5],
      });
    }
  }

  const recurringTasks: RecurringTaskRow[] = [];
  const rSheet = wb.getWorksheet("Recurring Tasks");
  if (rSheet) {
    for (let r = 2; r <= rSheet.rowCount; r++) {
      const c = rowCells(rSheet, r, 8);
      if (isBlankRow(c)) continue;
      recurringTasks.push({
        rowIndex: r,
        task: c[0],
        area: c[1],
        frequency: c[2],
        automated: c[3],
        lastRun: c[4],
        nextDue: c[5],
        owner: c[6],
        notes: c[7],
      });
    }
  }

  const imageCarousels: ImageCarouselRow[] = [];
  const icSheet = wb.getWorksheet("Image Carousels");
  if (icSheet) {
    for (let r = 2; r <= icSheet.rowCount; r++) {
      const c = rowCells(icSheet, r, 7);
      if (isBlankRow(c)) continue;
      imageCarousels.push({
        rowIndex: r,
        topic: c[0],
        lessonLink: c[1],
        status: c[2],
        imagesCreated: c[3],
        postedTo: c[4],
        datePosted: c[5],
        notes: c[6],
      });
    }
  }

  return {
    priorities,
    lessonPipeline,
    socials,
    competitors,
    websiteQuiz,
    recurringTasks,
    imageCarousels,
    loadedAt: new Date().toISOString(),
  };
}

async function writeWorkbookAtomically(wb: ExcelJS.Workbook, filePath: string) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  await wb.xlsx.writeFile(tmp);
  await fs.rename(tmp, filePath);
}

let _cache: Promise<TrackerSnapshot> | null = null;
let _cacheRoot = "";

export function getTracker(root = process.cwd()): Promise<TrackerSnapshot> {
  if (!_cache || _cacheRoot !== root) {
    _cacheRoot = root;
    _cache = readTracker(root);
  }
  return _cache;
}

export function invalidateTrackerCache(): void {
  _cache = null;
  _cacheRoot = "";
}

export interface SocialsPatch {
  status?: string;
  datePosted?: string;
  link?: string;
  views?: string | number;
  likes?: string | number;
  title?: string;
  platforms?: string;
  category?: string;
  contentType?: string;
}

const SOCIALS_COLUMNS: Record<keyof SocialsPatch, number> = {
  title: 2,
  contentType: 3,
  category: 4,
  platforms: 5,
  status: 6,
  datePosted: 7,
  views: 8,
  likes: 9,
  link: 10,
};

export async function patchSocialsRow(
  rowIndex: number,
  patch: SocialsPatch,
  root = process.cwd()
): Promise<void> {
  const filePath = trackerPath(root);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.getWorksheet("Socials");
  if (!sheet) throw new Error("Socials sheet not found");
  if (rowIndex <= 1 || rowIndex > sheet.rowCount) {
    throw new Error(`Row index ${rowIndex} out of range for Socials sheet`);
  }

  // Guard: refuse to write to a section/blank row.
  const existing = rowCells(sheet, rowIndex, 10);
  if (isBlankRow(existing) || isSectionRow(existing)) {
    throw new Error(`Row ${rowIndex} is a section/blank marker; refusing to overwrite`);
  }

  const row = sheet.getRow(rowIndex);

  for (const [key, col] of Object.entries(SOCIALS_COLUMNS) as Array<[keyof SocialsPatch, number]>) {
    const value = patch[key];
    if (value === undefined) continue;
    row.getCell(col).value = typeof value === "number" ? value : String(value);
  }
  row.commit();
  await writeWorkbookAtomically(wb, filePath);
  invalidateTrackerCache();
}

export interface ImageCarouselPatch {
  topic?: string;
  lessonLink?: string;
  status?: string;
  imagesCreated?: string | number;
  postedTo?: string;
  datePosted?: string;
  notes?: string;
}

const IMAGE_CAROUSEL_COLUMNS: Record<keyof ImageCarouselPatch, number> = {
  topic: 1,
  lessonLink: 2,
  status: 3,
  imagesCreated: 4,
  postedTo: 5,
  datePosted: 6,
  notes: 7,
};

export async function patchImageCarouselRow(
  rowIndex: number,
  patch: ImageCarouselPatch,
  root = process.cwd()
): Promise<void> {
  const filePath = trackerPath(root);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.getWorksheet("Image Carousels");
  if (!sheet) throw new Error("Image Carousels sheet not found");
  if (rowIndex <= 1 || rowIndex > sheet.rowCount) {
    throw new Error(
      `Row index ${rowIndex} out of range for Image Carousels sheet`
    );
  }

  const existing = rowCells(sheet, rowIndex, 7);
  if (isBlankRow(existing)) {
    throw new Error(`Row ${rowIndex} is blank; refusing to overwrite`);
  }

  const row = sheet.getRow(rowIndex);
  for (const [key, col] of Object.entries(IMAGE_CAROUSEL_COLUMNS) as Array<
    [keyof ImageCarouselPatch, number]
  >) {
    const value = patch[key];
    if (value === undefined) continue;
    row.getCell(col).value =
      typeof value === "number" ? value : String(value);
  }
  row.commit();
  await writeWorkbookAtomically(wb, filePath);
  invalidateTrackerCache();
}

export async function patchRecurringTaskRow(
  rowIndex: number,
  patch: { lastRun?: string; nextDue?: string },
  root = process.cwd()
): Promise<void> {
  const filePath = trackerPath(root);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.getWorksheet("Recurring Tasks");
  if (!sheet) throw new Error("Recurring Tasks sheet not found");
  const row = sheet.getRow(rowIndex);
  if (patch.lastRun !== undefined) row.getCell(5).value = patch.lastRun;
  if (patch.nextDue !== undefined) row.getCell(6).value = patch.nextDue;
  row.commit();
  await writeWorkbookAtomically(wb, filePath);
  invalidateTrackerCache();
}
