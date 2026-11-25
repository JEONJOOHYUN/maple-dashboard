"use server";

// The admin page's calls. Each checks the admin again here: the page being hidden from others is not the lock.
import { refresh, updateTag } from "next/cache";
import { addAdmin, getAdmin, removeAdmin, type AdminChange } from "@/lib/auth/admin";
import { ITEM_DICT_TAG } from "@/lib/enhance/dict-server";
import { allowAttempt } from "@/lib/rate-limit";
import { SITE_VALUES_TAG, applyChanges, type ApplyResult } from "@/lib/site-values/server";

/**
 * Applies the changed cells and dictionary rows for every visitor. `changes` = [{ key, from, to }]: `from` is what
 * the admin saw, so a cell someone else changed in between is refused ("stale") instead of overwritten.
 * `checks` = names of dictionary rows the admin looked at and left as they are.
 */
export async function applySiteValues(note: unknown, changes: unknown, checks: unknown = []): Promise<ApplyResult | "denied" | "limited"> {
  const admin = await getAdmin();
  if (!admin) return "denied";
  if (!(await allowAttempt([{ name: "admin:apply", value: admin.id, max: 60, windowSeconds: 600 }]))) return "limited";
  const result = await applyChanges({ id: admin.id, name: admin.name }, typeof note === "string" ? note : "", changes, checks);
  if (result === "ok") {
    // Every screen built with the old values is built again on its next visit, and the next dictionary lookup
    // reads the corrected rows.
    updateTag(SITE_VALUES_TAG);
    updateTag(ITEM_DICT_TAG);
    refresh();
  }
  return result;
}

/** An owner adds a member as an admin, by the address they sign in with. */
export async function addSiteAdmin(email: unknown, name: unknown): Promise<AdminChange> {
  const admin = await getAdmin();
  if (!admin) return "denied";
  // The address is looked up among the accounts: counted, so the form cannot be used to try addresses out.
  if (!(await allowAttempt([{ name: "admin:people", value: admin.id, max: 20, windowSeconds: 600 }]))) return "failed";
  const result = await addAdmin(admin, email, name);
  if (result === "ok") refresh();
  return result;
}

/** An owner takes an editor out of the admins. */
export async function removeSiteAdmin(id: unknown): Promise<AdminChange> {
  const admin = await getAdmin();
  if (!admin) return "denied";
  const result = await removeAdmin(admin, id);
  if (result === "ok") refresh();
  return result;
}
