import test from "node:test";
import assert from "node:assert/strict";
import { __test as evalAnnTest } from "../../src/lib/creator/eval-annotations.ts";
import {
  parseCourseSections,
  parseYoutubeBlocks,
} from "../../src/lib/creator/eval-blocks.ts";
import { checkCookie } from "../../src/lib/auth/admin-token.ts";

const { deriveScriptIdFromFile } = evalAnnTest;

test("deriveScriptIdFromFile: course .script.md", () => {
  assert.equal(deriveScriptIdFromFile("course", "M01-L001.script.md"), "M01-L001");
  assert.equal(deriveScriptIdFromFile("course", "M10-L001.script.md"), "M10-L001");
});

test("deriveScriptIdFromFile: youtube .json", () => {
  assert.equal(deriveScriptIdFromFile("youtube", "YT-S01-E05.json"), "YT-S01-E05");
});

test("deriveScriptIdFromFile: ignores wrong suffix and underscore-prefixed", () => {
  assert.equal(deriveScriptIdFromFile("course", "M01-L001.json"), null);
  assert.equal(deriveScriptIdFromFile("course", "_runlog.txt"), null);
  assert.equal(deriveScriptIdFromFile("course", "M01-L001.stderr.log"), null);
});

test("parseYoutubeBlocks: extracts id + mode from blocks[]", () => {
  const raw = JSON.stringify({
    schemaVersion: 2,
    blocks: [
      {
        id: "b-001",
        mode: "hook",
        speakerNote: "Energetic, look to camera.",
        lines: [{ thai: "สวัสดี", display: "Hi" }],
      },
      { id: "b-002", mode: "explain", speakerNote: "Cultural opener." },
    ],
  });
  const blocks = parseYoutubeBlocks(raw);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].id, "b-001");
  assert.equal(blocks[0].label, "hook");
  assert.match(blocks[0].preview, /Energetic/);
  assert.equal(blocks[1].id, "b-002");
  assert.equal(blocks[1].label, "explain");
});

test("parseYoutubeBlocks: empty / malformed input returns []", () => {
  assert.deepEqual(parseYoutubeBlocks(""), []);
  assert.deepEqual(parseYoutubeBlocks("not json"), []);
  assert.deepEqual(parseYoutubeBlocks(JSON.stringify({})), []);
  assert.deepEqual(parseYoutubeBlocks(JSON.stringify({ blocks: "nope" })), []);
});

test("parseCourseSections: extracts id + heading from script-master.json fence", () => {
  const raw = `## brief.md

Some prose.

## script-master.json

\`\`\`json
{
  "schemaVersion": 1,
  "lessonId": "M01-L001",
  "sections": [
    { "id": "S01", "heading": "Three Core Words", "purpose": "Introduce the core triplet." },
    { "id": "S02", "heading": "Polite Particles", "purpose": "Explain ครับ/ค่ะ." }
  ]
}
\`\`\`

## script-spoken.md

More prose.`;
  const blocks = parseCourseSections(raw);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].id, "S01");
  assert.equal(blocks[0].label, "Three Core Words");
  assert.match(blocks[0].preview, /Introduce/);
});

test("parseCourseSections: returns [] when fence missing", () => {
  assert.deepEqual(parseCourseSections("# Just a doc\n\nNo fence here."), []);
});

test("parseCourseSections: tolerates malformed JSON inside fence", () => {
  const raw = `## script-master.json\n\n\`\`\`json\n{ not json }\n\`\`\`\n`;
  assert.deepEqual(parseCourseSections(raw), []);
});

test("checkCookie: missing token env var = no-token-configured (operator misconfig, surface as 500)", () => {
  const got = checkCookie("anything", undefined);
  assert.deepEqual(got, { ok: false, reason: "no-token-configured" });
});

test("checkCookie: missing cookie when token is configured = missing-cookie (403)", () => {
  const got = checkCookie(undefined, "secret");
  assert.deepEqual(got, { ok: false, reason: "missing-cookie" });
});

test("checkCookie: bad cookie = bad-cookie (403)", () => {
  const got = checkCookie("wrong", "secret");
  assert.deepEqual(got, { ok: false, reason: "bad-cookie" });
});

test("checkCookie: matching cookie = ok", () => {
  const got = checkCookie("secret", "secret");
  assert.deepEqual(got, { ok: true });
});
