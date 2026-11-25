// Server side of the shared item dictionary (public.item_dict, migration 009).
// Reads go through one cached copy of the whole table; writes use the service role key after every value was
// checked (lib/enhance/dict.ts). A missing table or a database problem never reaches the page: lookups answer
// with nothing and reports are dropped.
import "server-only";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fillOf, type Dict, type DictItem, type ReportItem } from "./dict";

export const ITEM_DICT_TAG = "item-dict";
const PAGE = 1000;
/** Rows read at most (PostgREST answers 1,000 a call). Far above what the game has; a guard, not a target. */
const MAX_ROWS = 50_000;

const loadAll = unstable_cache(
  async (): Promise<Dict> => {
    const out: Dict = {};
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from("item_dict")
        .select("name, level, icon, part")
        .order("name")
        .range(from, from + PAGE - 1);
      // A thrown error is not cached: the next lookup asks again.
      if (error) throw error;
      for (const row of data ?? []) out[row.name as string] = { level: row.level as number, icon: row.icon as string, part: row.part as string };
      if (!data || data.length < PAGE) break;
    }
    return out;
  },
  ["item-dict"],
  { revalidate: 3600, tags: [ITEM_DICT_TAG] },
);

/** What the dictionary has for these names. */
export async function lookupDict(names: string[]): Promise<Dict> {
  const all = await loadAll();
  const out: Dict = {};
  for (const name of names) if (Object.hasOwn(all, name)) out[name] = all[name];
  return out;
}

/**
 * Whether this server may write what browsers report. Only the live site does: a local or preview build shares the
 * database, and test runs once filled the dictionary with made-up names (190 rows, removed 2026-11-25).
 * `ITEM_DICT_WRITE=1` turns it on elsewhere, for checking the reports themselves.
 */
export const DICT_WRITES = process.env.VERCEL_ENV === "production" || process.env.ITEM_DICT_WRITE === "1";

/**
 * Save a checked report. New names are inserted (a name someone else inserted in the meantime is left alone: the
 * first level stays); saved items only get an icon or a part they did not have. A name the admin blocked is a row
 * that is still there: it is neither added again nor filled in. Returns how many rows changed, how many of them are
 * new, and `taken` = the reported names the dictionary holds (every one that is not blocked).
 */
export async function saveDict(items: ReportItem[]): Promise<{ changed: number; added: number; taken: string[] }> {
  if (items.length === 0) return { changed: 0, added: 0, taken: [] };
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("item_dict")
    .select("name, level, icon, part, blocked")
    .in("name", items.map((it) => it.name));
  if (error) throw error;
  const saved = new Map((data ?? []).map((row) => [row.name as string, row as unknown as DictItem & { blocked: boolean }]));

  let changed = 0;
  const fresh = items.filter((it) => !saved.has(it.name));
  if (fresh.length > 0) {
    const { data: inserted, error: insertError } = await db.from("item_dict").upsert(fresh, { onConflict: "name", ignoreDuplicates: true }).select("name");
    if (insertError) throw insertError;
    changed += inserted?.length ?? 0;
  }
  const added = changed;
  for (const it of items) {
    const old = saved.get(it.name);
    const fill = old && !old.blocked ? fillOf(old, it) : null;
    if (!fill) continue;
    // Each column only where it is still empty, so two reports arriving together cannot overwrite each other.
    for (const column of ["icon", "part"] as const) {
      const value = fill[column];
      if (!value) continue;
      const { data: updated, error: updateError } = await db
        .from("item_dict")
        .update({ [column]: value, updated_at: new Date().toISOString() })
        .eq("name", it.name)
        .eq("blocked", false)
        .eq(column, "")
        .select("name");
      if (updateError) throw updateError;
      changed += updated?.length ?? 0;
    }
  }
  // Read again after the writes: a name that was blocked (or made as a blocked row) in between was not taken.
  const { data: after, error: afterError } = await db
    .from("item_dict")
    .select("name")
    .in("name", items.map((it) => it.name))
    .eq("blocked", false);
  if (afterError) throw afterError;
  return { changed, added, taken: (after ?? []).map((row) => row.name as string) };
}
