// Call limits counted in the database (public.rate_counters · counter_hit(), migration 007): every server
// instance must see the same count. Used by the item dictionary's reports; the login code kept on the `members`
// branch has its own copy (lib/auth/rate-limit.ts) and can move to this one when that branch comes back.
import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Short, stable tag for a counter key. IPs are never stored as they are. */
function tag(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Visitor IP as reported by the platform (Vercel sets x-forwarded-for; the first entry is the client). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** `add` = how much this attempt counts for (default 1). */
export type Limit = { name: string; value: string; max: number; windowSeconds: number; add?: number };

/**
 * Counts one attempt against every limit and returns false when any is over. A database error also returns
 * false: when the counter is down nothing gets through.
 */
export async function allowAttempt(limits: Limit[]): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    const results = await Promise.all(
      limits.map((l) => db.rpc("counter_hit", { p_key: `${l.name}:${tag(l.value)}`, p_window_seconds: l.windowSeconds, p_add: l.add ?? 1 }))
    );
    return results.every((r, i) => !r.error && typeof r.data === "number" && r.data <= limits[i].max);
  } catch {
    return false;
  }
}
