// Site values on the server (public.site_values · site_value_changes, migration 014; item prices and the admin's
// corrections of the shared item dictionary, public.item_dict, migration 015).
// Screens read one cached copy: the cells that differ from the code, and the dictionary items that have a price.
// The admin page reads the tables themselves and writes through one database function. A missing table or a
// database problem never reaches a screen: it then shows the code's own values.
import "server-only";
import { unstable_cache } from "next/cache";
import { kstDate } from "@/lib/enhance/kst";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CELLS, cellOf, cleanValue, cleanValues } from "./cells";
import { cleanDictState, dictKey, dictName, sameDict, type DictRow, type DictState } from "./dict-edit";
import { EXTRA, NO_VALUES, extraKey, type SiteValues } from "./values";

export const SITE_VALUES_TAG = "site-values";
/** Far above what the admin page can make (every fixed cell changed). */
const MAX_ROWS = 1000;
const PAGE = 1000;
/** Dictionary rows read at most (PostgREST answers 1,000 a call). Far above what the game has; a guard. */
const MAX_DICT = 50_000;

// A failed read throws, and a thrown error is not kept. The hour is a safety net (a page built while the database
// was away asks again); a change the admin makes clears the tag at once.
const load = unstable_cache(
  async (): Promise<SiteValues> => {
    const [cells, priced] = await Promise.all([
      supabase.from("site_values").select("key, value").limit(MAX_ROWS),
      // Blocked rows are not readable with this key (the row policy of migration 015).
      supabase.from("item_dict").select("name, level, icon, spare_eok").not("spare_eok", "is", null).limit(MAX_ROWS),
    ]);
    if (cells.error) throw cells.error;
    if (priced.error) throw priced.error;
    return cleanValues([
      // An item's price lives with its dictionary row; the screens read it as one more item of the star force list.
      ...(cells.data ?? []).filter((r) => typeof r.key === "string" && !r.key.startsWith(EXTRA)),
      ...(priced.data ?? []).map((r) => ({ key: extraKey(String(r.name)), value: { level: r.level, icon: r.icon, spareEok: Number(r.spare_eok) } })),
    ]);
  },
  ["site-values-v2"],
  { revalidate: 3600, tags: [SITE_VALUES_TAG] },
);

let lastGood: SiteValues | null = null;

/** The values every screen starts from. Never throws: the last ones this server read, else the code's own. */
export async function siteValues(): Promise<SiteValues> {
  try {
    return (lastGood = await load());
  } catch {
    return lastGood ?? NO_VALUES;
  }
}

/** One cell of a change: what the admin saw and what it becomes (a dictionary row: its fields, null = not there). */
export type Change = { key: string; from: unknown; to: unknown };
export type HistoryRow = { id: number; at: string; who: string; note: string; changes: Change[] };
export type AdminRow = { id: string; name: string; role: "owner" | "editor"; since: string };
export type AdminData = {
  /** The cells of site_values (the dictionary's prices are in `dict`). */
  values: SiteValues;
  dict: DictRow[];
  history: HistoryRow[];
  admins: AdminRow[];
  /** The day it was read (KST), for "n일 전에 고침". */
  today: string;
};

const HISTORY_ROWS = 50;

/** The table as it is now (not the cached copy), read with the service role key. */
async function freshRows(): Promise<{ key: string; value: unknown }[] | null> {
  const { data, error } = await supabaseAdmin().from("site_values").select("key, value").limit(MAX_ROWS);
  return error ? null : ((data ?? []) as { key: string; value: unknown }[]);
}

type StoredDict = { name: string; level: number; icon: string; part: string; spare_eok: number | string | null; blocked: boolean; checked_at: string | null };
const DICT_COLUMNS = "name, level, icon, part, spare_eok, blocked, checked_at";
const stateOfRow = (r: StoredDict): DictState => ({ level: r.level, part: r.part, icon: r.icon, spareEok: r.spare_eok === null ? null : Number(r.spare_eok), blocked: r.blocked });

/** Every row of the dictionary, the blocked ones too, by name. null = it could not be read. */
async function allDict(): Promise<DictRow[] | null> {
  const out: DictRow[] = [];
  for (let from = 0; from < MAX_DICT; from += PAGE) {
    const { data, error } = await supabaseAdmin().from("item_dict").select(DICT_COLUMNS).order("name").range(from, from + PAGE - 1);
    if (error) return null;
    for (const r of (data ?? []) as StoredDict[]) out.push({ name: r.name, ...stateOfRow(r), checked: r.checked_at !== null });
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const changesOf = (raw: unknown): Change[] =>
  Array.isArray(raw) ? raw.filter((c): c is Change => !!c && typeof c === "object" && typeof (c as Change).key === "string").map((c) => ({ key: c.key, from: c.from ?? null, to: c.to ?? null })) : [];

/** What the admin page shows. null = it could not be read. */
export async function adminData(): Promise<AdminData | null> {
  const db = supabaseAdmin();
  const [rows, dict, history, admins] = await Promise.all([
    freshRows(),
    allDict(),
    db.from("site_value_changes").select("id, at, by_name, note, changes").order("at", { ascending: false }).limit(HISTORY_ROWS),
    db.from("site_admins").select("user_id, name, role, created_at").order("created_at"),
  ]);
  if (!rows || !dict || history.error || admins.error) return null;
  return {
    today: kstDate(Date.now()),
    values: cleanValues(rows.filter((r) => !r.key.startsWith(EXTRA))),
    dict,
    history: (history.data ?? []).map((r) => ({ id: Number(r.id), at: String(r.at), who: String(r.by_name ?? ""), note: String(r.note ?? ""), changes: changesOf(r.changes) })),
    admins: (admins.data ?? []).map((r) => ({ id: String(r.user_id), name: String(r.name ?? ""), role: r.role === "owner" ? "owner" : "editor", since: String(r.created_at) })),
  };
}

export const MAX_CHANGES = CELLS.length + 500;
export const MAX_NOTE = 200;

export type ApplyResult = "ok" | "stale" | "invalid" | "failed";

/**
 * Applies the admin's changes in one transaction. Each change says what the admin saw (`from`): when the cell or
 * the dictionary row is something else by now (another admin was first) nothing is written and "stale" comes back.
 * A cell set to the code's value has its row removed, so it follows the code again. `checks` = dictionary names the
 * admin looked at and found right: they are only marked (a changed row is marked too).
 */
export async function applyChanges(by: { id: string; name: string }, note: string, changes: unknown, checks: unknown = []): Promise<ApplyResult> {
  if (!Array.isArray(changes) || !Array.isArray(checks) || typeof note !== "string") return "invalid";
  if (changes.length + checks.length === 0 || changes.length + checks.length > MAX_CHANGES) return "invalid";

  const seen = new Set<string>();
  const wanted: Change[] = [];
  for (const raw of changes) {
    if (!raw || typeof raw !== "object") return "invalid";
    const { key, from, to } = raw as Change;
    if (typeof key !== "string" || seen.has(key)) return "invalid";
    seen.add(key);
    wanted.push({ key, from: from ?? null, to: to ?? null });
  }
  const names = wanted.map((c) => dictName(c.key)).filter((n): n is string => n !== null);
  const db = supabaseAdmin();
  const [rows, dictRows] = await Promise.all([freshRows(), names.length > 0 ? db.from("item_dict").select(DICT_COLUMNS).in("name", names) : null]);
  if (!rows || dictRows?.error) return "failed";
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const dict = new Map(((dictRows?.data ?? []) as StoredDict[]).map((r) => [r.name, stateOfRow(r)]));

  const payload: Record<string, unknown>[] = [];
  for (const { key, from, to } of wanted) {
    const name = dictName(key);
    if (name !== null) {
      // A dictionary row: its fields, checked as a whole.
      const next = cleanDictState(to, name);
      if (!next) return "invalid";
      const now = dict.get(name) ?? null;
      const saw = from === null ? null : cleanDictState(from, name);
      if (from !== null && !saw) return "invalid";
      if (!sameDict(now, saw)) return "stale";
      if (sameDict(now, next)) continue;
      payload.push({ key, was: now, set: next, from: now, to: next });
      continue;
    }
    const cell = cellOf(key);
    if (!cell || typeof to !== "number") return "invalid";
    const next = cleanValue(key, to);
    if (typeof next !== "number") return "invalid";
    const row = stored.get(key);
    const kept = row === undefined ? null : cleanValue(key, row);
    const now = typeof kept === "number" ? kept : cell.def;
    if (now !== from) return "stale";
    if (now === next) continue;
    payload.push({ key, was: row === undefined ? null : row, set: next === cell.def ? null : next, from: now, to: next });
  }
  const changed = new Set(payload.map((p) => p.key));
  const marked = new Set<string>();
  for (const raw of checks) {
    const key = typeof raw === "string" ? dictKey(raw) : "";
    if (dictName(key) === null) return "invalid";
    if (!changed.has(key) && !marked.has(key)) payload.push({ key, check: true });
    marked.add(key);
  }
  if (payload.length === 0) return "ok";

  const { data, error } = await db.rpc("site_values_apply", { p_by: by.id, p_name: by.name, p_note: note.trim().slice(0, MAX_NOTE), p_changes: payload });
  // The function gives up with "stale" when a row it was about to add appeared in between (a visitor's report).
  if (error) return error.message === "stale" ? "stale" : "failed";
  return data === "ok" ? "ok" : "stale";
}
