"use server";

// The shared item dictionary, as the 강화 기록 page reaches it. Item facts only (name · level · icon code · part):
// the key, character names and the history itself stay in the visitor's browser.
// Both actions answer quietly when the database is down or the table is not there yet: the page works without them.
import { updateTag } from "next/cache";
import { allowAttempt, clientIp } from "@/lib/rate-limit";
import { cleanNames, cleanReport, type Dict } from "@/lib/enhance/dict";
import { DICT_WRITES, ITEM_DICT_TAG, lookupDict, saveDict } from "@/lib/enhance/dict-server";

/** Reports one address may send in an hour, and items all visitors together may add in a day. */
const REPORTS_PER_HOUR = 30;
const ITEMS_PER_DAY = 5000;
const DAY_SECONDS = 86_400;

/**
 * What the dictionary knows about these item names (names it does not know, or that were taken out of it, are left
 * out). null = it could not be read: the browser then keeps what it has instead of taking "nothing" as the answer.
 */
export async function lookupItems(names: unknown): Promise<Dict | null> {
  const list = cleanNames(names);
  if (list.length === 0) return {};
  try {
    return await lookupDict(list);
  } catch (e) {
    console.error("item_dict lookup failed", e);
    return null;
  }
}

/**
 * Item facts a browser found. Returns the names the dictionary holds of them (a name taken out of the dictionary is
 * not among them), or false when nothing was taken (bad input, over the limit, database down, not the live site).
 */
export async function reportItems(items: unknown): Promise<string[] | false> {
  const list = cleanReport(items);
  if (list.length === 0 || !DICT_WRITES) return false;
  try {
    // Counted before the write. The address first: a report it refuses must not use up the allowance everyone
    // shares. The day total is counted by items, so one address cannot fill the table through many small reports
    // either. A counter that fails means no write (allowAttempt answers false).
    if (!(await allowAttempt([{ name: "dict:ip", value: await clientIp(), max: REPORTS_PER_HOUR, windowSeconds: 3600 }]))) return false;
    if (!(await allowAttempt([{ name: "dict:day", value: "all", max: ITEMS_PER_DAY, windowSeconds: DAY_SECONDS, add: list.length }]))) return false;
    const { changed, taken } = await saveDict(list);
    // Read-your-own-writes: the next lookup sees what was just saved.
    if (changed > 0) updateTag(ITEM_DICT_TAG);
    return taken;
  } catch (e) {
    console.error("item_dict report failed", e);
    return false;
  }
}
