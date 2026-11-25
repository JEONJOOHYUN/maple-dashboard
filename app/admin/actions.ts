"use server";

// The admin page's two calls. Both check the admin again here: the page being hidden from others is not the lock.
import { refresh, updateTag } from "next/cache";
import { getAdmin } from "@/lib/auth/admin";
import { searchDict } from "@/lib/enhance/dict-server";
import type { ReportItem } from "@/lib/enhance/dict";
import { allowAttempt } from "@/lib/rate-limit";
import { SITE_VALUES_TAG, applyChanges, type ApplyResult } from "@/lib/site-values/server";
import { KNOWN_NAMES } from "@/lib/site-values/values";

/**
 * Applies the changed cells for every visitor. `changes` = [{ key, from, to }]: `from` is what the admin saw, so a
 * cell someone else changed in between is refused ("stale") instead of overwritten.
 */
export async function applySiteValues(note: unknown, changes: unknown): Promise<ApplyResult | "denied" | "limited"> {
  const admin = await getAdmin();
  if (!admin) return "denied";
  if (!(await allowAttempt([{ name: "admin:apply", value: admin.id, max: 60, windowSeconds: 600 }]))) return "limited";
  const result = await applyChanges({ id: admin.id, name: admin.name }, typeof note === "string" ? note : "", changes);
  if (result === "ok") {
    // Every screen built with the old values is built again on its next visit.
    updateTag(SITE_VALUES_TAG);
    refresh();
  }
  return result;
}

const MAX_TAKEN = 1000;

/**
 * Items of the shared dictionary by a part of their name, to add one to the star force list. `taken` = the names
 * the page already lists (added ones, and ones picked but not applied yet): left out before the answer is cut short.
 */
export async function searchItemDict(query: unknown, taken: unknown): Promise<ReportItem[]> {
  if (typeof query !== "string" || query.length > 60 || !(await getAdmin())) return [];
  const skip = new Set(KNOWN_NAMES);
  if (Array.isArray(taken)) for (const name of taken.slice(0, MAX_TAKEN)) if (typeof name === "string" && name.length <= 60) skip.add(name);
  try {
    return await searchDict(query, 8, skip);
  } catch {
    return [];
  }
}
