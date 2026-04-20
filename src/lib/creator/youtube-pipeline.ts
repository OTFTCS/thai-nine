import { promises as fs } from "node:fs";
import path from "node:path";
import {
  pathExists,
  scanContent,
  type ArtifactSpec,
  type ContentTypeSpec,
} from "@/lib/creator/content-scanner";
import { fetchYouTubeUploadedIds } from "@/lib/creator/youtube-api";
import type {
  YouTubeEpisode,
  YouTubeInventory,
  YouTubeRow,
} from "@/types/creator";

const EPISODE_PATTERN = /^YT-S01-E(\d{2,})$/;

// Local fallback used only when YOUTUBE_API_KEY is unset. Once the real API is
// wired up, delete entries from this set as episodes go public on YouTube.
const RECORDED_IDS_FALLBACK = new Set([
  "YT-S01-E01",
  "YT-S01-E02",
  "YT-S01-E03",
]);

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function orNull(p: string): Promise<string | null> {
  return (await pathExists(p)) ? p : null;
}

function episodePaths(root: string, id: string) {
  const dir = path.join(root, "youtube", "out", id);
  return {
    dir,
    scenePath: path.join(dir, `${id}-scene.py`),
    basePath: path.join(dir, "scene_base.py"),
    backgroundPath: path.join(dir, `${id}-background.mp4`),
    finalPath: path.join(dir, `${id}-final.mp4`),
    recordingPath: path.join(root, "youtube", "recordings", `${id}.m4a`),
    imagesDirPath: path.join(root, "youtube", "images", id),
    qaReportPath: path.join(dir, "qa-report.json"),
  };
}

export async function readYouTubeInventory(
  root = process.cwd()
): Promise<YouTubeInventory> {
  const outDir = path.join(root, "youtube", "out");
  const apiSet = await fetchYouTubeUploadedIds(root);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(outDir);
  } catch {
    return {
      episodes: [],
      recordedIds: Array.from(
        new Set([...apiSet, ...RECORDED_IDS_FALLBACK])
      ).sort(),
      nextEpisode: null,
    };
  }

  const episodes: YouTubeEpisode[] = [];

  for (const name of entries) {
    if (!EPISODE_PATTERN.test(name)) continue;
    const paths = episodePaths(root, name);
    const stat = await fs.stat(paths.dir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const [scene, base, bg, fin, rec, imgs, qa] = await Promise.all([
      orNull(paths.scenePath),
      orNull(paths.basePath),
      orNull(paths.backgroundPath),
      orNull(paths.finalPath),
      orNull(paths.recordingPath),
      orNull(paths.imagesDirPath),
      orNull(paths.qaReportPath),
    ]);

    let qaReport: unknown = null;
    if (qa) {
      const raw = await readIfExists(qa);
      if (raw) {
        try {
          qaReport = JSON.parse(raw);
        } catch {
          qaReport = { _parseError: "Invalid JSON", raw: raw.slice(0, 200) };
        }
      }
    }

    episodes.push({
      episodeId: name,
      dir: paths.dir,
      scenePath: scene,
      basePath: base,
      backgroundPath: bg,
      finalPath: fin,
      recordingPath: rec,
      imagesDirPath: imgs,
      qaReportPath: qa,
      qaReport,
      sceneSource: null,
      recorded: apiSet.has(name) || RECORDED_IDS_FALLBACK.has(name),
    });
  }

  episodes.sort((a, b) => a.episodeId.localeCompare(b.episodeId));

  const nextEpisode =
    episodes.find((ep) => !ep.recorded && ep.scenePath !== null) ?? null;

  if (nextEpisode && nextEpisode.scenePath) {
    nextEpisode.sceneSource = await readIfExists(nextEpisode.scenePath);
  }

  return {
    episodes,
    recordedIds: episodes.filter((e) => e.recorded).map((e) => e.episodeId),
    nextEpisode,
  };
}

function youtubeArtifactSpecs(root: string): ArtifactSpec[] {
  const nullOrPath = (p: string) => (p ? p : null);
  return [
    {
      key: "scene",
      label: "Scene",
      icon: "py",
      resolve: (id) => nullOrPath(episodePaths(root, id).scenePath),
    },
    {
      key: "sceneBase",
      label: "Base",
      icon: "py",
      resolve: (id) => nullOrPath(episodePaths(root, id).basePath),
    },
    {
      key: "background",
      label: "Background",
      icon: "mp4",
      resolve: (id) => nullOrPath(episodePaths(root, id).backgroundPath),
    },
    {
      key: "final",
      label: "Final Video",
      icon: "mp4",
      resolve: (id) => nullOrPath(episodePaths(root, id).finalPath),
    },
    {
      key: "recording",
      label: "Recording",
      icon: "m4a",
      resolve: (id) => nullOrPath(episodePaths(root, id).recordingPath),
    },
    {
      key: "imagesDir",
      label: "Images",
      icon: "dir",
      resolve: (id) => nullOrPath(episodePaths(root, id).imagesDirPath),
    },
    {
      key: "qaReport",
      label: "QA Report",
      icon: "json",
      resolve: (id) => nullOrPath(episodePaths(root, id).qaReportPath),
    },
  ];
}

export function youtubeSpec(
  root = process.cwd()
): ContentTypeSpec<{ recorded: boolean }> {
  // Fetch once per spec() call; shared across all build() invocations.
  const apiSetPromise = fetchYouTubeUploadedIds(root);

  return {
    kind: "youtube",
    scan: async () => {
      const outDir = path.join(root, "youtube", "out");
      const items: Array<{ id: string; dir: string }> = [];
      let entries: string[] = [];
      try {
        entries = await fs.readdir(outDir);
      } catch {
        return items;
      }
      for (const name of entries) {
        if (!EPISODE_PATTERN.test(name)) continue;
        const dir = path.join(outDir, name);
        const stat = await fs.stat(dir).catch(() => null);
        if (!stat?.isDirectory()) continue;
        items.push({ id: name, dir });
      }
      items.sort((a, b) => a.id.localeCompare(b.id));
      return items;
    },
    artifacts: youtubeArtifactSpecs(root),
    build: async (id) => {
      const apiSet = await apiSetPromise;
      const uploaded = apiSet.has(id);
      const recorded = uploaded || RECORDED_IDS_FALLBACK.has(id);
      const status = uploaded
        ? "UPLOADED"
        : recorded
          ? "RECORDED"
          : "PENDING";
      return {
        title: id,
        status,
        meta: { recorded },
      };
    },
  };
}

export async function readYouTubeRows(
  root = process.cwd()
): Promise<YouTubeRow[]> {
  return scanContent(youtubeSpec(root));
}
