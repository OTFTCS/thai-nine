import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  patchSocialsRow,
  readTracker,
} from "../../src/lib/creator/tracker-xlsx.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_XLSX = path.resolve(
  here,
  "..",
  "fixtures",
  "creator",
  "thai-nine-project-tracker.xlsx"
);

async function setupTempRoot(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "creator-tracker-"));
  await fs.copyFile(FIXTURE_XLSX, path.join(tmp, "thai-nine-project-tracker.xlsx"));
  return tmp;
}

test("tracker-xlsx: reads every sheet with expected shapes", async () => {
  const root = await setupTempRoot();
  const snapshot = await readTracker(root);

  assert.ok(snapshot.priorities.length > 0, "priorities should not be empty");
  assert.ok(snapshot.lessonPipeline.length > 0, "lesson pipeline should not be empty");
  assert.ok(snapshot.socials.length > 0, "socials should not be empty");

  const dataRows = snapshot.socials.filter((r) => r.kind === "data");
  assert.ok(dataRows.length > 20, "expected many data rows in Socials");

  const sectionRows = snapshot.socials.filter((r) => r.kind === "section");
  assert.ok(sectionRows.length >= 1, "expected at least one section header");
  assert.ok(
    sectionRows.some((r) => r.sectionLabel?.includes("PUBLISHED")),
    "expected PUBLISHED section header"
  );

  const firstDataRow = dataRows[0];
  assert.ok(firstDataRow.num, "data rows should have a number");
  assert.ok(firstDataRow.sectionLabel, "data rows should inherit their section");
});

test("tracker-xlsx: round-trip write updates Socials row and survives re-read", async () => {
  const root = await setupTempRoot();
  const before = await readTracker(root);

  const firstData = before.socials.find((r) => r.kind === "data" && r.status !== "Published");
  // If all rows are Published, just pick any data row.
  const target = firstData ?? before.socials.find((r) => r.kind === "data")!;
  assert.ok(target, "need at least one data row to patch");

  const patch = {
    status: "Published",
    datePosted: "2026-04-19",
    link: "https://example.test/round-trip",
    views: "42",
    likes: "7",
  };
  await patchSocialsRow(target.rowIndex, patch, root);

  const after = await readTracker(root);
  const updated = after.socials.find((r) => r.rowIndex === target.rowIndex)!;
  assert.equal(updated.status, "Published");
  assert.equal(updated.datePosted, "2026-04-19");
  assert.equal(updated.link, "https://example.test/round-trip");
  assert.equal(updated.views, "42");
  assert.equal(updated.likes, "7");

  // Data row count must remain stable (exceljs may trim trailing blanks on write).
  const dataBefore = before.socials.filter((r) => r.kind === "data").length;
  const dataAfter = after.socials.filter((r) => r.kind === "data").length;
  assert.equal(dataAfter, dataBefore);
});

test("tracker-xlsx: refuses to patch a section/blank marker row", async () => {
  const root = await setupTempRoot();
  const snap = await readTracker(root);
  const section = snap.socials.find((r) => r.kind === "section");
  assert.ok(section, "need a section row for this test");
  await assert.rejects(
    () => patchSocialsRow(section!.rowIndex, { status: "Published" }, root),
    /section\/blank/
  );
});
