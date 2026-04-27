import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatPartPreview,
  formatTeleprompter,
} from "../../src/lib/creator/youtube-teleprompter.ts";
import type { ScriptFile } from "../../src/lib/creator/youtube-script.ts";
import type { Block } from "../../src/lib/creator/youtube-script-parts.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(here, "..", "..");
const EXAMPLES_DIR = path.join(PROJECT_ROOT, "youtube", "examples");

function loadEpisode(episodeId: string): ScriptFile {
  const file = path.join(EXAMPLES_DIR, `${episodeId}.json`);
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as ScriptFile;
}

test("formatTeleprompter starts with the episode title heading (E01 fixture)", () => {
  const script = loadEpisode("YT-S01-E01");
  const output = formatTeleprompter(script);
  assert.ok(
    output.startsWith("# YT-S01-E01 "),
    `expected output to start with '# YT-S01-E01 ', got: ${output.slice(0, 80)}`
  );
  // The title heading is followed by a blank line and then a block heading.
  assert.match(output, /^# YT-S01-E01 [^\n]+\n\n## /);
});

test("formatTeleprompter emits one block heading per non-empty block (E01 fixture)", () => {
  const script = loadEpisode("YT-S01-E01");
  const output = formatTeleprompter(script);
  const headingMatches = output.match(/^## /gm) ?? [];
  // Allow a small slack: every block in the fixture should produce a heading,
  // and there are no synthetic non-spoken blocks in E01.
  assert.equal(
    headingMatches.length,
    script.blocks.length,
    `expected ${script.blocks.length} block headings, got ${headingMatches.length}`
  );
});

test("formatTeleprompter skips translit lines but keeps the Thai", () => {
  const script: ScriptFile = {
    schemaVersion: 2,
    episodeId: "YT-S01-E99",
    title: "Test Episode",
    blocks: [
      {
        id: "b-001",
        mode: "vocab-card",
        lines: [
          { id: "l-001", lang: "th", thai: "สวัสดีค่ะ", spoken: true },
          {
            id: "l-002",
            lang: "translit",
            translit: "sa-wàt-dii khâ",
            spoken: true,
          },
        ],
      },
    ],
  };
  const output = formatTeleprompter(script);
  assert.ok(output.includes("สวัสดีค่ะ"), "Thai line must be present");
  assert.ok(
    !output.includes("sa-wàt-dii khâ"),
    "translit line must not be present"
  );
});

test("formatTeleprompter prefixes hook lines with [A] / [B] when speaker is set", () => {
  const script: ScriptFile = {
    schemaVersion: 2,
    episodeId: "YT-S01-E99",
    title: "Sketch Test",
    blocks: [
      {
        id: "b-001",
        mode: "hook",
        lines: [
          {
            id: "l-001",
            lang: "th",
            thai: "ทดสอบเอ",
            speaker: "A",
            spoken: true,
          },
          {
            id: "l-002",
            lang: "th",
            thai: "ทดสอบบี",
            speaker: "B",
            spoken: true,
          },
        ],
      },
    ],
  };
  const output = formatTeleprompter(script);
  assert.ok(output.includes("**[A]** ทดสอบเอ"), "expected [A] prefix");
  assert.ok(output.includes("**[B]** ทดสอบบี"), "expected [B] prefix");
});

test("formatTeleprompter renders speakerNote as italic blockquote", () => {
  const script: ScriptFile = {
    schemaVersion: 2,
    episodeId: "YT-S01-E99",
    title: "Note Test",
    blocks: [
      {
        id: "b-001",
        mode: "explain",
        speakerNote: "Pause here",
        lines: [
          { id: "l-001", lang: "en", english: "Hello world.", spoken: true },
        ],
      },
    ],
  };
  const output = formatTeleprompter(script);
  assert.ok(
    output.includes("> _Speaker note: Pause here_"),
    "expected italic blockquote speaker note"
  );
});

test("formatTeleprompter skips lines where spoken is false", () => {
  const script: ScriptFile = {
    schemaVersion: 2,
    episodeId: "YT-S01-E99",
    title: "Spoken Filter Test",
    blocks: [
      {
        id: "b-001",
        mode: "hook",
        lines: [
          { id: "l-001", lang: "th", thai: "เงียบไม่พูด", spoken: false },
          { id: "l-002", lang: "en", english: "Hello", spoken: true },
        ],
      },
    ],
  };
  const output = formatTeleprompter(script);
  assert.ok(output.includes("Hello"), "spoken English line should appear");
  assert.ok(
    !output.includes("เงียบไม่พูด"),
    "non-spoken Thai line must be skipped"
  );
});

test("formatPartPreview omits the top-level title heading", () => {
  const blocks: Block[] = [
    {
      id: "b-001",
      mode: "hook",
      lines: [
        { id: "l-001", lang: "th", thai: "สวัสดี", spoken: true },
      ],
    },
  ];
  const output = formatPartPreview(blocks);
  assert.ok(
    !/^# YT-S01-/.test(output),
    "preview should not include the YT-S01 title heading"
  );
  // First non-empty line should be a block heading.
  const firstLine = output.split("\n").find((l) => l.length > 0) ?? "";
  assert.ok(
    firstLine.startsWith("## "),
    `expected first line to be a block heading, got: ${firstLine}`
  );
});
