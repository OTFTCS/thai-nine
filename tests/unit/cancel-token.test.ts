import test from "node:test";
import assert from "node:assert/strict";
import { sign, verify } from "../../src/lib/cancel-token.ts";

const BOOKING = "550e8400-e29b-41d4-a716-446655440000";
const SECRET = "a".repeat(64);
const futureStartsAt = () => new Date(Date.now() + 48 * 60 * 60 * 1000);

test("sign/verify roundtrip succeeds for a future booking", () => {
  const startsAt = futureStartsAt();
  const token = sign({ bookingId: BOOKING, startsAt, secret: SECRET });
  const result = verify({ token, bookingId: BOOKING, secret: SECRET });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.exp, Math.floor(startsAt.getTime() / 1000));
  }
});

test("token format is v1.exp.sig with three dot-separated parts", () => {
  const token = sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: SECRET });
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "v1");
  assert.match(parts[1], /^\d+$/);
  assert.equal(parts[2].length > 0, true);
});

test("verify rejects token whose exp has passed", () => {
  const pastStartsAt = new Date(Date.now() - 60 * 1000);
  const token = sign({ bookingId: BOOKING, startsAt: pastStartsAt, secret: SECRET });
  const result = verify({ token, bookingId: BOOKING, secret: SECRET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "expired");
});

test("verify rejects a token signed with a different secret", () => {
  const token = sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: SECRET });
  const result = verify({ token, bookingId: BOOKING, secret: "b".repeat(64) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "bad_signature");
});

test("verify rejects a token bound to a different booking id", () => {
  const token = sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: SECRET });
  const other = "11111111-2222-3333-4444-555555555555";
  const result = verify({ token, bookingId: other, secret: SECRET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "bad_signature");
});

test("verify rejects a malformed token", () => {
  const result = verify({ token: "not-a-token", bookingId: BOOKING, secret: SECRET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "malformed");
});

test("verify rejects a token with an unknown version prefix", () => {
  const token = sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: SECRET });
  const tampered = token.replace(/^v1\./, "v2.");
  const result = verify({ token: tampered, bookingId: BOOKING, secret: SECRET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "wrong_version");
});

test("verify rejects a token with a non-numeric exp", () => {
  const result = verify({
    token: "v1.not-a-number.abcd",
    bookingId: BOOKING,
    secret: SECRET,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "bad_exp");
});

test("sign throws when the secret is missing", () => {
  assert.throws(
    () => sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: "" }),
    /missing_secret/,
  );
});

test("verify returns missing_secret when the secret is empty", () => {
  const result = verify({ token: "v1.1.abc", bookingId: BOOKING, secret: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_secret");
});

test("verify uses the injected now for deterministic expiry checks", () => {
  const startsAt = new Date("2030-01-01T00:00:00Z");
  const token = sign({ bookingId: BOOKING, startsAt, secret: SECRET });

  const beforeExpiry = verify({
    token,
    bookingId: BOOKING,
    secret: SECRET,
    now: new Date("2029-12-31T23:59:00Z"),
  });
  assert.equal(beforeExpiry.ok, true);

  const afterExpiry = verify({
    token,
    bookingId: BOOKING,
    secret: SECRET,
    now: new Date("2030-01-01T00:00:01Z"),
  });
  assert.equal(afterExpiry.ok, false);
  if (!afterExpiry.ok) assert.equal(afterExpiry.reason, "expired");
});

test("tampered exp invalidates the signature", () => {
  const token = sign({ bookingId: BOOKING, startsAt: futureStartsAt(), secret: SECRET });
  const [v, , sig] = token.split(".");
  const tampered = `${v}.${Math.floor(Date.now() / 1000) + 9999}.${sig}`;
  const result = verify({ token: tampered, bookingId: BOOKING, secret: SECRET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "bad_signature");
});
