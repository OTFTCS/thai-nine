export type GuestUserResult = {
  userId: string;
  isNewUser: boolean;
};

export interface GuestUserDeps {
  findByEmail(email: string): Promise<{ id: string } | null>;
  createUser(email: string): Promise<{ id: string }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > 254) return false;
  return EMAIL_PATTERN.test(email);
}

export async function getOrCreateGuestUser(
  deps: GuestUserDeps,
  rawEmail: string,
): Promise<GuestUserResult> {
  const email = normalizeEmail(rawEmail);
  if (email.length === 0) throw new Error("guest_email_required");
  if (!isValidEmail(email)) throw new Error("guest_email_invalid");

  const existing = await deps.findByEmail(email);
  if (existing) return { userId: existing.id, isNewUser: false };

  const created = await deps.createUser(email);
  if (!created.id) throw new Error("guest_create_returned_empty_id");
  return { userId: created.id, isNewUser: true };
}
