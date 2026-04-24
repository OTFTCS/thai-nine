import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptPayPayload, crc16Ccitt } from "../../src/lib/promptpay.ts";

function parseTlv(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    const value = payload.slice(i + 4, i + 4 + len);
    out[tag] = value;
    i += 4 + len;
  }
  return out;
}

test("CRC-16/CCITT-FALSE matches the canonical check vector for '123456789'", () => {
  assert.equal(crc16Ccitt("123456789"), "29B1");
});

test("dynamic phone QR has the expected structure and valid CRC", () => {
  const payload = buildPromptPayPayload({
    id: "0891234567",
    idType: "phone",
    amount: 100,
  });

  assert.equal(payload.length >= 4, true);
  const body = payload.slice(0, -4);
  const crc = payload.slice(-4);

  assert.equal(crc16Ccitt(body), crc);

  const top = parseTlv(body.slice(0, -4));
  assert.equal(top["00"], "01");
  assert.equal(top["01"], "12");
  assert.equal(top["53"], "764");
  assert.equal(top["54"], "100.00");
  assert.equal(top["58"], "TH");

  const merchant = parseTlv(top["29"]);
  assert.equal(merchant["00"], "A000000677010111");
  assert.equal(merchant["01"], "0066891234567");
});

test("static phone QR (no amount) has init method '11' and omits tag 54", () => {
  const payload = buildPromptPayPayload({
    id: "0891234567",
    idType: "phone",
  });

  const body = payload.slice(0, -4);
  const top = parseTlv(body.slice(0, -4));
  assert.equal(top["01"], "11");
  assert.equal(top["54"], undefined);
});

test("NID QR uses subtag 02 with 13 digits", () => {
  const payload = buildPromptPayPayload({
    id: "1234567890123",
    idType: "nid",
    amount: 500,
  });

  const body = payload.slice(0, -4);
  const top = parseTlv(body.slice(0, -4));
  const merchant = parseTlv(top["29"]);
  assert.equal(merchant["02"], "1234567890123");
  assert.equal(merchant["01"], undefined);
});

test("phone input tolerates spaces, dashes, and country prefix", () => {
  const plain = buildPromptPayPayload({ id: "0891234567", idType: "phone" });
  const dashed = buildPromptPayPayload({ id: "089-123-4567", idType: "phone" });
  const spaced = buildPromptPayPayload({ id: "089 123 4567", idType: "phone" });
  const prefixed = buildPromptPayPayload({ id: "+66891234567", idType: "phone" });

  assert.equal(plain, dashed);
  assert.equal(plain, spaced);
  assert.equal(plain, prefixed);
});

test("amount is formatted with two decimal places", () => {
  const payload = buildPromptPayPayload({
    id: "0891234567",
    idType: "phone",
    amount: 1,
  });
  const body = payload.slice(0, -4);
  const top = parseTlv(body.slice(0, -4));
  assert.equal(top["54"], "1.00");
});

test("different amounts produce different CRCs", () => {
  const a = buildPromptPayPayload({ id: "0891234567", idType: "phone", amount: 100 });
  const b = buildPromptPayPayload({ id: "0891234567", idType: "phone", amount: 200 });
  assert.notEqual(a, b);
  assert.notEqual(a.slice(-4), b.slice(-4));
});

test("invalid NID (not 13 digits) throws", () => {
  assert.throws(() => buildPromptPayPayload({ id: "1234567", idType: "nid" }), /13_digits/);
});

test("zero or negative amount throws", () => {
  assert.throws(
    () => buildPromptPayPayload({ id: "0891234567", idType: "phone", amount: 0 }),
    /positive/,
  );
  assert.throws(
    () => buildPromptPayPayload({ id: "0891234567", idType: "phone", amount: -5 }),
    /positive/,
  );
});

test("short phone throws", () => {
  assert.throws(() => buildPromptPayPayload({ id: "123", idType: "phone" }), /too_short/);
});
