import { promises as fs } from "node:fs";
import path from "node:path";
import {
  scanContent,
  type ArtifactSpec,
  type ContentTypeSpec,
} from "@/lib/creator/content-scanner";
import type { LessonRow } from "@/types/creator";

const MODULE_PATTERN = /^M\d{2}$/;
const LESSON_PATTERN = /^L\d{3}$/;

interface BlueprintEntry {
  title: string;
  cefrBand: string;
  moduleTitle: string;
}

type BlueprintMap = Map<string, BlueprintEntry>;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readBlueprint(root: string): Promise<BlueprintMap> {
  const csvPath = path.join(
    root,
    "course",
    "exports",
    "full-thai-course-blueprint.csv"
  );
  const map: BlueprintMap = new Map();
  let text: string;
  try {
    text = await fs.readFile(csvPath, "utf8");
  } catch {
    return map;
  }
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return map;
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const idIdx = headers.indexOf("lesson_id");
  const titleIdx = headers.indexOf("lesson_title");
  const bandIdx = headers.indexOf("cefr_band");
  const moduleIdx = headers.indexOf("module_title");
  if (idIdx < 0) return map;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const id = (cells[idIdx] ?? "").trim();
    if (!id) continue;
    map.set(id, {
      title: (cells[titleIdx] ?? "").trim(),
      cefrBand: (cells[bandIdx] ?? "").trim(),
      moduleTitle: (cells[moduleIdx] ?? "").trim(),
    });
  }
  return map;
}

async function readStatus(dir: string): Promise<{
  state: string;
  updatedAt: string;
}> {
  try {
    const raw = await fs.readFile(path.join(dir, "status.json"), "utf8");
    const json = JSON.parse(raw) as { state?: string; updatedAt?: string };
    return {
      state: json.state ?? "UNKNOWN",
      updatedAt: json.updatedAt ?? "",
    };
  } catch {
    return { state: "UNKNOWN", updatedAt: "" };
  }
}

function lessonArtifactSpecs(): ArtifactSpec[] {
  const f = (
    key: string,
    label: string,
    icon: string,
    suffix: string
  ): ArtifactSpec => ({
    key,
    label,
    icon,
    resolve: (id, dir) => path.join(dir, `${id}${suffix}`),
  });
  return [
    f("scriptSpoken", "Script (spoken)", "md", "-script-spoken.md"),
    f("scriptVisual", "Script (visual)", "md", "-script-visual.md"),
    f("scriptMaster", "Master JSON", "json", "-script-master.json"),
    f("deck", "Deck", "pptx", "-deck.pptx"),
    f("canvaDeck", "Canva Deck", "pptx", "-canva-deck.pptx"),
    f("pdf", "PDF", "pdf", "-pdf.pdf"),
    f("quiz", "Quiz", "json", "-quiz.json"),
    f("flashcards", "Flashcards", "json", "-flashcards.json"),
    f("vocabExport", "Vocab", "json", "-vocab-export.json"),
    f("qaReport", "QA Report", "md", "-qa-report.md"),
    f("brief", "Brief", "md", "-brief.md"),
  ];
}

export function lessonsSpec(root = process.cwd()): ContentTypeSpec<{
  module: string;
  cefrBand: string;
  updatedAt: string;
}> {
  return {
    kind: "lesson",
    scan: async () => {
      const modulesDir = path.join(root, "course", "modules");
      const items: Array<{ id: string; dir: string }> = [];
      let moduleEntries: string[] = [];
      try {
        moduleEntries = await fs.readdir(modulesDir);
      } catch {
        return items;
      }
      for (const mod of moduleEntries) {
        if (!MODULE_PATTERN.test(mod)) continue;
        const modPath = path.join(modulesDir, mod);
        const modStat = await fs.stat(modPath).catch(() => null);
        if (!modStat?.isDirectory()) continue;
        const lessonEntries = await fs.readdir(modPath).catch(() => []);
        for (const lesson of lessonEntries) {
          if (!LESSON_PATTERN.test(lesson)) continue;
          const lessonPath = path.join(modPath, lesson);
          const lessonStat = await fs.stat(lessonPath).catch(() => null);
          if (!lessonStat?.isDirectory()) continue;
          items.push({ id: `${mod}-${lesson}`, dir: lessonPath });
        }
      }
      items.sort((a, b) => a.id.localeCompare(b.id));
      return items;
    },
    artifacts: lessonArtifactSpecs(),
    build: async (id, dir) => {
      const blueprint = await blueprintPromise(root);
      const status = await readStatus(dir);
      const entry = blueprint.get(id);
      const module = id.slice(0, 3);
      return {
        title: entry?.title || id,
        status: status.state,
        meta: {
          module,
          cefrBand: entry?.cefrBand ?? "",
          updatedAt: status.updatedAt,
        },
      };
    },
  };
}

let _blueprintCache: { root: string; promise: Promise<BlueprintMap> } | null =
  null;

function blueprintPromise(root: string): Promise<BlueprintMap> {
  if (_blueprintCache && _blueprintCache.root === root) {
    return _blueprintCache.promise;
  }
  const promise = readBlueprint(root);
  _blueprintCache = { root, promise };
  return promise;
}

export async function readLessons(root = process.cwd()): Promise<LessonRow[]> {
  _blueprintCache = null;
  return scanContent(lessonsSpec(root));
}
