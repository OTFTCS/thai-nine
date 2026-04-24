import test from "node:test";
import assert from "node:assert/strict";
import { defaultCurrencyForCountry } from "../../src/lib/currency.ts";

test("TH maps to THB", () => {
  assert.equal(defaultCurrencyForCountry("TH"), "THB");
});

test("lowercase 'th' maps to THB", () => {
  assert.equal(defaultCurrencyForCountry("th"), "THB");
});

test("padded 'TH ' maps to THB", () => {
  assert.equal(defaultCurrencyForCountry(" TH "), "THB");
});

test("non-TH country codes map to USD", () => {
  assert.equal(defaultCurrencyForCountry("US"), "USD");
  assert.equal(defaultCurrencyForCountry("GB"), "USD");
  assert.equal(defaultCurrencyForCountry("JP"), "USD");
});

test("null defaults to USD", () => {
  assert.equal(defaultCurrencyForCountry(null), "USD");
});

test("undefined defaults to USD", () => {
  assert.equal(defaultCurrencyForCountry(undefined), "USD");
});

test("empty string defaults to USD", () => {
  assert.equal(defaultCurrencyForCountry(""), "USD");
});
