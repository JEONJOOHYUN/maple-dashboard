// Everything the star force views show, counted in one pass over the tries of the chosen period.
import { FLOOR_STAR } from "../ev/starforce.ts";
import type { ItemInfo } from "./items.ts";
import { itemKey, starAfter, type Judged, type SkipReason } from "./judge.ts";
import { kstDate, kstWeekday } from "./kst.ts";
import type { SfRow } from "./parse.ts";

/** `copy` = which piece of that item name the try belongs to (trackCopies). */
export type Entry = { row: SfRow; j: Judged; info: ItemInfo; copy: number };

/** One card in 모아보기 = one piece of an item on one character. */
export const entryKey = (e: Pick<Entry, "row" | "copy">) => `${itemKey(e.row)}\u0000${e.copy}`;

export type Tally = { tries: number; spent: number; delta: number };

export type ItemStat = {
  key: string;
  item: string;
  who: string;
  info: ItemInfo;
  /** Piece number, and how many pieces of this name the character enhanced in the period. */
  copy: number;
  copies: number;
  /** What the results are worth: the average meso it takes to get the same stars (stars lost to a destroy and the spare taken off). */
  worth: number;
  tries: number;
  success: number;
  fail: number;
  destroy: number;
  /** Tries counted in profit. */
  judged: number;
  spent: number;
  delta: number;
  first: number;
  last: number;
  /** Star before the first try and after the latest one in the period. */
  start: number;
  now: number;
  /** Tries at the highest star attempted. */
  top: { star: number; success: number; fail: number; destroy: number };
  /** Longest run without a success at one star. Runs only count tries from 12 stars up (user, 2026-11-12): below that almost every try succeeds. */
  streak: { star: number; n: number };
  /** Longest run of successes in a row: how many, from which star to which. */
  win: { n: number; from: number; to: number };
  /** Why nothing was judged (only when judged = 0). */
  skip?: SkipReason;
};

export type OddsRow = {
  star: number;
  n: number;
  /** Average chance the game gave these tries. */
  expSuccess: number;
  expDestroy: number;
  success: number;
  fail: number;
  destroy: number;
};

export type DayStat = { date: string; delta: number; tries: number; event: boolean; best: { label: string; delta: number } | null };
export type MonthStat = { ym: string; delta: number; tries: number; event: boolean };

export type Stats = {
  total: number;
  judged: number;
  skipped: Record<SkipReason, number>;
  success: number;
  fail: number;
  destroy: number;
  spent: number;
  delta: number;
  /** Share of equally careful accounts that did better with the same tries (0~1); null under 30 tries. */
  luckTop: number | null;
  items: ItemStat[];
  odds: OddsRow[];
  /** Sunday first. */
  weekdays: number[];
  days: Map<string, DayStat>;
  months: MonthStat[];
  event: Tally;
  plain: Tally;
  worlds: { name: string; n: number }[];
  characters: string[];
};

/** The piece was at 12 stars or tried from there in the period ("12성 미만 숨기기" hides the others). */
export const reachedFloor = (it: Pick<ItemStat, "now" | "top">) => Math.max(it.now, it.top.star) >= FLOOR_STAR;

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error under 1e-7). */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

const MIN_FOR_LUCK = 30;

/** `entries` oldest first. */
export function buildStats(entries: Entry[]): Stats {
  const skipped: Record<SkipReason, number> = { old: 0, superior: 0, item: 0, level: 0, range: 0 };
  const items = new Map<string, ItemStat>();
  /** Tries without a success in a row, per item: [count, star]. */
  const runs = new Map<string, [number, number]>();
  /** Successes in a row, per item: [count, star the run started at]. */
  const wins = new Map<string, [number, number]>();
  const odds = new Map<number, OddsRow>();
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const days = new Map<string, DayStat>();
  const months = new Map<string, MonthStat>();
  const worlds = new Map<string, number>();
  const characters = new Set<string>();
  const event: Tally = { tries: 0, spent: 0, delta: 0 };
  const plain: Tally = { tries: 0, spent: 0, delta: 0 };
  let judged = 0;
  let success = 0;
  let fail = 0;
  let destroy = 0;
  let spent = 0;
  let delta = 0;
  let luck = 0;
  let variance = 0;

  for (const entry of entries) {
    const { row, j, info } = entry;
    worlds.set(row.world, (worlds.get(row.world) ?? 0) + 1);
    characters.add(row.who);

    const key = entryKey(entry);
    let it = items.get(key);
    if (!it) {
      it = {
        key, item: row.item, who: row.who, info, copy: entry.copy, copies: 1, worth: 0,
        tries: 0, success: 0, fail: 0, destroy: 0, judged: 0, spent: 0, delta: 0,
        first: row.t, last: row.t, start: row.from, now: row.from,
        top: { star: row.from, success: 0, fail: 0, destroy: 0 },
        streak: { star: row.from, n: 0 },
        win: { n: 0, from: row.from, to: row.from },
      };
      items.set(key, it);
      runs.set(key, [0, row.from]);
      wins.set(key, [0, row.from]);
    }
    it.tries++;
    it[row.r]++;
    it.last = row.t;
    it.now = starAfter(row, j.restored);
    if (row.from > it.top.star) it.top = { star: row.from, success: 0, fail: 0, destroy: 0 };
    if (row.from === it.top.star) it.top[row.r]++;
    const high = row.from >= FLOOR_STAR;
    const win = wins.get(key)!;
    if (high && row.r === "success") {
      if (win[0] === 0) win[1] = row.from;
      win[0]++;
      if (win[0] > it.win.n) it.win = { n: win[0], from: win[1], to: it.now };
    } else win[0] = 0;
    const run = runs.get(key)!;
    if (!high || row.r === "success" || row.from !== run[1]) run[0] = 0;
    run[1] = row.from;
    if (high && row.r !== "success") {
      run[0]++;
      if (run[0] > it.streak.n) it.streak = { star: row.from, n: run[0] };
    }

    if (!j.ok) {
      if (j.why) {
        skipped[j.why]++;
        it.skip ??= j.why;
      }
      continue;
    }
    judged++;
    if (row.r === "success") success++;
    else if (row.r === "destroy") destroy++;
    else fail++;
    spent += j.cost;
    delta += j.delta;
    luck += j.delta - j.mean;
    variance += j.variance;
    it.judged++;
    it.spent += j.cost;
    it.delta += j.delta;
    it.worth += j.delta + j.cost;

    let o = odds.get(row.from);
    if (!o) odds.set(row.from, (o = { star: row.from, n: 0, expSuccess: 0, expDestroy: 0, success: 0, fail: 0, destroy: 0 }));
    o.n++;
    o.expSuccess += j.p;
    o.expDestroy += j.d;
    o[row.r]++;

    weekdays[kstWeekday(row.t)] += j.delta;
    const on = row.set !== "none" || row.sr > 0 || row.plus > 0;
    const side = on ? event : plain;
    side.tries++;
    side.spent += j.cost;
    side.delta += j.delta;

    const date = kstDate(row.t);
    let day = days.get(date);
    if (!day) days.set(date, (day = { date, delta: 0, tries: 0, event: false, best: null }));
    day.delta += j.delta;
    day.tries++;
    day.event ||= on;
    if (row.r === "success" && (!day.best || j.delta > day.best.delta)) day.best = { label: `${row.item} ${row.to}성`, delta: j.delta };

    const ym = date.slice(0, 7);
    let month = months.get(ym);
    if (!month) months.set(ym, (month = { ym, delta: 0, tries: 0, event: false }));
    month.delta += j.delta;
    month.tries++;
    month.event ||= on;
  }

  for (const o of odds.values()) {
    o.expSuccess /= o.n;
    o.expDestroy /= o.n;
  }
  // How many pieces each character has of one item name.
  const pieces = new Map<string, number>();
  for (const it of items.values()) pieces.set(`${it.who}\u0000${it.item}`, Math.max(pieces.get(`${it.who}\u0000${it.item}`) ?? 0, it.copy));
  for (const it of items.values()) it.copies = pieces.get(`${it.who}\u0000${it.item}`) ?? 1;
  const sd = Math.sqrt(variance);
  return {
    total: entries.length,
    judged,
    skipped,
    success,
    fail,
    destroy,
    spent,
    delta,
    luckTop: judged >= MIN_FOR_LUCK && sd > 0 ? 1 - phi(luck / sd) : null,
    items: [...items.values()],
    odds: [...odds.values()].sort((a, b) => a.star - b.star),
    weekdays,
    days,
    months: [...months.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1)),
    event,
    plain,
    worlds: [...worlds.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    characters: [...characters].sort((a, b) => a.localeCompare(b, "ko")),
  };
}
