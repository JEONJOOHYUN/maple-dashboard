// What a member sets on the boss revenue page, kept with the member's account so another device shows the same:
// party sizes, picked characters, prices, the fee, and this week's checked rewards. Everything is keyed by the
// character's id (never by an API key), so it stays whatever way a NEXON account is connected.
// Pure: the browser works out what changed (`patchOf`), the server checks it (`cleanPatch`) and merges it
// (`applyPatch`). Only changes travel, so a device with an old copy cannot undo what another device set.
import { AUCTION_FEE_OPTIONS } from "../boss-split/boss-split-math.ts";
import { cleanPick } from "../homework/pick.ts";
import type { Marks, PartyStore } from "./calc.ts";
import { CATEGORIES, ITEMS } from "./data.ts";

export type Got = { week: string; marks: Marks };
export type Settings = {
  party: PartyStore;
  /** Prices the member changed, as typed (억 메소), by item id. */
  prices: Record<string, string>;
  got: Got;
  fee: number;
  material: boolean;
  picked: string[];
  /** The accounts whose characters were picked automatically once. */
  autoPicked: string[];
};

export const noSettings = (): Settings => ({ party: {}, prices: {}, got: { week: "", marks: {} }, fee: AUCTION_FEE_OPTIONS[0], material: true, picked: [], autoPicked: [] });

/** A change to the settings. In the maps `null` takes the entry out. */
export type Patch = {
  party?: Record<string, number | null>;
  prices?: Record<string, string | null>;
  /** Checked rewards of one boss week: an older week than the one kept is dropped, a newer one starts empty. */
  marks?: { week: string; set: Record<string, string | true | null> };
  fee?: number;
  material?: boolean;
  picked?: string[];
  autoPicked?: string[];
};

/** Entries one map may hold (36 characters × every boss and difficulty is well under it). */
export const MAX_ENTRIES = 4000;
/** Picked characters kept: those of accounts not on screen now stay picked, so more than the 36 shown. */
export const MAX_PICKED_KEPT = 200;
const MAX_AUTO = 40;

const OCID = "[0-9a-f]{32,64}";
// A boss or difficulty name as the scheduler gives it: no separator, no control characters.
const NAME = "[^|\\u0000-\\u001f]{1,40}";
const PARTY_KEY = new RegExp(`^${OCID}\\|${NAME}(\\|${NAME})?$`);
const MARK_KEY = new RegExp(`^${OCID}\\|${NAME}\\|${NAME}\\|(${CATEGORIES.map((c) => c.cat).join("|")})$`);
const PRICE_TEXT = /^[\d.,]{1,16}$/;
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const AUTO_ID = /^[\w-]{1,40}$/;

const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (map: object) => Object.keys(map).length > 0;

/** The entries of `raw` that `value` accepts (it returns undefined for the others), at most MAX_ENTRIES. */
function cleanMap<T>(raw: unknown, key: (k: string) => boolean, value: (v: unknown) => T | null | undefined): Record<string, T | null> | undefined {
  if (!isMap(raw)) return undefined;
  const out: Record<string, T | null> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (!key(k)) continue;
    const kept = v === null ? null : value(v);
    if (kept === undefined) continue;
    out[k] = kept;
    if (++n >= MAX_ENTRIES) break;
  }
  return n ? out : undefined;
}

const partyValue = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6 ? v : undefined);
const markValue = (v: unknown) => (v === true || (typeof v === "string" && v in ITEMS) ? (v as string | true) : undefined);
/** A cleared field is the default price again. */
const priceValue = (v: unknown) => (typeof v !== "string" ? undefined : !v.trim() ? null : PRICE_TEXT.test(v) ? v : undefined);

/**
 * What a browser sent, down to what may be kept: entries that are not well formed are left out one by one (an old
 * browser copy with a stray entry still moves to the account). null = not a patch at all.
 */
export function cleanPatch(raw: unknown): Patch | null {
  if (!isMap(raw)) return null;
  const out: Patch = {};
  const party = cleanMap(raw.party, (k) => PARTY_KEY.test(k), partyValue);
  if (party) out.party = party;
  const prices = cleanMap(raw.prices, (k) => k in ITEMS, priceValue);
  if (prices) out.prices = prices;
  if (isMap(raw.marks) && typeof raw.marks.week === "string" && WEEK.test(raw.marks.week))
    out.marks = { week: raw.marks.week, set: cleanMap(raw.marks.set, (k) => MARK_KEY.test(k), markValue) ?? {} };
  if ((AUCTION_FEE_OPTIONS as readonly unknown[]).includes(raw.fee)) out.fee = raw.fee as number;
  if (typeof raw.material === "boolean") out.material = raw.material;
  if (Array.isArray(raw.picked)) out.picked = cleanPick(raw.picked, MAX_PICKED_KEPT);
  if (Array.isArray(raw.autoPicked)) out.autoPicked = [...new Set(raw.autoPicked.filter((x): x is string => typeof x === "string" && AUTO_ID.test(x)))].slice(0, MAX_AUTO);
  return out;
}

function merged<T>(base: Record<string, T>, set: Record<string, T | null> | undefined): Record<string, T> {
  if (!set) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(set)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** The settings with a (cleaned) patch in. */
export function applyPatch(s: Settings, p: Patch): Settings {
  // A tab left open since last week must not bring that week's checks back over this week's.
  const marks = p.marks && p.marks.week >= s.got.week ? p.marks : undefined;
  return {
    party: merged(s.party, p.party),
    prices: merged(s.prices, p.prices),
    got: marks ? { week: marks.week, marks: merged(marks.week === s.got.week ? s.got.marks : {}, marks.set) } : s.got,
    fee: p.fee ?? s.fee,
    material: p.material ?? s.material,
    picked: p.picked ?? s.picked,
    autoPicked: p.autoPicked ?? s.autoPicked,
  };
}

export const tooBig = (s: Settings): boolean => Object.keys(s.party).length > MAX_ENTRIES || Object.keys(s.got.marks).length > MAX_ENTRIES;

function changes<T>(prev: Record<string, T>, next: Record<string, T>): Record<string, T | null> {
  const out: Record<string, T | null> = {};
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) out[k] = v;
  for (const k of Object.keys(prev)) if (!(k in next)) out[k] = null;
  return out;
}
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** What changed from `prev` to `next`, as a patch (empty when nothing did). */
export function patchOf(prev: Settings, next: Settings): Patch {
  const out: Patch = {};
  const party = changes(prev.party, next.party);
  if (has(party)) out.party = party;
  const prices = changes(prev.prices, next.prices);
  if (has(prices)) out.prices = prices;
  if (next.got.week && next.got.week !== prev.got.week) out.marks = { week: next.got.week, set: { ...next.got.marks } };
  else if (next.got.week) {
    const set = changes(prev.got.marks, next.got.marks);
    if (has(set)) out.marks = { week: next.got.week, set };
  }
  if (next.fee !== prev.fee) out.fee = next.fee;
  if (next.material !== prev.material) out.material = next.material;
  if (!sameList(prev.picked, next.picked)) out.picked = next.picked;
  if (!sameList(prev.autoPicked, next.autoPicked)) out.autoPicked = next.autoPicked;
  return out;
}

/** Two patches as one, the later one winning (changes waiting to be sent are sent together). */
export function joinPatches(a: Patch, b: Patch): Patch {
  const out: Patch = { ...a, ...b };
  if (a.party && b.party) out.party = { ...a.party, ...b.party };
  if (a.prices && b.prices) out.prices = { ...a.prices, ...b.prices };
  if (a.marks && b.marks && a.marks.week === b.marks.week) out.marks = { week: b.marks.week, set: { ...a.marks.set, ...b.marks.set } };
  return out;
}

export const isEmptyPatch = (p: Patch): boolean => !has(p);

/** A database row (migration 013) ↔ the settings. What is read goes through the same checks as what is sent. */
export type SettingsRow = { party: unknown; prices: unknown; got_week: unknown; got: unknown; fee: unknown; material: unknown; picked: unknown; auto_picked: unknown };
export function settingsOf(row: SettingsRow): Settings {
  const patch = cleanPatch({ party: row.party, prices: row.prices, marks: { week: row.got_week, set: row.got }, fee: row.fee, material: row.material, picked: row.picked, autoPicked: row.auto_picked });
  return applyPatch(noSettings(), patch ?? {});
}
export const rowOf = (s: Settings) => ({ party: s.party, prices: s.prices, got_week: s.got.week, got: s.got.marks, fee: s.fee, material: s.material, picked: s.picked, auto_picked: s.autoPicked });
