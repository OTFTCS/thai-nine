import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export class SupabaseEnvError extends Error {
  constructor(name: string) {
    super(`Missing required env var: ${name}`);
    this.name = "SupabaseEnvError";
  }
}

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new SupabaseEnvError("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function __resetServiceClientCache(): void {
  cached = null;
}
