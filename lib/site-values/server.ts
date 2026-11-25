// Site values on the server (public.site_values · site_value_changes, migration 014).
// Screens read one cached copy of the whole table (it holds only the cells that differ from the code); the admin
// page reads the table itself and writes through one database function. A missing table or a database problem
// never reaches a screen: it then shows the code's own values.
import "server-only";
import { unstable_cache } from "next/cache";
import { kstDate } from "@/lib/enhance/kst";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CELLS, cellOf, cleanValue, cleanValues, sameValue } from "./cells";
import { NO_VALUES, extraName, type Extra, type SiteValues } from "./values";

export const SITE_VALUES_TAG = "site-values";
/** Far above what the admin page can make (every fixed cell changed, and a few hundred added items). */
const MAX_ROWS = 1000;

// A failed read throws, and a thrown error is not kept. The hour is a safety net (a page built while the database
// was away asks again); a change the admin makes clears the tag at once.
const load = unstable_cache(
  async (): Promise<SiteValues> => {
    const { data, error } = await supabase.from("site_values").select("key, value").limit(MAX_ROWS);
    if (error) throw error;
    return cleanValues(data ?? []);
  },
  ["site-values-v1"],
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

/** One cell of a change: what the admin saw and what it becomes (null = an added item that is not there). */
export type Change = { key: string; from: unknown; to: unknown };
export type HistoryRow = { id: number; at: string; who: string; note: string; changes: Change[] };
export type AdminRow = { name: string; role: "owner" | "editor"; since: string };
export type AdminData = { values: SiteValues; history: HistoryRow[]; admins: AdminRow[]; /** The day it was read (KST), for "n일 전에 고침". */ today: string };

const HISTORY_ROWS = 50;

/** The table as it is now (not the cached copy), read with the service role key. */
async function freshRows(): Promise<{ key: string; value: unknown }[] | null> {
  const { data, error } = await supabaseAdmin().from("site_values").select("key, value").limit(MAX_ROWS);
  return error ? null : ((data ?? []) as { key: string; value: unknown }[]);
}

const changesOf = (raw: unknown): Change[] =>
  Array.isArray(raw) ? raw.filter((c): c is Change => !!c && typeof c === "object" && typeof (c as Change).key === "string").map((c) => ({ key: c.key, from: c.from ?? null, to: c.to ?? null })) : [];

/** What the admin page shows. null = it could not be read. */
export async function adminData(): Promise<AdminData | null> {
  const db = supabaseAdmin();
  const [rows, history, admins] = await Promise.all([
    freshRows(),
    db.from("site_value_changes").select("id, at, by_name, note, changes").order("at", { ascending: false }).limit(HISTORY_ROWS),
    db.from("site_admins").select("name, role, created_at").order("created_at"),
  ]);
  if (!rows || history.error || admins.error) return null;
  return {
    today: kstDate(Date.now()),
    values: cleanValues(rows),
    history: (history.data ?? []).map((r) => ({ id: Number(r.id), at: String(r.at), who: String(r.by_name ?? ""), note: String(r.note ?? ""), changes: changesOf(r.changes) })),
    admins: (admins.data ?? []).map((r) => ({ name: String(r.name ?? ""), role: r.role === "owner" ? "owner" : "editor", since: String(r.created_at) })),
  };
}

export const MAX_CHANGES = CELLS.length + 100;
export const MAX_NOTE = 200;

/** The value in force for a key: the stored row, else the code's (null for an added item that is not there). */
const inForce = (key: string, stored: unknown): unknown => (stored !== undefined ? stored : (cellOf(key)?.def ?? null));

export type ApplyResult = "ok" | "stale" | "invalid" | "failed";

/**
 * Applies the admin's changes in one transaction. Each change says what the admin saw (`from`): when the cell is
 * something else by now (another admin was first) nothing is written and "stale" comes back. A cell set to the
 * code's value has its row removed, so it follows the code again.
 */
export async function applyChanges(by: { id: string; name: string }, note: string, changes: unknown): Promise<ApplyResult> {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_CHANGES || typeof note !== "string") return "invalid";
  const rows = await freshRows();
  if (!rows) return "failed";
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  const seen = new Set<string>();
  const payload: { key: string; was: unknown; set: unknown; from: unknown; to: unknown }[] = [];
  for (const raw of changes) {
    if (!raw || typeof raw !== "object") return "invalid";
    const { key, from, to } = raw as Change;
    if (typeof key !== "string" || seen.has(key)) return "invalid";
    seen.add(key);
    const cell = cellOf(key);
    if (!cell && extraName(key) === null) return "invalid";
    // null is only for an added item (not there before, or taken out now).
    const next: number | Extra | null = to === null || to === undefined ? null : cleanValue(key, to);
    if (next === null && (cell || to !== null)) return "invalid";
    const row = stored.get(key);
    const was = row === undefined ? null : row;
    const now = inForce(key, row === undefined ? undefined : cleanValue(key, row) ?? undefined);
    if (!sameValue(now, from ?? null)) return "stale";
    if (sameValue(now, next)) continue;
    payload.push({ key, was, set: cell && next === cell.def ? null : next, from: now, to: next });
  }
  if (payload.length === 0) return "ok";

  const { data, error } = await supabaseAdmin().rpc("site_values_apply", { p_by: by.id, p_name: by.name, p_note: note.trim().slice(0, MAX_NOTE), p_changes: payload });
  if (error) return "failed";
  return data === "ok" ? "ok" : "stale";
}
