// Pure cookie-token check, factored out of require-admin.ts so it can be
// imported in tests without dragging next/headers in.

export type AdminGateResult =
  | { ok: true }
  | { ok: false; reason: "no-token-configured" | "missing-cookie" | "bad-cookie" };

export const CREATOR_ADMIN_COOKIE = "creator_admin";

export function checkCookie(
  cookieValue: string | undefined,
  expected: string | undefined,
): AdminGateResult {
  if (!expected || expected.length === 0) return { ok: false, reason: "no-token-configured" };
  if (!cookieValue) return { ok: false, reason: "missing-cookie" };
  if (cookieValue !== expected) return { ok: false, reason: "bad-cookie" };
  return { ok: true };
}
