import test from "node:test";
import assert from "node:assert/strict";
import { fetchTikTokPublishedTitles } from "../../src/lib/creator/tiktok-api.ts";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchHandler = (input: FetchInput, init?: FetchInit) => Promise<Response>;

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

function installFetch(handler: FetchHandler): void {
  globalThis.fetch = handler as typeof fetch;
}

function restore(): void {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_TOKEN === undefined) delete process.env.TIKTOK_ACCESS_TOKEN;
  else process.env.TIKTOK_ACCESS_TOKEN = ORIGINAL_TOKEN;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("tiktok-api: missing token returns empty set", async (t) => {
  delete process.env.TIKTOK_ACCESS_TOKEN;
  let called = false;
  installFetch(async () => {
    called = true;
    return jsonResponse({});
  });
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 0);
  assert.equal(called, false, "fetch must not be called when token is missing");
});

test("tiktok-api: 401 response returns empty set", async (t) => {
  process.env.TIKTOK_ACCESS_TOKEN = "bad-token";
  installFetch(async () => jsonResponse({ error: { code: "unauthorized" } }, 401));
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 0);
});

test("tiktok-api: 200 with videos returns normalized titles", async (t) => {
  process.env.TIKTOK_ACCESS_TOKEN = "good-token";
  installFetch(async () =>
    jsonResponse({
      data: {
        videos: [
          { id: "1", title: "Thai Classifiers EP01 Overview" },
          { id: "2", title: "  Thai Classifiers EP02 Khon  " },
          { id: "3", title: "" },
        ],
        has_more: false,
      },
    })
  );
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 2);
  assert.ok(result.has("thai classifiers ep01 overview"));
  assert.ok(result.has("thai classifiers ep02 khon"));
});

test("tiktok-api: paginates via cursor until has_more=false", async (t) => {
  process.env.TIKTOK_ACCESS_TOKEN = "good-token";
  const cursorsSeen: (number | undefined)[] = [];
  let call = 0;
  installFetch(async (_url, init) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      cursor?: number;
    };
    cursorsSeen.push(body.cursor);
    call += 1;
    if (call === 1) {
      return jsonResponse({
        data: {
          videos: [{ title: "Page1-Vid1" }],
          cursor: 100,
          has_more: true,
        },
      });
    }
    if (call === 2) {
      return jsonResponse({
        data: {
          videos: [{ title: "Page2-Vid1" }],
          cursor: 200,
          has_more: true,
        },
      });
    }
    return jsonResponse({
      data: {
        videos: [{ title: "Page3-Vid1" }],
        has_more: false,
      },
    });
  });
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 3);
  assert.ok(result.has("page1-vid1"));
  assert.ok(result.has("page2-vid1"));
  assert.ok(result.has("page3-vid1"));
  assert.deepEqual(cursorsSeen, [undefined, 100, 200]);
});

test("tiktok-api: network error returns empty set (no throw)", async (t) => {
  process.env.TIKTOK_ACCESS_TOKEN = "good-token";
  installFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 0);
});

test("tiktok-api: malformed JSON returns empty set", async (t) => {
  process.env.TIKTOK_ACCESS_TOKEN = "good-token";
  installFetch(async () => new Response("not json at all", { status: 200 }));
  t.after(restore);

  const result = await fetchTikTokPublishedTitles();
  assert.equal(result.size, 0);
});
