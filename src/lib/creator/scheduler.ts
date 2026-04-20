import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ScheduledPost, ScheduledPostStatus } from "@/types/creator";
import { publishToInstagram, publishToTikTok } from "./social-api";

const STORE_REL = path.join("course", "exports", "scheduled-posts.json");

function storePath(root = process.cwd()): string {
  return path.join(root, STORE_REL);
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readStore(root = process.cwd()): Promise<ScheduledPost[]> {
  const filePath = storePath(root);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ScheduledPost[];
    return [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeStore(posts: ScheduledPost[], root = process.cwd()): Promise<void> {
  const filePath = storePath(root);
  await ensureDir(filePath);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(posts, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export interface ScheduleInput {
  socialsRowIndex: number | null;
  title: string;
  platforms: string[];
  caption: string;
  mediaRef?: string | null;
  scheduledFor: string;
}

export async function schedulePost(
  input: ScheduleInput,
  root = process.cwd()
): Promise<ScheduledPost> {
  const posts = await readStore(root);
  const post: ScheduledPost = {
    id: randomUUID(),
    socialsRowIndex: input.socialsRowIndex,
    title: input.title,
    platforms: input.platforms,
    caption: input.caption,
    mediaRef: input.mediaRef ?? null,
    scheduledFor: input.scheduledFor,
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  posts.push(post);
  await writeStore(posts, root);
  return post;
}

export async function listScheduledPosts(root = process.cwd()): Promise<ScheduledPost[]> {
  return readStore(root);
}

async function dispatch(post: ScheduledPost): Promise<void> {
  const errors: string[] = [];
  for (const platform of post.platforms) {
    try {
      if (platform.toLowerCase() === "ig") {
        await publishToInstagram({ caption: post.caption, mediaUrl: post.mediaRef ?? null });
      } else if (platform.toLowerCase() === "tt") {
        await publishToTikTok({ caption: post.caption, videoUrl: post.mediaRef ?? null });
      } else if (platform.toLowerCase() === "yt") {
        // YouTube upload not wired in this milestone; treat as dry-run success.
      } else {
        errors.push(`Unknown platform: ${platform}`);
      }
    } catch (err) {
      errors.push(`${platform}: ${(err as Error).message}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
}

export async function runDuePosts(
  now = new Date(),
  root = process.cwd()
): Promise<{ processed: number; done: number; failed: number }> {
  const posts = await readStore(root);
  let processed = 0;
  let done = 0;
  let failed = 0;
  let mutated = false;

  for (const post of posts) {
    if (post.status !== "pending") continue;
    const due = new Date(post.scheduledFor);
    if (Number.isNaN(due.getTime()) || due.getTime() > now.getTime()) continue;
    processed += 1;
    post.attempts += 1;
    try {
      await dispatch(post);
      post.status = "done" satisfies ScheduledPostStatus;
      post.completedAt = new Date().toISOString();
      post.lastError = null;
      done += 1;
    } catch (err) {
      post.status = "failed" satisfies ScheduledPostStatus;
      post.lastError = (err as Error).message;
      failed += 1;
    }
    mutated = true;
  }

  if (mutated) await writeStore(posts, root);
  return { processed, done, failed };
}
