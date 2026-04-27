/**
 * W7: Per-module cheat sheet PDF.
 *
 * Aggregates all lessons in a module into a 2-page A5 cheat sheet:
 *   page 1 — vocab grid (Thai / translit / English) across all lessons
 *   page 2 — chunk list + grammar summary + role-play scenarios
 *
 * Output: course/modules/M??/M??-cheatsheet.pdf
 */

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { pathToFileURL } from "node:url";
import {
  lessonArtifactCandidateNames,
  lessonArtifactFileName,
} from "../../src/lib/course-artifacts.ts";
import type { Lexeme, ScriptMaster } from "./lib/types.ts";

const ROOT = process.cwd();
const A5: [number, number] = [419.528, 595.276];

const TEAL = "#0D9488";
const TEAL_BG = "#CCFBF1";
const INK = "#0F172A";
const SLATE = "#334155";
const MUTED = "#64748B";
const BORDER = "#CBD5E1";

const FONT_CANDIDATES = {
  regular: [
    path.join(ROOT, "assets", "fonts", "Sarabun-Regular.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Regular.ttf"),
  ],
  bold: [
    path.join(ROOT, "assets", "fonts", "Sarabun-Bold.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Bold.ttf"),
  ],
  semibold: [
    path.join(ROOT, "assets", "fonts", "Sarabun-SemiBold.ttf"),
    path.join(ROOT, "assets", "fonts", "Sarabun-Bold.ttf"),
  ],
};

function pickExisting(paths: string[], label: string): string {
  const found = paths.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`Missing ${label} font. Checked: ${paths.join(", ")}`);
  return found;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveLessonArtifactPath(
  lessonDir: string,
  lessonId: string,
  baseName: string
): string {
  for (const candidate of lessonArtifactCandidateNames(lessonId, baseName)) {
    const candidatePath = path.join(lessonDir, candidate);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }
  return path.join(lessonDir, lessonArtifactFileName(lessonId, baseName));
}

interface ModuleAggregate {
  moduleId: string;
  lessonCount: number;
  lessonTitles: Array<{ lessonId: string; title: string }>;
  vocab: Array<{ lessonId: string; thai: string; translit: string; english: string }>;
  chunks: Array<{ lessonId: string; thai: string; translit: string; english: string }>;
  scenarios: Array<{ lessonId: string; scenario: string }>;
}

function readModule(moduleId: string): ModuleAggregate {
  const moduleDir = path.join(ROOT, "course", "modules", moduleId);
  if (!fs.existsSync(moduleDir)) {
    throw new Error(`Module directory not found: ${moduleDir}`);
  }
  const lessons = fs
    .readdirSync(moduleDir)
    .filter((n) => /^L\d{3}$/.test(n))
    .sort();

  const agg: ModuleAggregate = {
    moduleId,
    lessonCount: 0,
    lessonTitles: [],
    vocab: [],
    chunks: [],
    scenarios: [],
  };

  for (const lessonKey of lessons) {
    const lessonId = `${moduleId}-${lessonKey}`;
    const lessonDir = path.join(moduleDir, lessonKey);
    const masterPath = resolveLessonArtifactPath(lessonDir, lessonId, "script-master.json");
    if (!fs.existsSync(masterPath)) continue;
    const master = JSON.parse(fs.readFileSync(masterPath, "utf8")) as ScriptMaster;
    agg.lessonCount++;
    agg.lessonTitles.push({ lessonId, title: master.title });

    const seen = new Set<string>();
    for (const s of master.sections) {
      for (const lex of s.languageFocus) {
        const key = `${lex.thai}|${lex.translit}|${lex.english}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = {
          lessonId,
          thai: lex.thai,
          translit: lex.translit,
          english: lex.english,
        };
        if (lex.type === "chunk" || lex.thai.includes(" ") || lex.thai.length > 8) {
          agg.chunks.push(entry);
        } else {
          agg.vocab.push(entry);
        }
      }
    }

    if (master.roleplay?.scenario) {
      agg.scenarios.push({ lessonId, scenario: master.roleplay.scenario });
    }
  }

  return agg;
}

interface Layout {
  margin: number;
  pageW: number;
  pageH: number;
  contentW: number;
}

function makeLayout(doc: PDFKit.PDFDocument): Layout {
  const margin = 28;
  return {
    margin,
    pageW: doc.page.width,
    pageH: doc.page.height,
    contentW: doc.page.width - margin * 2,
  };
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  moduleId: string,
  lessonCount: number,
  pageLabel: string
): void {
  const headerH = 56;
  doc.save().rect(0, 0, layout.pageW, headerH).fill(TEAL).restore();
  doc
    .font("IBold")
    .fontSize(13)
    .fillColor("#FFFFFF")
    .text("Immersion Thai with Nine", layout.margin, 14);
  doc
    .font("IRegular")
    .fontSize(9)
    .fillColor("#E6FFFB")
    .text(`Module cheat sheet · ${pageLabel}`, layout.margin, 32);

  const chip = `${moduleId} · ${lessonCount} lessons`;
  doc.font("ISemiBold").fontSize(10).fillColor("#FFFFFF");
  const chipW = doc.widthOfString(chip) + 14;
  doc
    .save()
    .roundedRect(layout.pageW - layout.margin - chipW, 18, chipW, 20, 4)
    .lineWidth(1)
    .strokeColor("#FFFFFF")
    .stroke()
    .restore();
  doc.text(chip, layout.pageW - layout.margin - chipW + 7, 23);

  doc.y = headerH + 12;
}

function sectionTitle(doc: PDFKit.PDFDocument, layout: Layout, label: string): void {
  doc.moveDown(0.3);
  const y = doc.y;
  doc.save().rect(layout.margin, y + 2, 3, 11).fill(TEAL).restore();
  doc
    .font("IBold")
    .fontSize(10.5)
    .fillColor(INK)
    .text(label.toUpperCase(), layout.margin + 8, y, {
      width: layout.contentW - 8,
      characterSpacing: 0.5,
    });
  doc.moveDown(0.2);
}

function drawVocabGrid(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  rows: ModuleAggregate["vocab"]
): void {
  const left = layout.margin;
  const width = layout.contentW;
  const colLessonW = 32;
  const colThaiW = Math.floor((width - colLessonW) * 0.32);
  const colTransW = Math.floor((width - colLessonW) * 0.32);
  const colEngW = width - colLessonW - colThaiW - colTransW;
  const headerH = 16;
  const rowH = 16;

  const startY = doc.y;
  doc.save().rect(left, startY, width, headerH).fill(TEAL_BG).restore();
  doc.font("IBold").fontSize(7.5).fillColor(INK);
  doc.text("L#", left + 4, startY + 4, { width: colLessonW - 6 });
  doc.text("Thai", left + colLessonW + 4, startY + 4, { width: colThaiW - 6 });
  doc.text("Transliteration", left + colLessonW + colThaiW + 4, startY + 4, {
    width: colTransW - 6,
  });
  doc.text("English", left + colLessonW + colThaiW + colTransW + 4, startY + 4, {
    width: colEngW - 6,
  });

  let y = startY + headerH;
  for (const r of rows) {
    if (y + rowH > layout.pageH - layout.margin - 16) break;
    doc
      .save()
      .rect(left, y, width, rowH)
      .lineWidth(0.4)
      .strokeColor(BORDER)
      .stroke()
      .restore();
    const lessonNum = r.lessonId.split("-").pop()?.replace(/^L0*/, "") ?? "";
    doc.font("IRegular").fontSize(7.5).fillColor(MUTED);
    doc.text(lessonNum, left + 4, y + 4, { width: colLessonW - 6 });
    doc.font("IRegular").fontSize(9).fillColor(INK);
    doc.text(r.thai, left + colLessonW + 4, y + 3, { width: colThaiW - 6 });
    doc.font("IRegular").fontSize(8).fillColor(SLATE);
    doc.text(r.translit, left + colLessonW + colThaiW + 4, y + 4, { width: colTransW - 6 });
    doc.font("IRegular").fontSize(8).fillColor(SLATE);
    doc.text(r.english, left + colLessonW + colThaiW + colTransW + 4, y + 4, {
      width: colEngW - 6,
    });
    y += rowH;
  }
  doc.y = y + 4;
}

function drawChunkList(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  rows: ModuleAggregate["chunks"]
): void {
  for (const r of rows) {
    if (doc.y + 24 > layout.pageH - layout.margin - 16) break;
    const y = doc.y;
    doc.save().circle(layout.margin + 3, y + 5, 1.6).fill(TEAL).restore();
    doc.font("IBold").fontSize(9.5).fillColor(INK);
    doc.text(r.thai, layout.margin + 10, y, { width: layout.contentW - 12, continued: false });
    doc.font("IRegular").fontSize(8).fillColor(TEAL);
    doc.text(r.translit, layout.margin + 10, doc.y, {
      width: layout.contentW - 12,
    });
    doc.font("IRegular").fontSize(8).fillColor(MUTED);
    doc.text(`${r.english}  (${r.lessonId})`, layout.margin + 10, doc.y, {
      width: layout.contentW - 12,
    });
    doc.moveDown(0.25);
  }
}

function drawScenarios(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  rows: ModuleAggregate["scenarios"]
): void {
  for (const r of rows) {
    if (doc.y + 32 > layout.pageH - layout.margin - 16) break;
    const y = doc.y;
    doc.font("ISemiBold").fontSize(8.5).fillColor(TEAL);
    doc.text(r.lessonId, layout.margin, y, { width: layout.contentW });
    doc.font("IRegular").fontSize(8.5).fillColor(INK);
    doc.text(r.scenario, layout.margin, doc.y, {
      width: layout.contentW,
      lineGap: 1,
    });
    doc.moveDown(0.3);
  }
}

function drawFooter(doc: PDFKit.PDFDocument, layout: Layout, label: string): void {
  const y = layout.pageH - layout.margin - 10;
  doc
    .save()
    .moveTo(layout.margin, y - 6)
    .lineTo(layout.pageW - layout.margin, y - 6)
    .lineWidth(0.5)
    .strokeColor(BORDER)
    .stroke()
    .restore();
  doc
    .font("IRegular")
    .fontSize(7.5)
    .fillColor(MUTED)
    .text("thaiwith.nine", layout.margin, y, { width: layout.contentW });
  doc.font("IRegular").fontSize(7.5).fillColor(MUTED);
  const rw = doc.widthOfString(label);
  doc.text(label, layout.pageW - layout.margin - rw, y);
}

export async function generateModuleCheatsheet(moduleId: string): Promise<string> {
  const agg = readModule(moduleId);
  if (agg.lessonCount === 0) {
    throw new Error(`No lessons with script-master.json found in module ${moduleId}`);
  }

  const outPath = path.join(ROOT, "course", "modules", moduleId, `${moduleId}-cheatsheet.pdf`);
  const regular = pickExisting(FONT_CANDIDATES.regular, "regular");
  const bold = pickExisting(FONT_CANDIDATES.bold, "bold");
  const semibold = pickExisting(FONT_CANDIDATES.semibold, "semibold");

  const doc = new PDFDocument({ size: A5, margin: 28, autoFirstPage: false });
  doc.registerFont("IRegular", regular);
  doc.registerFont("IBold", bold);
  doc.registerFont("ISemiBold", semibold);

  const out = fs.createWriteStream(outPath);
  doc.pipe(out);

  // Page 1: vocab grid
  doc.addPage({ size: A5, margin: 28 });
  let layout = makeLayout(doc);
  drawHeader(doc, layout, moduleId, agg.lessonCount, "Page 1 of 2 · Vocabulary");
  doc.moveDown(0.4);

  // intro line
  doc
    .font("IRegular")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(
      `Every core word introduced across the ${agg.lessonCount} lessons of ${moduleId}. Lesson number in the left column.`,
      layout.margin,
      doc.y,
      { width: layout.contentW }
    );
  doc.moveDown(0.3);

  sectionTitle(doc, layout, "Vocabulary");
  drawVocabGrid(doc, layout, agg.vocab);
  drawFooter(doc, layout, `${moduleId} cheat sheet · 1/2`);

  // Page 2: chunks + scenarios
  doc.addPage({ size: A5, margin: 28 });
  layout = makeLayout(doc);
  drawHeader(doc, layout, moduleId, agg.lessonCount, "Page 2 of 2 · Chunks + scenarios");
  doc.moveDown(0.4);

  if (agg.chunks.length > 0) {
    sectionTitle(doc, layout, "Useful chunks");
    drawChunkList(doc, layout, agg.chunks);
  }

  if (agg.scenarios.length > 0) {
    sectionTitle(doc, layout, "Role-play scenarios in this module");
    drawScenarios(doc, layout, agg.scenarios);
  }

  drawFooter(doc, layout, `${moduleId} cheat sheet · 2/2`);

  doc.end();
  await new Promise<void>((resolve, reject) => {
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
  return outPath;
}

export async function main(): Promise<void> {
  const moduleId = arg("--module");
  if (!moduleId) {
    console.error("Usage: generate_module_cheatsheet.ts --module M01");
    process.exit(2);
  }
  const out = await generateModuleCheatsheet(moduleId);
  console.log(`Wrote ${path.relative(ROOT, out)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
