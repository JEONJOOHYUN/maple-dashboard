// Supabase client with the service role key: bypasses RLS, so it is used only by server jobs that must write
// (the Sunday Cron). Never import this from pages or components. The key also covers the nyamnyam schema
// in the same project, so it stays in env vars only (Vercel Sensitive + .env.local).
// "server-only": the build fails if a Client Component ever imports this file (Next handles the import itself).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Created on first use, so a missing key fails the job that needs it instead of the whole build. */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
