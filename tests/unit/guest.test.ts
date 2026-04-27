import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrCreateGuestUser,
  isValidEmail,
  normalizeEmail,
  type GuestUserDeps,
} from "../../src/lib/auth/guest.ts";

type Call = { method: "findByEmail" | "createUser"; email: string };

function makeDeps(opts: {
  existing?: Record<string, string>;
  createId?: string;
  throwOnCreate?: Error;
}): { deps: GuestUserDeps; calls: Call[] } {
  const calls: Call[] = [];
  const existing = opts.existing ?? {};
  const createId = opts.createId ?? "created-user-id";

  const deps: GuestUserDeps = {
    async findByEmail(email) {
      calls.push({ method: "findByEmail", email });
      const id = existing[email];
      return id ? { id } : null;
    },
    async createUser(email) {
      calls.push({ method: "createUser", email });
      if (opts.throwOnCreate) throw opts.throwOnCreate;
      return { id: createId };
    },
  };

  return { deps, calls };
}

test("returns existing user without calling createUser", async () => {
  const { deps, calls } = makeDeps({
    existing: { "alice@example.com": "user-alice" },
  });
  const result = await getOrCreateGuestUser(deps, "alice@example.com");
  assert.deepEqual(result, { userId: "user-alice", isNewUser: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "findByEmail");
});

test("creates a new user when findByEmail returns null", async () => {
  const { deps, calls } = makeDeps({ createId: "user-new" });
  const result = await getOrCreateGuestUser(deps, "bob@example.com");
  assert.deepEqual(result, { userId: "user-new", isNewUser: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "findByEmail");
  assert.equal(calls[1].method, "createUser");
});

test("normalizes email to lowercase + trimmed before lookup", async () => {
  const { deps, calls } = makeDeps({
    existing: { "carol@example.com": "user-carol" },
  });
  const result = await getOrCreateGuestUser(deps, "  Carol@Example.COM  ");
  assert.equal(result.userId, "user-carol");
  assert.equal(calls[0].email, "carol@example.com");
});

test("repeated calls with the same email are idempotent", async () => {
  const { deps } = makeDeps({
    existing: { "dave@example.com": "user-dave" },
  });
  const a = await getOrCreateGuestUser(deps, "dave@example.com");
  const b = await getOrCreateGuestUser(deps, "DAVE@example.com");
  assert.equal(a.userId, b.userId);
  assert.equal(a.isNewUser, false);
  assert.equal(b.isNewUser, false);
});

test("throws when email is blank after trim", async () => {
  const { deps } = makeDeps({});
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "   "),
    /guest_email_required/,
  );
});

test("throws when email is malformed", async () => {
  const { deps } = makeDeps({});
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "not-an-email"),
    /guest_email_invalid/,
  );
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "missing-at-sign.com"),
    /guest_email_invalid/,
  );
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "missing-domain@"),
    /guest_email_invalid/,
  );
});

test("throws when email exceeds 254 characters (RFC 5321 limit)", async () => {
  const { deps } = makeDeps({});
  const longEmail = `${"a".repeat(250)}@ex.com`;
  assert.equal(longEmail.length > 254, true);
  await assert.rejects(
    () => getOrCreateGuestUser(deps, longEmail),
    /guest_email_invalid/,
  );
});

test("propagates createUser errors", async () => {
  const err = new Error("supabase_down");
  const { deps } = makeDeps({ throwOnCreate: err });
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "erin@example.com"),
    /supabase_down/,
  );
});

test("throws when createUser returns an empty id", async () => {
  const deps: GuestUserDeps = {
    async findByEmail() {
      return null;
    },
    async createUser() {
      return { id: "" };
    },
  };
  await assert.rejects(
    () => getOrCreateGuestUser(deps, "frank@example.com"),
    /guest_create_returned_empty_id/,
  );
});

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Foo@BAR.com "), "foo@bar.com");
  assert.equal(normalizeEmail(""), "");
});

test("isValidEmail accepts common shapes and rejects malformed inputs", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("first.last+tag@example.co.uk"), true);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("no-at-sign"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a@@b.com"), false);
  assert.equal(isValidEmail("a b@c.com"), false);
});
