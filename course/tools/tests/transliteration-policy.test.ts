import test from "node:test";
import assert from "node:assert/strict";
import { checkTransliterationPolicy, repairTransliteration } from "../lib/transliteration-policy.ts";

test("passes valid PTM transliteration", () => {
  const result = checkTransliterationPolicy("khǎaw-thôot", true);
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test("rejects IPA symbols", () => {
  const result = checkTransliterationPolicy("kʰaːw", true);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "forbidden-symbol"));
});

test("repairs legacy trailing tone suffix", () => {
  const repaired = repairTransliteration("khawL");
  assert.equal(repaired.value, "khàw");
  assert.equal(repaired.changed, true);
  assert.ok(repaired.autoFixes.some((note) => note.includes("trailing tone")));
});

test("repairs superscript tone markers", () => {
  const repaired = repairTransliteration("khawᴿ");
  assert.equal(repaired.value, "khǎw");
  assert.equal(repaired.manualReview.length, 0);
});

test("flags uncertain schwa conversion for manual review", () => {
  const repaired = repairTransliteration("kəm");
  assert.equal(repaired.value.includes("er"), true);
  assert.ok(repaired.manualReview.some((note) => note.includes("verify meaning manually")));
});
