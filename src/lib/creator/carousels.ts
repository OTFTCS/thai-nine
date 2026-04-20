import { promises as fs } from "node:fs";
import path from "node:path";
import {
  pathExists,
  scanContent,
  type ArtifactSpec,
  type ContentTypeSpec,
} from "@/lib/creator/content-scanner";
import { getTracker, trackerPath } from "@/lib/creator/tracker-xlsx";
import type { CarouselRow } from "@/types/creator";

const CAROUSELS_DIR = "Thai images";

async function findManifest(dir: string): Promise<string | null> {
  for (const name of ["carousel-data.json", "manifest.json"]) {
    const p = path.join(dir, name);
    if (await pathExists(p)) return p;
  }
  return null;
}

async function findPptx(dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir);
    const pptx = entries.find((f) => f.toLowerCase().endsWith(".pptx"));
    return pptx ? path.join(dir, pptx) : null;
  } catch {
    return null;
  }
}

async function findFinalPng(dir: string): Promise<string | null> {
  for (const rel of ["final-png", path.join("out", "final-png")]) {
    const p = path.join(dir, rel);
    if (await pathExists(p)) return p;
  }
  return null;
}

async function findSourceArt(dir: string): Promise<string | null> {
  for (const rel of ["source-svg", "art"]) {
    const p = path.join(dir, rel);
    if (await pathExists(p)) return p;
  }
  return null;
}

function carouselArtifactSpecs(root: string): ArtifactSpec[] {
  return [
    {
      key: "manifest",
      label: "Manifest",
      icon: "json",
      resolve: (_id, dir) => findManifest(dir),
    },
    {
      key: "pptx",
      label: "PPTX",
      icon: "pptx",
      resolve: (_id, dir) => findPptx(dir),
    },
    {
      key: "sourceArt",
      label: "Source Art",
      icon: "dir",
      resolve: (_id, dir) => findSourceArt(dir),
    },
    {
      key: "finalPng",
      label: "Final PNGs",
      icon: "dir",
      resolve: (_id, dir) => findFinalPng(dir),
    },
    {
      key: "contactSheet",
      label: "Contact Sheet",
      icon: "img",
      resolve: (_id, dir) => path.join(dir, "preview", "contact-sheet.jpg"),
    },
    {
      key: "xlsx",
      label: "Tracker Row",
      icon: "xlsx",
      resolve: () => trackerPath(root),
    },
  ];
}

export function carouselsSpec(root = process.cwd()): ContentTypeSpec<{
  xlsxPath: string;
}> {
  return {
    kind: "carousel",
    scan: async () => {
      const dir = path.join(root, CAROUSELS_DIR);
      const items: Array<{ id: string; dir: string }> = [];
      let entries: string[] = [];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return items;
      }
      for (const name of entries) {
        if (name.startsWith(".")) continue;
        const full = path.join(dir, name);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat?.isDirectory()) continue;
        items.push({ id: name, dir: full });
      }
      items.sort((a, b) => a.id.localeCompare(b.id));
      return items;
    },
    artifacts: carouselArtifactSpecs(root),
    build: async (id) => {
      const snapshot = await getTracker(root);
      const lower = id.toLowerCase();
      const match = snapshot.imageCarousels.find((row) => {
        const topic = row.topic.toLowerCase();
        return (
          topic === lower ||
          lower.includes(topic) ||
          topic.includes(lower.replace(/-carousel.*$/, ""))
        );
      });
      return {
        title: match?.topic || id,
        status: match?.status || "unknown",
        meta: { xlsxPath: trackerPath(root) },
      };
    },
  };
}

export async function readCarousels(
  root = process.cwd()
): Promise<CarouselRow[]> {
  return scanContent(carouselsSpec(root));
}
