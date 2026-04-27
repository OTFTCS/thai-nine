/**
 * W7: Per-lesson one-pager PDF (front + cloze-blanked reverse).
 *
 * Reads a lesson's script-master.json and emits two A5 PDFs:
 *   docs/<lesson_id>-onepager.pdf       — front side, full Thai + translit + English
 *   docs/<lesson_id>-onepager-cloze.pdf — back / self-test, Thai column blanked
 *
 * Style: Sarabun font, teal accent, two-column where space allows. Mirrors the
 * spirit of thai_with_nine_tiktok/lead-magnets/cheatsheet-mockups/concept-*.
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

type Triplet = { thai: string; translit: string; english: string };

const ROOT = process.cwd();

// A5 page dimensions in PDF points (1 mm = 2.83465 pt).
// 148 mm x 210 mm.
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
    path.join(ROOT, "course", "assets", "fonts", "Sarabun-Regular.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Regular.ttf"),
  ],
  bold: [
    path.join(ROOT, "assets", "fonts", "Sarabun-Bold.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "Sarabun-Bold.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Bold.ttf"),
  ],
  semibold: [
    path.join(ROOT, "assets", "fonts", "Sarabun-SemiBold.ttf"),
    path.join(ROOT, "assets", "fonts", "Sarabun-Bold.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "Sarabun-Bold.ttf"),
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Bold.ttf"),
  ],
};

function pickExisting(paths: string[], label: string): string {
  const found = paths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Missing ${label} Thai-capable font. Checked: ${paths.join(", ")}`);
  }
  return found;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lessonDirFromId(lessonId: string): string {
  const [moduleId, lessonKey] = lessonId.split("-");
  return path.join(ROOT, "course", "modules", moduleId, lessonKey);
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

// ---------- content extraction ----------

function dedupTriplets(items: Triplet[]): Triplet[] {
  const seen = new Map<string, Triplet>();
  for (const t of items) {
    const key = `${t.thai}|${t.translit}|${t.english}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return Array.from(seen.values());
}

interface ExtractedContent {
  vocab: Triplet[]; // up to 6 single-word items
  chunks: Triplet[]; // up to 2 multi-word/phrase items
  drills: string[]; // up to 3 production drills
  minimalPair: { a: Triplet; b: Triplet } | null;
  roleplayScenario: string | null;
}

function isProductionDrill(text: string): boolean {
  const lower = text.toLowerCase();
  // "production drills" = substitution / response-building / pause-and-produce
  return (
    lower.includes("substitution") ||
    lower.includes("response-building") ||
    lower.includes("pause-and-produce") ||
    lower.includes("pause and produce") ||
    lower.includes("your turn") ||
    lower.includes("say it aloud") ||
    lower.includes("what do you say")
  );
}

function extractContent(master: ScriptMaster): ExtractedContent {
  const allFocus: Lexeme[] = [];
  for (const s of master.sections) {
    for (const lex of s.languageFocus) allFocus.push(lex);
  }

  const vocabAll: Triplet[] = [];
  const chunksAll: Triplet[] = [];
  for (const lex of allFocus) {
    const t: Triplet = { thai: lex.thai, translit: lex.translit, english: lex.english };
    if (lex.type === "chunk") chunksAll.push(t);
    else vocabAll.push(t);
  }

  // Some lessons mark everything as "word" — fall back to splitting on phrase length.
  let vocab = dedupTriplets(vocabAll);
  let chunks = dedupTriplets(chunksAll);
  if (chunks.length === 0) {
    const all = dedupTriplets([...vocabAll, ...chunksAll]);
    vocab = all.filter((t) => !t.thai.includes(" ")).slice(0, 6);
    chunks = all
      .filter((t) => t.thai.includes(" ") || t.thai.length > 8)
      .slice(0, 2);
  }
  vocab = vocab.slice(0, 6);
  chunks = chunks.slice(0, 2);

  // Drills: prefer production-style drills; fall back to first 3 in any section.
  const allDrills: string[] = [];
  for (const s of master.sections) {
    for (const d of s.drills) allDrills.push(d);
  }
  const productionDrills = allDrills.filter(isProductionDrill);
  const drills = (productionDrills.length >= 3 ? productionDrills : allDrills).slice(0, 3);

  const minimalPair = master.pronunciationFocus?.minimalPairs?.[0]
    ? {
        a: master.pronunciationFocus.minimalPairs[0].a,
        b: master.pronunciationFocus.minimalPairs[0].b,
      }
    : null;

  const roleplayScenario = master.roleplay?.scenario ?? null;

  return { vocab, chunks, drills, minimalPair, roleplayScenario };
}

// ---------- drawing primitives ----------

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
  lessonId: string,
  title: string,
  variant: "front" | "cloze"
): void {
  const headerH = 56;
  doc.save();
  doc.rect(0, 0, layout.pageW, headerH).fill(TEAL);
  doc.restore();

  doc
    .font("IBold")
    .fontSize(13)
    .fillColor("#FFFFFF")
    .text("Immersion Thai with Nine", layout.margin, 14);

  doc
    .font("IRegular")
    .fontSize(9)
    .fillColor("#E6FFFB")
    .text(
      variant === "cloze" ? "Lesson one-pager — self-test" : "Lesson one-pager",
      layout.margin,
      32
    );

  // Lesson id chip on the right
  const chipText = lessonId;
  doc.font("ISemiBold").fontSize(10).fillColor("#FFFFFF");
  const chipW = doc.widthOfString(chipText) + 14;
  doc
    .save()
    .roundedRect(layout.pageW - layout.margin - chipW, 18, chipW, 20, 4)
    .lineWidth(1)
    .strokeColor("#FFFFFF")
    .stroke()
    .restore();
  doc.text(chipText, layout.pageW - layout.margin - chipW + 7, 23);

  // Title under the bar
  doc
    .font("IBold")
    .fontSize(15)
    .fillColor(INK)
    .text(title, layout.margin, headerH + 12, { width: layout.contentW });

  doc.y = headerH + 12 + 22;
}

function sectionTitle(doc: PDFKit.PDFDocument, layout: Layout, label: string): void {
  doc.moveDown(0.2);
  const y = doc.y;
  // teal accent bar
  doc.save().rect(layout.margin, y + 2, 3, 11).fill(TEAL).restore();
  doc
    .font("IBold")
    .fontSize(10.5)
    .fillColor(INK)
    .text(label.toUpperCase(), layout.margin + 8, y, {
      width: layout.contentW - 8,
      characterSpacing: 0.5,
    });
  doc.moveDown(0.25);
}

function drawTripletTable(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  rows: Triplet[],
  options: { blankThai?: boolean } = {}
): void {
  if (rows.length === 0) return;
  const blank = !!options.blankThai;
  const left = layout.margin;
  const width = layout.contentW;
  const col1 = Math.floor(width * 0.3); // Thai
  const col2 = Math.floor(width * 0.32); // translit
  const col3 = width - col1 - col2; // English
  const rowH = 22;
  const headerH = 18;

  // header
  const startY = doc.y;
  doc.save().rect(left, startY, width, headerH).fill(TEAL_BG).restore();
  doc.font("IBold").fontSize(8.5).fillColor(INK);
  doc.text("Thai", left + 6, startY + 5, { width: col1 - 8 });
  doc.text("Transliteration", left + col1 + 6, startY + 5, { width: col2 - 8 });
  doc.text("English", left + col1 + col2 + 6, startY + 5, { width: col3 - 8 });

  let y = startY + headerH;
  for (const r of rows) {
    if (y + rowH > layout.pageH - layout.margin - 8) break;
    doc
      .save()
      .rect(left, y, width, rowH)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke()
      .restore();

    if (blank) {
      // Faint dotted underline as a write-in space
      doc.save();
      doc.dash(1.5, { space: 1.8 });
      doc
        .moveTo(left + 6, y + rowH - 5)
        .lineTo(left + col1 - 6, y + rowH - 5)
        .strokeColor(MUTED)
        .lineWidth(0.6)
        .stroke();
      doc.undash();
      doc.restore();
    } else {
      doc.font("IRegular").fontSize(11).fillColor(INK);
      doc.text(r.thai, left + 6, y + 5, { width: col1 - 8 });
    }

    doc.font("IRegular").fontSize(9).fillColor(SLATE);
    doc.text(r.translit, left + col1 + 6, y + 6, { width: col2 - 8 });
    doc.font("IRegular").fontSize(9).fillColor(SLATE);
    doc.text(r.english, left + col1 + col2 + 6, y + 6, { width: col3 - 8 });

    y += rowH;
  }
  doc.y = y + 4;
}

function bullet(doc: PDFKit.PDFDocument, layout: Layout, text: string, num?: number): void {
  const indent = layout.margin + 12;
  const y = doc.y;
  if (num !== undefined) {
    doc
      .save()
      .circle(layout.margin + 5, y + 5, 4)
      .fill(TEAL)
      .restore();
    doc
      .font("IBold")
      .fontSize(7)
      .fillColor("#FFFFFF")
      .text(String(num), layout.margin + 2.5, y + 2.5);
  } else {
    doc
      .save()
      .circle(layout.margin + 5, y + 5, 1.6)
      .fill(SLATE)
      .restore();
  }
  doc
    .font("IRegular")
    .fontSize(9)
    .fillColor(INK)
    .text(text, indent, y, { width: layout.contentW - 12, lineGap: 1 });
  doc.moveDown(0.25);
}

function fillPlaceholderInDrill(text: string, blankThai: boolean): string {
  if (!blankThai) return text;
  // Replace any Thai characters in the drill with a blank line. This is a soft
  // self-test scaffold — translit hints in the drill text are kept.
  // Match runs of Thai characters (\u0E00–\u0E7F).
  return text.replace(/[\u0E00-\u0E7F]+/g, "______");
}

function drawMinimalPair(
  doc: PDFKit.PDFDocument,
  layout: Layout,
  pair: { a: Triplet; b: Triplet },
  blankThai: boolean
): void {
  const colW = (layout.contentW - 10) / 2;
  const startY = doc.y;
  const cardH = 46;

  for (let i = 0; i < 2; i++) {
    const x = layout.margin + i * (colW + 10);
    const item = i === 0 ? pair.a : pair.b;
    doc
      .save()
      .roundedRect(x, startY, colW, cardH, 4)
      .lineWidth(0.6)
      .strokeColor(BORDER)
      .stroke()
      .restore();
    if (blankThai) {
      doc.save();
      doc.dash(1.5, { space: 1.8 });
      doc
        .moveTo(x + 8, startY + 18)
        .lineTo(x + colW - 8, startY + 18)
        .strokeColor(MUTED)
        .lineWidth(0.6)
        .stroke();
      doc.undash();
      doc.restore();
    } else {
      doc.font("IBold").fontSize(13).fillColor(INK);
      doc.text(item.thai, x + 8, startY + 6, { width: colW - 16 });
    }
    doc.font("IRegular").fontSize(9).fillColor(TEAL);
    doc.text(item.translit, x + 8, startY + 24, { width: colW - 16 });
    doc.font("IRegular").fontSize(8.5).fillColor(MUTED);
    doc.text(item.english, x + 8, startY + 34, { width: colW - 16 });
  }
  doc.y = startY + cardH + 6;
}

function drawFooter(doc: PDFKit.PDFDocument, layout: Layout, lessonId: string): void {
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
    .text("thaiwith.nine", layout.margin, y, {
      width: layout.contentW,
      align: "left",
    });
  doc.font("IRegular").fontSize(7.5).fillColor(MUTED);
  const right = `${lessonId} · PTM transliteration`;
  const rw = doc.widthOfString(right);
  doc.text(right, layout.pageW - layout.margin - rw, y);
}

// ---------- the page builder ----------

function buildOnepagerPage(
  doc: PDFKit.PDFDocument,
  master: ScriptMaster,
  content: ExtractedContent,
  variant: "front" | "cloze"
): void {
  const layout = makeLayout(doc);
  const lessonId = master.lessonId;
  const title = `${lessonId} — ${master.title}`;
  drawHeader(doc, layout, lessonId, title, variant);

  // Objective / takeaway under the title
  if (master.teachingFrame?.learnerTakeaway || master.objective) {
    const text = master.teachingFrame?.learnerTakeaway ?? master.objective;
    doc
      .font("IRegular")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(text, layout.margin, doc.y, { width: layout.contentW, lineGap: 1 });
    doc.moveDown(0.4);
  }

  // VOCABULARY (max 6)
  if (content.vocab.length > 0) {
    sectionTitle(doc, layout, "Core vocabulary");
    drawTripletTable(doc, layout, content.vocab, { blankThai: variant === "cloze" });
  }

  // CHUNKS (max 2)
  if (content.chunks.length > 0) {
    sectionTitle(doc, layout, "Useful chunks");
    drawTripletTable(doc, layout, content.chunks, { blankThai: variant === "cloze" });
  }

  // DRILLS (max 3)
  if (content.drills.length > 0) {
    sectionTitle(doc, layout, "Production drills");
    content.drills.forEach((d, i) => {
      bullet(doc, layout, fillPlaceholderInDrill(d, variant === "cloze"), i + 1);
    });
  }

  // MINIMAL PAIR
  if (content.minimalPair) {
    sectionTitle(doc, layout, "Minimal pair — train your ear");
    drawMinimalPair(doc, layout, content.minimalPair, variant === "cloze");
  }

  // ROLEPLAY PROMPT
  if (content.roleplayScenario) {
    sectionTitle(doc, layout, "Role-play prompt");
    doc
      .font("IRegular")
      .fontSize(9)
      .fillColor(INK)
      .text(content.roleplayScenario, layout.margin, doc.y, {
        width: layout.contentW,
        lineGap: 1,
      });
    doc.moveDown(0.3);
    doc
      .font("IRegular")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        variant === "cloze"
          ? "Cover the front. Run the role-play out loud using only the transliteration as a guide."
          : "Run this exchange aloud with a partner or the recording. Switch roles and repeat.",
        layout.margin,
        doc.y,
        { width: layout.contentW }
      );
  }

  drawFooter(doc, layout, lessonId);
}

// ---------- public API ----------

export async function generateLessonDocs(lessonId: string): Promise<{
  onepager: string;
  cloze: string;
}> {
  const lessonDir = lessonDirFromId(lessonId);
  if (!fs.existsSync(lessonDir)) {
    throw new Error(`Lesson directory not found: ${lessonDir}`);
  }
  const masterPath = resolveLessonArtifactPath(lessonDir, lessonId, "script-master.json");
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Missing script-master.json for ${lessonId}: ${masterPath}`);
  }
  const master = JSON.parse(fs.readFileSync(masterPath, "utf8")) as ScriptMaster;
  const content = extractContent(master);

  const docsDir = path.join(lessonDir, "docs");
  fs.mkdirSync(docsDir, { recursive: true });

  const onepagerPath = path.join(docsDir, `${lessonId}-onepager.pdf`);
  const clozePath = path.join(docsDir, `${lessonId}-onepager-cloze.pdf`);

  const regular = pickExisting(FONT_CANDIDATES.regular, "regular");
  const bold = pickExisting(FONT_CANDIDATES.bold, "bold");
  const semibold = pickExisting(FONT_CANDIDATES.semibold, "semibold");

  await renderToFile(onepagerPath, master, content, "front", regular, bold, semibold);
  await renderToFile(clozePath, master, content, "cloze", regular, bold, semibold);

  return { onepager: onepagerPath, cloze: clozePath };
}

async function renderToFile(
  outPath: string,
  master: ScriptMaster,
  content: ExtractedContent,
  variant: "front" | "cloze",
  regular: string,
  bold: string,
  semibold: string
): Promise<void> {
  // autoFirstPage:false + manual addPage with a guard prevents PDFKit from
  // silently spilling onto a 2nd page when content marginally overruns. The
  // one-pager design must fit on exactly one A5 page.
  const doc = new PDFDocument({ size: A5, margin: 28, autoFirstPage: false });
  doc.registerFont("IRegular", regular);
  doc.registerFont("IBold", bold);
  doc.registerFont("ISemiBold", semibold);
  // Block addPage after the first — PDFKit normally auto-pages on overflow,
  // but the one-pager budget assumes a single sheet. Subsequent text() calls
  // that exceed the bottom margin are simply truncated.
  let pageCount = 0;
  const origAddPage = doc.addPage.bind(doc);
  // @ts-expect-error — overriding addPage to enforce single-page output.
  doc.addPage = (...args: unknown[]) => {
    if (pageCount >= 1) return doc;
    pageCount++;
    return origAddPage(...(args as Parameters<typeof origAddPage>));
  };
  doc.addPage();

  const out = fs.createWriteStream(outPath);
  doc.pipe(out);
  buildOnepagerPage(doc, master, content, variant);
  doc.end();
  await new Promise<void>((resolve, reject) => {
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
}

export async function main(): Promise<void> {
  const lesson = arg("--lesson");
  if (!lesson) {
    console.error("Usage: generate_lesson_docs.ts --lesson M01-L001");
    process.exit(2);
  }
  const { onepager, cloze } = await generateLessonDocs(lesson);
  console.log(`Wrote ${path.relative(ROOT, onepager)}`);
  console.log(`Wrote ${path.relative(ROOT, cloze)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
