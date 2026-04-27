import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CREATOR_ADMIN_COOKIE,
  checkCookie,
  type AdminGateResult,
} from "@/lib/auth/admin-token";

// First auth-gated route in the repo. The login UI at /(auth)/login is
// currently a mock and there is no Supabase session anywhere in src/.
//
// v1 placeholder: gate on a shared cookie (CREATOR_ADMIN_COOKIE) whose value
// must equal env CREATOR_ADMIN_TOKEN. Set via:
//   document.cookie = "creator_admin=<token>; path=/; max-age=2592000; samesite=strict"
// in a paste-the-token bookmarklet. When the real Supabase session flow ships
// across the app, swap the body of `requireAdmin*()` to call
// is_teacher_or_admin(auth.uid()) and delete the cookie path.

export { CREATOR_ADMIN_COOKIE, type AdminGateResult } from "@/lib/auth/admin-token";

export async function isAdminFromCookies(): Promise<AdminGateResult> {
  const store = await cookies();
  const cookieValue = store.get(CREATOR_ADMIN_COOKIE)?.value;
  return checkCookie(cookieValue, process.env.CREATOR_ADMIN_TOKEN);
}

export async function requireAdminForPage(): Promise<void> {
  const gate = await isAdminFromCookies();
  if (!gate.ok) redirect("/login");
}

export async function requireAdminForApi(): Promise<AdminGateResult> {
  return isAdminFromCookies();
}
