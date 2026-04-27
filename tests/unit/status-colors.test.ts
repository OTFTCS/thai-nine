import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_OPTIONS,
  statusStyle,
} from "../../src/lib/creator/status-colors.ts";

test("STATUS_OPTIONS includes scriptStatus with NOT_STARTED, DRAFT, APPROVED, RECORDED", () => {
  const options = STATUS_OPTIONS.scriptStatus;
  assert.ok(Array.isArray(options), "scriptStatus options should be an array");
  assert.deepEqual(options, ["NOT_STARTED", "DRAFT", "APPROVED", "RECORDED"]);
});

test("statusStyle returns a non-empty class string for each scriptStatus value", () => {
  for (const value of ["NOT_STARTED", "DRAFT", "APPROVED", "RECORDED"]) {
    const style = statusStyle(value);
    assert.equal(typeof style, "string", `${value} should return a string`);
    assert.ok(style.length > 0, `${value} should return a non-empty class string`);
  }
});

test("statusStyle returns SOMETHING (not empty) for unknown statuses (existing fallback contract preserved)", () => {
  const style = statusStyle("THIS_IS_NOT_A_REAL_STATUS_KEY");
  assert.equal(typeof style, "string");
  assert.ok(
    style.length > 0,
    "fallback style for unknown status should not be empty"
  );
});
