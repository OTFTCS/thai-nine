import test from "node:test";
import assert from "node:assert/strict";
import { fetchYouTubeUploadedIds } from "../../src/lib/creator/youtube-api.ts";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchHandler = (input: FetchInput, init?: FetchInit) => Promise<Response>;

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = [
  "YOUTUBE_API_KEY",
  "YOUTUBE_CHANNEL_ID",
  "YOUTUBE_OAUTH_TOKEN",
] as const;
const ORIGINAL_ENV: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID,
  YOUTUBE_OAUTH_TOKEN: process.env.YOUTUBE_OAUTH_TOKEN,
};

function installFetch(handler: FetchHandler): void {
  globalThis.fetch = handler as typeof fetch;
}

function restore(): void {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("youtube-api: missing API key returns empty set", async (t) => {
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_OAUTH_TOKEN;
  delete process.env.YOUTUBE_CHANNEL_ID;
  let called = false;
  installFetch(async () => {
    called = true;
    return jsonResponse({});
  });
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.equal(result.size, 0);
  assert.equal(called, false);
});

test("youtube-api: missing channel id returns empty set", async (t) => {
  process.env.YOUTUBE_API_KEY = "key";
  delete process.env.YOUTUBE_CHANNEL_ID;
  let called = false;
  installFetch(async () => {
    called = true;
    return jsonResponse({});
  });
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.equal(result.size, 0);
  assert.equal(called, false);
});

test("youtube-api: extracts YT-S01-EXX ids from titles and descriptions", async (t) => {
  process.env.YOUTUBE_API_KEY = "key";
  process.env.YOUTUBE_CHANNEL_ID = "UC123";
  installFetch(async (url) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("/channels?")) {
      return jsonResponse({
        items: [
          {
            contentDetails: {
              relatedPlaylists: { uploads: "UU123" },
            },
          },
        ],
      });
    }
    if (href.includes("/playlistItems?")) {
      return jsonResponse({
        items: [
          {
            snippet: {
              title: "Thai Lesson YT-S01-E04 | Tones deep dive",
              description: "See also YT-S01-E05",
            },
          },
          {
            snippet: {
              title: "Unrelated video",
              description: "",
            },
          },
        ],
      });
    }
    throw new Error(`Unexpected URL: ${href}`);
  });
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.deepEqual(
    Array.from(result).sort(),
    ["YT-S01-E04", "YT-S01-E05"]
  );
});

test("youtube-api: 403 on playlistItems returns empty set", async (t) => {
  process.env.YOUTUBE_API_KEY = "key";
  process.env.YOUTUBE_CHANNEL_ID = "UC123";
  installFetch(async (url) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("/channels?")) {
      return jsonResponse({
        items: [
          { contentDetails: { relatedPlaylists: { uploads: "UU123" } } },
        ],
      });
    }
    return jsonResponse({ error: { code: 403, message: "quotaExceeded" } }, 403);
  });
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.equal(result.size, 0);
});

test("youtube-api: channels lookup missing uploads returns empty set", async (t) => {
  process.env.YOUTUBE_API_KEY = "key";
  process.env.YOUTUBE_CHANNEL_ID = "UC123";
  installFetch(async () => jsonResponse({ items: [] }));
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.equal(result.size, 0);
});

test("youtube-api: network error returns empty set", async (t) => {
  process.env.YOUTUBE_API_KEY = "key";
  process.env.YOUTUBE_CHANNEL_ID = "UC123";
  installFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  t.after(restore);

  const result = await fetchYouTubeUploadedIds();
  assert.equal(result.size, 0);
});
