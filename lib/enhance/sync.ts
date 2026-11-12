// Browser only. Keeps one kind of history (star force tries, or potential rolls) of one key up to date for a date
// range: days already fetched come from IndexedDB, the rest is fetched newest first and saved as it arrives.
// A day that is over never changes, so it is fetched once; today (and a day fetched before it was over) is refreshed.
import { ApiError, createApi, fetchCharacters, fetchEquipment, fetchHistoryDay, fetchInsight, type Api, type ApiErrorKind } from "./client.ts";
import { idbAny, idbDeletePrefix, idbGet, idbPut, idbRange } from "./idb.ts";
import { knownItem, type FoundItem } from "./items.ts";
import { DAY, datesBetween, dayStart } from "./kst.ts";
import { parseStarforce, type RawStarforce, type SfRow } from "./parse.ts";
import { parsePotential, type PotRow, type RawPotential } from "./potential.ts";

// Bump when the saved rows change shape: older saved days are then fetched again.
const VERSION = "1";
/** The API can lag (star force up to 5 minutes, potential up to 30), so a day counts as closed a while after midnight. */
const CLOSE_LAG = 35 * 60_000;
/** An open day is fetched again when the saved copy is older than this. */
const OPEN_TTL = 2 * 60_000;
const EQUIP_TTL = DAY;
const MAX_CHARACTERS = 30;
// Days fetched at once. The request starts themselves are spaced by the client (see createApi), whatever this is.
const WORKERS = 40;
const EMIT_EVERY = 300;

type Row = { t: number; who: string; item: string };
type SavedDay<T> = { at: number; rows: T[] };
type SavedEquip = { at: number; items: Record<string, FoundItem> };

/** One history endpoint: `tag` names its saved days, `fetchDay` returns the day's rows already trimmed. */
export type Source<T> = { tag: string; fetchDay: (api: Api, date: string, signal: AbortSignal) => Promise<T[]> };

export type SyncSnap<T> = {
  status: "idle" | "loading" | "done" | "error";
  /** Calls answered so far / calls the range needs (days × endpoints). */
  done: number;
  total: number;
  /** Rows in the range, oldest first. */
  rows: T[];
  /** Item facts from the account's equipment, by item name. */
  found: Record<string, FoundItem>;
  error: ApiErrorKind | null;
  /** When the range was last complete, ms (0 = never). */
  at: number;
};

const EMPTY: SyncSnap<never> = { status: "idle", done: 0, total: 0, rows: [], found: {}, error: null, at: 0 };

const dayKey = (account: string, tag: string, date: string) => `${VERSION}|${account}|${tag}|${date}`;
const equipKey = (account: string, who: string) => `${VERSION}|${account}|eq|${who}`;

const closed = (date: string, at: number) => at >= dayStart(date) + DAY + CLOSE_LAG;
/** `force` (the user pressed refresh): a day that is still open is always asked again. */
const fresh = (date: string, saved: SavedDay<unknown> | undefined, now: number, force: boolean) => !!saved && (closed(date, saved.at) || (!force && now - saved.at < OPEN_TTL));

export class HistorySync<T extends Row> {
  private readonly api: Api;
  private readonly account: string;
  private readonly sources: Source<T>[];
  /** True when the equipment lookup could still tell us something about this row's item. */
  private readonly lacks: (row: T, found: Record<string, FoundItem>) => boolean;
  private snap: SyncSnap<T> = EMPTY;
  private listeners = new Set<() => void>();
  private run: AbortController | null = null;

  constructor(key: string, account: string, sources: Source<T>[], lacks: (row: T, found: Record<string, FoundItem>) => boolean) {
    this.api = createApi(key, account);
    this.account = account;
    this.sources = sources;
    this.lacks = lacks;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snap;

  private set(next: Partial<SyncSnap<T>>) {
    this.snap = { ...this.snap, ...next };
    this.listeners.forEach((l) => l());
  }

  stop() {
    this.run?.abort();
    this.run = null;
  }

  /** Load `from`…`to` (KST days, both included). Calling again replaces the run in progress. */
  load(from: string, to: string, force = false) {
    this.stop();
    const run = new AbortController();
    this.run = run;
    this.work(from, to, force, run.signal).catch((e) => {
      if (run.signal.aborted) return;
      this.set({ status: "error", error: e instanceof ApiError ? e.kind : "failed" });
    });
  }

  private async work(from: string, to: string, force: boolean, signal: AbortSignal) {
    const dates = datesBetween(from, to);
    // Saved days, by "tag|date".
    const days = new Map<string, SavedDay<T>>();
    for (const source of this.sources) {
      const saved = await idbRange<SavedDay<T>>(dayKey(this.account, source.tag, from), dayKey(this.account, source.tag, to));
      if (signal.aborted) return;
      for (const [key, value] of saved) days.set(`${source.tag}|${key.slice(key.lastIndexOf("|") + 1)}`, value);
    }

    const now = Date.now();
    // Newest day first, every endpoint of a day together.
    const todo = dates.flatMap((date) => this.sources.filter((s) => !fresh(date, days.get(`${s.tag}|${date}`), now, force)).map((source) => ({ source, date })));
    const total = dates.length * this.sources.length;
    let done = total - todo.length;
    const rows = () =>
      dates
        .flatMap((d) => this.sources.flatMap((s) => days.get(`${s.tag}|${d}`)?.rows ?? []))
        .sort((a, b) => a.t - b.t);
    const found = await this.savedEquipment(rows());
    if (signal.aborted) return;
    this.set({ status: todo.length ? "loading" : "done", done, total, rows: rows(), found, error: null, at: todo.length ? this.snap.at : now });

    // Days older than what the API keeps answer "invalid parameter": everything older is skipped too.
    const floor = new Map<string, string>();
    let lastEmit = Date.now();
    // The first real failure (bad key, call limit, network) stops every worker; what arrived so far stays on screen.
    let failure: unknown = null;
    const next = async () => {
      for (;;) {
        if (failure || signal.aborted) return;
        const job = todo.shift();
        if (!job) return;
        const { source, date } = job;
        const limit = floor.get(source.tag);
        if (!limit || date > limit) {
          try {
            const day: SavedDay<T> = { at: Date.now(), rows: await source.fetchDay(this.api, date, signal) };
            days.set(`${source.tag}|${date}`, day);
            void idbPut(dayKey(this.account, source.tag, date), day);
          } catch (e) {
            if (signal.aborted) return;
            if (!(e instanceof ApiError) || e.kind !== "param") {
              failure ??= e;
              return;
            }
            const known = floor.get(source.tag);
            if (!known || date > known) floor.set(source.tag, date);
          }
        }
        done++;
        if (Date.now() - lastEmit > EMIT_EVERY) {
          lastEmit = Date.now();
          this.set({ done, rows: rows() });
        }
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, next));
    if (signal.aborted) return;
    this.set({ done, rows: rows() });
    if (failure) throw failure;

    // Item levels and icons: a nice-to-have, so a failure here never fails the page.
    try {
      this.set({ found: await this.refreshEquipment(rows(), found, signal) });
    } catch (e) {
      if (signal.aborted) return;
      if (e instanceof ApiError && e.kind === "badKey") throw e;
    }
    if (signal.aborted) return;
    this.set({ status: "done", at: Date.now() });
  }

  /** Characters in the rows, the one enhanced most recently first. */
  private characters(rows: T[]): string[] {
    const seen = new Set<string>();
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].who) seen.add(rows[i].who);
    return [...seen].slice(0, MAX_CHARACTERS);
  }

  private async savedEquipment(rows: T[]): Promise<Record<string, FoundItem>> {
    const out: Record<string, FoundItem> = {};
    for (const who of this.characters(rows)) Object.assign(out, (await idbGet<SavedEquip>(equipKey(this.account, who)))?.items);
    return out;
  }

  private async refreshEquipment(rows: T[], known: Record<string, FoundItem>, signal: AbortSignal): Promise<Record<string, FoundItem>> {
    const out = { ...known };
    const now = Date.now();
    // Set once a lookup fails for a reason that will fail again (network, quota, maintenance): no more asking this time.
    let blocked = false;
    for (const who of this.characters(rows)) {
      const saved = await idbGet<SavedEquip>(equipKey(this.account, who));
      // What was saved counts even when NEXON is not asked again (a period whose records are new, the cache not).
      if (saved) Object.assign(out, saved.items);
      // Ask again only when this character has an item we still know nothing about, at most once a day.
      const missing = rows.some((r) => r.who === who && this.lacks(r, out));
      if (blocked || (saved && (!missing || now - saved.at < EQUIP_TTL))) continue;
      let items: Record<string, FoundItem> = {};
      try {
        items = await fetchEquipment(this.api, who, signal);
      } catch (e) {
        if (signal.aborted || (e instanceof ApiError && e.kind === "badKey")) throw e;
        // The network, the quota, maintenance: stop asking, but go on through the characters for what is saved —
        // one lookup failing must not throw away the saved equipment of the others.
        if (!(e instanceof ApiError) || e.kind !== "param") {
          blocked = true;
          continue;
        }
        // "param" = a renamed or deleted character: remembered (as empty) so it is not asked every visit.
      }
      void idbPut(equipKey(this.account, who), { at: now, items } satisfies SavedEquip);
      Object.assign(out, items);
    }
    return out;
  }
}

/** Star force tries. The level is not in the history, so the equipment lookup matters for items the table does not know. */
export class StarforceSync extends HistorySync<SfRow> {
  static readonly serverSnapshot = (): SyncSnap<SfRow> => EMPTY;
  constructor(key: string, account: string) {
    super(
      key,
      account,
      [
        {
          tag: "sf",
          fetchDay: async (api, date, signal) =>
            (await fetchHistoryDay<RawStarforce>(api, "history/starforce", "starforce_history", date, signal)).map(parseStarforce).filter((r): r is SfRow => r !== null),
        },
      ],
      (row, found) => !found[row.item] && !knownItem(row.item)
    );
  }
}

/** Potential rolls: meso resets (history/potential) and cash cubes (history/cube). The equipment lookup only adds pictures. */
export class PotentialSync extends HistorySync<PotRow> {
  static readonly serverSnapshot = (): SyncSnap<PotRow> => EMPTY;
  constructor(key: string, account: string) {
    const source = (tag: string, path: string, list: string): Source<PotRow> => ({
      tag,
      fetchDay: async (api, date, signal) => (await fetchHistoryDay<RawPotential>(api, path, list, date, signal)).map(parsePotential).filter((r): r is PotRow => r !== null),
    });
    super(key, account, [source("pot", "history/potential", "potential_history"), source("cube", "history/cube", "cube_history")], (row, found) => !found[row.item]);
  }
}

/** Every star force try saved for a key, whatever period was fetched (the tries say which world a character was in). */
export async function savedTries(account: string): Promise<SfRow[]> {
  const saved = await idbRange<SavedDay<SfRow>>(dayKey(account, "sf", "0000-00-00"), dayKey(account, "sf", "9999-99-99"));
  return saved.flatMap(([, day]) => day.rows);
}

type SavedCharacters = { at: number; worlds: Record<string, string>; ocids: Record<string, string> };
const charactersKey = (account: string) => `${VERSION}|${account}|cw`;

/** character/list calls under way, by key: the world lookup and the 통찰력 lookup start together and share one. */
const listing = new Map<string, Promise<Pick<SavedCharacters, "worlds" | "ocids">>>();

/**
 * The account's characters (where each is now, and its id), asked at most once a day (one call). A failure answers
 * with what was saved before, or nothing: this only refines the page, it must never fail it.
 * The call is not tied to one caller's abort signal: it is shared, and it is a single small request.
 */
function accountCharacters(api: Api, account: string): Promise<Pick<SavedCharacters, "worlds" | "ocids">> {
  const running = listing.get(account);
  if (running) return running;
  const work = (async () => {
    const saved = await idbGet<Partial<SavedCharacters>>(charactersKey(account));
    // A copy saved before the ids were kept counts as stale.
    if (saved?.worlds && saved.ocids && saved.at && Date.now() - saved.at < DAY) return { worlds: saved.worlds, ocids: saved.ocids };
    try {
      const fresh = await fetchCharacters(api);
      void idbPut(charactersKey(account), { at: Date.now(), ...fresh } satisfies SavedCharacters);
      return fresh;
    } catch {
      return { worlds: saved?.worlds ?? {}, ocids: saved?.ocids ?? {} };
    }
  })().finally(() => listing.delete(account));
  listing.set(account, work);
  return work;
}

/** Character → the world it is in today. */
export async function characterWorlds(key: string, account: string): Promise<Record<string, string>> {
  return (await accountCharacters(createApi(key, account), account)).worlds;
}

type SavedInsights = Record<string, { at: number; level: number }>;
const insightsKey = (account: string) => `${VERSION}|${account}|in`;

/**
 * 통찰력 level of these characters (one call each, at most once a day; it decides whether a cube on an item up to
 * Lv.120 took a fee). A character that cannot be asked about — not in the account's list any more, the call
 * failed — is left out: its fee then counts as waived.
 */
export async function characterInsights(key: string, account: string, names: string[], signal?: AbortSignal): Promise<Record<string, number>> {
  const saved = (await idbGet<SavedInsights>(insightsKey(account))) ?? {};
  const now = Date.now();
  const out: Record<string, number> = {};
  const stale: string[] = [];
  for (const who of names) {
    const had = Object.hasOwn(saved, who) ? saved[who] : undefined;
    if (had) out[who] = had.level;
    if (!had || now - had.at >= DAY) stale.push(who);
  }
  if (stale.length === 0) return out;
  const api = createApi(key, account);
  const { ocids } = await accountCharacters(api, account);
  let changed = false;
  for (const who of stale) {
    const ocid = Object.hasOwn(ocids, who) ? ocids[who] : "";
    if (!ocid) continue;
    try {
      out[who] = await fetchInsight(api, ocid, signal);
      saved[who] = { at: now, level: out[who] };
      changed = true;
    } catch (e) {
      if (signal?.aborted) break;
      // The network, the quota, maintenance: the next ones would fail the same way. A bad key shows up elsewhere.
      if (!(e instanceof ApiError) || e.kind !== "param") break;
    }
  }
  if (changed) void idbPut(insightsKey(account), saved);
  return out;
}

/** Remove the saved records of a key without building a sync for it. */
export const clearAccount = (account: string) => idbDeletePrefix(`${VERSION}|${account}|`);
/** The records of every key this browser has seen (also ones whose key was not remembered, or saved in an older shape). */
export const clearEverything = () => idbDeletePrefix("");
export const hasRecords = () => idbAny();
