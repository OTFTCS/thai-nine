import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export type SignInput = {
  bookingId: string;
  startsAt: Date;
  secret: string;
};

export type VerifyFailureReason =
  | "malformed"
  | "wrong_version"
  | "bad_exp"
  | "expired"
  | "bad_signature"
  | "wrong_booking"
  | "missing_secret";

export type VerifyResult =
  | { ok: true; exp: number }
  | { ok: false; reason: VerifyFailureReason };

export type VerifyInput = {
  token: string;
  bookingId: string;
  secret: string;
  now?: Date;
};

export function sign(input: SignInput): string {
  if (!input.secret) throw new Error("cancel_token_missing_secret");
  const exp = Math.floor(input.startsAt.getTime() / 1000);
  const payload = `${VERSION}|${input.bookingId}|${exp}`;
  const sig = createHmac("sha256", input.secret).update(payload).digest("base64url");
  return `${VERSION}.${exp}.${sig}`;
}

export function verify(input: VerifyInput): VerifyResult {
  if (!input.secret) return { ok: false, reason: "missing_secret" };

  const parts = input.token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [version, expStr, providedSig] = parts;
  if (version !== VERSION) return { ok: false, reason: "wrong_version" };

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "bad_exp" };

  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (exp <= nowSec) return { ok: false, reason: "expired" };

  const payload = `${version}|${input.bookingId}|${exp}`;
  const expectedSig = createHmac("sha256", input.secret).update(payload).digest("base64url");

  let providedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    providedBuf = Buffer.from(providedSig, "base64url");
    expectedBuf = Buffer.from(expectedSig, "base64url");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }

  if (providedBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  return { ok: true, exp };
}
