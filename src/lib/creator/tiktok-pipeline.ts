import { promises as fs } from "node:fs";
import path from "node:path";
import {
  pathExists,
  scanContent,
  type ArtifactSpec,
  type ContentTypeSpec,
} from "@/lib/creator/content-scanner";
import { fetchTikTokPublishedTitles } from "@/lib/creator/tiktok-api";
import type {
  SocialsRow,
  TikTokEpisodeRow,
  TikTokSeriesStatus,
} from "@/types/creator";

const EPISODE_SCRIPT_PATTERN = /^episode-(\d+)-([a-z0-9-]+)\.md$/;

export async function readTikTokPipeline(
  _socials: SocialsRow[],
  root = process.cwd()
): Promise<TikTokSeriesStatus[]> {
  const seriesRoot = path.join(root, "thai_with_nine_tiktok", "series");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(seriesRoot);
  } catch {
    return [];
  }

  const publishedTitles = await fetchTikTokPublishedTitles(root);
  const statuses: TikTokSeriesStatus[] = [];

  for (const slug of entries) {
    const seriesDir = path.join(seriesRoot, slug);
    const stat = await fs.stat(seriesDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const scriptsDir = path.join(seriesDir, "scripts");
    let scripted = 0;
    try {
      const files = await fs.readdir(scriptsDir);
      scripted = files.filter((f) => /^episode-\d+.*\.md$/.test(f)).length;
    } catch {
      scripted = 0;
    }

    // Count API-confirmed published videos matching this series slug.
    const slugLower = slug.toLowerCase();
    const published = [...publishedTitles].filter((t) =>
      t.includes(slugLower)
    ).length;

    statuses.push({
      series: slug,
      episodesOnDisk: scripted,
      scripted,
      rendered: 0,
      published,
    });
  }

  return statuses;
}

interface EpisodeScript {
  series: string;
  epNum: number;
  slug: string;
  scriptPath: string;
  scriptFilename: string;
}

async function listEpisodeScripts(root: string): Promise<EpisodeScript[]> {
  const seriesRoot = path.join(root, "thai_with_nine_tiktok", "series");
  const scripts: EpisodeScript[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(seriesRoot);
  } catch {
    return scripts;
  }
  for (const series of entries) {
    const seriesDir = path.join(seriesRoot, series);
    const stat = await fs.stat(seriesDir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const scriptsDir = path.join(seriesDir, "scripts");
    let files: string[] = [];
    try {
      files = await fs.readdir(scriptsDir);
    } catch {
      continue;
    }
    for (const file of files) {
      const m = EPISODE_SCRIPT_PATTERN.exec(file);
      if (!m) continue;
      scripts.push({
        series,
        epNum: Number(m[1]),
        slug: m[2],
        scriptPath: path.join(scriptsDir, file),
        scriptFilename: file,
      });
    }
  }
  scripts.sort((a, b) =>
    a.series === b.series ? a.epNum - b.epNum : a.series.localeCompare(b.series)
  );
  return scripts;
}

async function listOutDirs(root: string): Promise<string[]> {
  const outRoot = path.join(root, "thai_with_nine_tiktok", "out");
  try {
    const entries = await fs.readdir(outRoot);
    return entries
      .filter((name) => name === "tiktok" || name.startsWith("tiktok-ep"))
      .map((name) => path.join(outRoot, name));
  } catch {
    return [];
  }
}

function isEpisodeDir(dirName: string, epNum: number): boolean {
  if (dirName === "tiktok") return epNum === 1;
  const epPadded = String(epNum).padStart(2, "0");
  return dirName === `tiktok-ep${epPadded}` || dirName.startsWith(`tiktok-ep${epPadded}-v`);
}

function versionOf(dirName: string): number {
  if (dirName === "tiktok") return 1;
  const m = /-v(\d+)$/.exec(dirName);
  return m ? Number(m[1]) : 0;
}

async function resolveNewestArtifact(
  root: string,
  epNum: number,
  slug: string,
  filename: string
): Promise<string | null> {
  const outDirs = await listOutDirs(root);
  const candidates: { path: string; version: number }[] = [];
  for (const dir of outDirs) {
    const base = path.basename(dir);
    if (!isEpisodeDir(base, epNum)) continue;
    const candidate = path.join(dir, filename);
    if (await pathExists(candidate)) {
      candidates.push({ path: candidate, version: versionOf(base) });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.version - a.version);
  return candidates[0].path;
}

function tiktokArtifactSpecs(root: string): ArtifactSpec[] {
  const parseId = (id: string) => {
    const [series, epStr, ...slugParts] = id.split("::");
    return { series, epNum: Number(epStr), slug: slugParts.join("::") };
  };
  return [
    {
      key: "script",
      label: "Script",
      icon: "md",
      resolve: (id) => {
        const { series, epNum, slug } = parseId(id);
        const padded = String(epNum).padStart(2, "0");
        return path.join(
          root,
          "thai_with_nine_tiktok",
          "series",
          series,
          "scripts",
          `episode-${padded}-${slug}.md`
        );
      },
    },
    {
      key: "beatsheet",
      label: "Beatsheet",
      icon: "json",
      resolve: (id) => {
        const { epNum, slug } = parseId(id);
        const padded = String(epNum).padStart(2, "0");
        return resolveNewestArtifact(
          root,
          epNum,
          slug,
          `episode-${padded}-${slug}-beatsheet.json`
        );
      },
    },
    {
      key: "scene",
      label: "Scene",
      icon: "py",
      resolve: (id) => {
        const { epNum, slug } = parseId(id);
        const padded = String(epNum).padStart(2, "0");
        return resolveNewestArtifact(
          root,
          epNum,
          slug,
          `episode-${padded}-${slug}-scene.py`
        );
      },
    },
    {
      key: "final",
      label: "Final Video",
      icon: "mp4",
      resolve: (id) => {
        const { epNum, slug } = parseId(id);
        const padded = String(epNum).padStart(2, "0");
        return resolveNewestArtifact(
          root,
          epNum,
          slug,
          `episode-${padded}-${slug}-final.mp4`
        );
      },
    },
    {
      key: "recording",
      label: "Raw Recording",
      icon: "mov",
      resolve: (id) => {
        const { epNum } = parseId(id);
        const padded = String(epNum).padStart(2, "0");
        return path.join(
          root,
          "thai_with_nine_tiktok",
          "media",
          "input",
          `episode-${padded}-recording.mov`
        );
      },
    },
  ];
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function tiktokSpec(root = process.cwd()): ContentTypeSpec<{
  series: string;
  epNum: number;
  published: boolean;
}> {
  // Fetch once per spec() call; all build(id) invocations share the same promise.
  const publishedTitlesPromise = fetchTikTokPublishedTitles(root);

  return {
    kind: "tiktok",
    scan: async () => {
      const scripts = await listEpisodeScripts(root);
      return scripts.map((s) => ({
        id: `${s.series}::${s.epNum}::${s.slug}`,
        dir: path.dirname(s.scriptPath),
      }));
    },
    artifacts: tiktokArtifactSpecs(root),
    build: async (id) => {
      const [series, epStr, ...slugParts] = id.split("::");
      const epNum = Number(epStr);
      const slug = slugParts.join("::");
      const publishedTitles = await publishedTitlesPromise;
      const epTag = `ep${String(epNum).padStart(2, "0")}`;
      const slugLower = slug.toLowerCase();
      const published = [...publishedTitles].some(
        (t) => t.includes(slugLower) || t.includes(epTag)
      );
      const status =
        publishedTitles.size === 0 ? "UNKNOWN" : published ? "PUBLISHED" : "DRAFT";
      return {
        title: titleFromSlug(slug),
        status,
        meta: { series, epNum, published },
      };
    },
  };
}

export async function readTikTokEpisodes(
  root = process.cwd()
): Promise<TikTokEpisodeRow[]> {
  return scanContent(tiktokSpec(root));
}
