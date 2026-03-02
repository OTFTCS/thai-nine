import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { pathToFileURL } from "node:url";

type Triplet = { thai: string; translit: string; english: string };
type Section = {
  heading: string;
  purpose?: string;
  languageFocus?: Triplet[];
  drills?: string[];
  spokenNarration?: string[];
};
type Master = {
  lessonId: string;
  title: string;
  objective?: string;
  recap?: string[];
  sections?: Section[];
  roleplay?: { scenario?: string; lines?: { speaker: string; thai: string; translit: string; english: string }[] };
};

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const ROOT = process.cwd();
const FONT_CANDIDATES = {
  regular: [
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Regular.ttf"),
    "/System/Library/Fonts/Supplemental/Tahoma.ttf",
    "/Library/Fonts/Tahoma.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
  ],
  bold: [
    path.join(ROOT, "course", "assets", "fonts", "NotoSansThai-Bold.ttf"),
    "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf",
    "/Library/Fonts/Tahoma Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
  ],
};

function pickExisting(paths: string[], label: string) {
  const found = paths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Missing ${label} Thai-capable font. Checked: ${paths.join(", ")}`);
  }
  return found;
}

function addHeader(doc: PDFKit.PDFDocument, lessonId: string, title: string) {
  doc.rect(0, 0, doc.page.width, 92).fill("#0ea5a3");
  doc.fillColor("#ffffff");
  doc.font("IBold").fontSize(18).text("Immersion Thai with Nine", 46, 26);
  doc.font("IRegular").fontSize(11).fillColor("#e6fffb").text("Lesson Notes", 46, 52);

  doc.fillColor("#0f172a");
  doc.font("IBold").fontSize(20).text(`${lessonId} — ${title}`, 46, 112, { width: doc.page.width - 92 });
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > doc.page.height - 120) return;
  doc.moveDown(0.45);
  doc.font("IBold").fontSize(14).fillColor("#0f172a").text(title, { underline: false });
  doc.moveDown(0.2);
}

function bullet(doc: PDFKit.PDFDocument, text: string, size = 10) {
  doc.font("IRegular").fontSize(size).fillColor("#1f2937").text(`• ${text}`, { indent: 8, lineGap: 1 });
}

function cap<T>(arr: T[] | undefined, n: number): T[] {
  return (arr || []).slice(0, n);
}

function tripletTable(doc: PDFKit.PDFDocument, rows: Triplet[], maxRows = 6) {
  const pageW = doc.page.width;
  const left = 46;
  const width = pageW - 92;
  const col1 = Math.floor(width * 0.28);
  const col2 = Math.floor(width * 0.34);
  const col3 = width - col1 - col2;

  const rowH = 24;
  const startY = doc.y;

  doc.save();
  doc.rect(left, startY, width, rowH).fill("#e6fffb");
  doc.restore();

  doc.font("IBold").fontSize(10).fillColor("#0f172a");
  doc.text("Thai", left + 8, startY + 7, { width: col1 - 10 });
  doc.text("Transliteration", left + col1 + 8, startY + 7, { width: col2 - 10 });
  doc.text("English", left + col1 + col2 + 8, startY + 7, { width: col3 - 10 });

  let y = startY + rowH;
  for (const r of rows.slice(0, maxRows)) {
    if (y > doc.page.height - 90) break;

    doc.save();
    doc.rect(left, y, width, rowH).strokeColor("#d1d5db").lineWidth(0.6).stroke();
    doc.restore();

    doc.font("IRegular").fontSize(10).fillColor("#111827");
    doc.text(r.thai, left + 8, y + 6, { width: col1 - 10 });
    doc.text(r.translit, left + col1 + 8, y + 6, { width: col2 - 10 });
    doc.text(r.english, left + col1 + col2 + 8, y + 6, { width: col3 - 10 });
    y += rowH;
  }

  doc.y = y + 6;
}

export function renderLessonPdf(lessonDir: string) {
  const masterPath = path.join(lessonDir, "script-master.json");
  if (!fs.existsSync(masterPath)) throw new Error(`Missing script-master.json: ${masterPath}`);

  const master = JSON.parse(fs.readFileSync(masterPath, "utf8")) as Master;
  const outPath = path.join(lessonDir, "pdf.pdf");

  const regularFont = pickExisting(FONT_CANDIDATES.regular, "regular");
  const boldFont = pickExisting(FONT_CANDIDATES.bold, "bold");

  const doc = new PDFDocument({ size: "A4", margin: 46 });
  doc.registerFont("IRegular", regularFont);
  doc.registerFont("IBold", boldFont);

  const out = fs.createWriteStream(outPath);
  doc.pipe(out);

  addHeader(doc, master.lessonId, master.title);

  if (master.objective) {
    addSectionTitle(doc, "After this lesson, you can...");
    bullet(doc, master.objective, 10);
  }

  const allTriplets: Triplet[] = [];
  for (const s of cap(master.sections, 2)) {
    addSectionTitle(doc, s.heading);
    if (s.purpose) bullet(doc, s.purpose, 10);

    if (s.spokenNarration?.length) {
      doc.moveDown(0.2);
      doc.font("IBold").fontSize(10).fillColor("#0369a1").text("Helpful notes");
      cap(s.spokenNarration, 2).forEach((n) => bullet(doc, n, 9));
    }

    if (s.drills?.length) {
      doc.moveDown(0.2);
      doc.font("IBold").fontSize(10).fillColor("#047857").text("Self-practice drills");
      cap(s.drills, 2).forEach((d) => bullet(doc, d, 9));
    }

    if (s.languageFocus?.length) {
      doc.moveDown(0.2);
      doc.font("IBold").fontSize(10).fillColor("#7c2d12").text("Core phrases");
      tripletTable(doc, s.languageFocus, 4);
      allTriplets.push(...s.languageFocus);
    }
  }

  if (master.roleplay?.lines?.length && doc.y < doc.page.height - 180) {
    addSectionTitle(doc, `Mini role-play${master.roleplay.scenario ? `: ${master.roleplay.scenario}` : ""}`);
    for (const line of cap(master.roleplay.lines, 3)) {
      doc.font("IBold").fontSize(9).fillColor("#0f172a").text(`${line.speaker}: ${line.thai}`);
      doc.font("IRegular").fontSize(9).fillColor("#0369a1").text(`   ${line.translit}`);
      doc.font("IRegular").fontSize(9).fillColor("#374151").text(`   ${line.english}`);
      doc.moveDown(0.1);
    }
  }

  if (allTriplets.length && doc.y < doc.page.height - 170) {
    addSectionTitle(doc, "Vocabulary for review");
    const dedup = new Map<string, Triplet>();
    for (const t of allTriplets) dedup.set(`${t.thai}|${t.translit}|${t.english}`, t);
    tripletTable(doc, Array.from(dedup.values()), 4);
  }

  if (master.recap?.length && doc.y < doc.page.height - 150) {
    addSectionTitle(doc, "Memory notes");
    cap(master.recap, 3).forEach((n) => bullet(doc, n, 9));
  }

  if (doc.y < doc.page.height - 120) {
    addSectionTitle(doc, "Confidence checklist");
    const checks = [
      "I can greet politely in Thai.",
      "I can use at least 3 core phrases without reading.",
      "I can do the mini role-play out loud.",
    ];
    checks.forEach((c) => {
      doc.font("IRegular").fontSize(9).fillColor("#1f2937").text(`☐ ${c}`, { indent: 8, lineGap: 1 });
    });
  }

  if (doc.y < doc.page.height - 80) {
    addSectionTitle(doc, "How to read transliteration in this course");
    bullet(doc, "We use PTM-adapted transliteration with inline tone marks.", 9);
    bullet(doc, "Every phrase is shown as: Thai + transliteration + English.", 9);
  }

  doc.end();

  return new Promise<void>((resolve, reject) => {
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
}

export async function renderLessonPdfById(root: string, lesson: string) {
  const [moduleId, lessonId] = lesson.split("-");
  const lessonDir = path.join(root, "course", "modules", moduleId, lessonId);
  await renderLessonPdf(lessonDir);
}

export async function main() {
  const lesson = arg("--lesson");

  if (lesson) {
    await renderLessonPdfById(ROOT, lesson);
    console.log(`Exported ${lesson} -> pdf.pdf`);
    return;
  }

  const modulesRoot = path.join(ROOT, "course", "modules");
  const mods = fs.readdirSync(modulesRoot).filter((m) => m.startsWith("M"));
  for (const m of mods) {
    const lessons = fs.readdirSync(path.join(modulesRoot, m)).filter((l) => l.startsWith("L"));
    for (const l of lessons) {
      const lessonDir = path.join(modulesRoot, m, l);
      if (fs.existsSync(path.join(lessonDir, "script-master.json"))) {
        await renderLessonPdf(lessonDir);
      }
    }
  }
  console.log("Exported all lesson PDFs from script-master.json");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
