// Boss revenue arithmetic, kept apart from the screen so it can be tested.
import { evenMemberShare } from "../boss-split/boss-split-math.ts";
import { BOXES, CATEGORIES, CRYSTAL, DIFFICULTY, DROPS, ITEMS, MATERIALS, PER_BOX, isBox, maxParty, type BoxId, type Category, type Drop, type ItemId } from "./data.ts";

/** One row of the scheduler's `boss_contents`. */
export type SchedulerBoss = { content_name?: string; difficulty?: string; cycle?: string; list_order_no?: number; registration_flag?: string; complete_flag?: string };
export type SchedulerState = { boss_contents?: SchedulerBoss[]; weekly_boss_clear_count?: number; weekly_boss_clear_limit_count?: number };

/** A weekly (or monthly) boss of one character this week: cleared, or still on the in-game schedule. */
export type BossRow = { boss: string; diff: string; key: string; monthly: boolean; done: boolean };

export const bossKey = (boss: string, diff: string) => `${boss}|${diff}`;

/**
 * The bosses to show for one character: every cleared weekly / monthly boss, and every registered one not cleared yet.
 * Daily bosses are left out. The scheduler's own order (easy bosses first) is kept. A boss cleared at one difficulty
 * hides its other difficulties: a boss is cleared once a week (registered normal, cleared hard = hard only).
 */
export function bossRows(state: SchedulerState | null | undefined): BossRow[] {
  const rows = (state?.boss_contents ?? [])
    .filter((b) => (b.cycle === "bossWeekly" || b.cycle === "bossMonthly") && b.content_name && b.difficulty)
    .filter((b) => b.complete_flag === "true" || b.registration_flag === "true")
    .sort((a, b) => (a.list_order_no ?? 0) - (b.list_order_no ?? 0));
  const cleared = new Set(rows.filter((b) => b.complete_flag === "true").map((b) => b.content_name));
  return rows.filter((b) => b.complete_flag === "true" || !cleared.has(b.content_name)).map((b) => {
    const boss = b.content_name as string;
    const diff = DIFFICULTY[b.difficulty as string] ?? (b.difficulty as string);
    return { boss, diff, key: bossKey(boss, diff), monthly: b.cycle === "bossMonthly", done: b.complete_flag === "true" };
  });
}

/** Crystal sale price in meso, or null when no official price is known for that boss · difficulty. */
export const crystalPrice = (key: string): number | null => CRYSTAL[key] ?? null;
/** One member's share of a crystal (meso, rounded down). */
export const share = (price: number, party: number): number => Math.floor(price / Math.max(1, party));

/** Party sizes the user set: per character · boss · difficulty, and the last one per character · boss. */
export type PartyStore = Record<string, number>;
const partyKey = (ocid: string, boss: string, diff?: string) => (diff ? `${ocid}|${boss}|${diff}` : `${ocid}|${boss}`);

/** The party size to use: the one set for this difficulty, else the last one set for the boss, else solo; never above the cap. */
export function partyFor(store: PartyStore, ocid: string, boss: string, diff: string): number {
  const n = store[partyKey(ocid, boss, diff)] ?? store[partyKey(ocid, boss)] ?? 1;
  return Math.min(maxParty(boss), Math.max(1, Math.round(n)));
}
export function withParty(store: PartyStore, ocid: string, boss: string, diff: string, n: number): PartyStore {
  return { ...store, [partyKey(ocid, boss, diff)]: n, [partyKey(ocid, boss)]: n };
}

/** Prices the user changed, 만 메소 by item id. */
export type Prices = Partial<Record<ItemId, number>>;
export const priceOf = (id: ItemId, prices: Prices): number => (prices[id] ?? ITEMS[id].price) * 10_000;

/** What was checked this week: a box cell holds the item that came out, a single-item cell `true`. */
export type Marks = Record<string, string | true>;
export const markKey = (ocid: string, key: string, cat: Category) => `${ocid}|${key}|${cat}`;

export type Cell =
  | { cat: Category; kind: "none" }
  | { cat: Category; kind: "item"; id: ItemId; on: boolean }
  | { cat: Category; kind: "box"; id: BoxId; got: ItemId | null };

/** The six reward columns of one cleared boss. */
export function cellsOf(ocid: string, key: string, marks: Marks): Cell[] {
  const drops: Drop[] = DROPS[key] ?? [];
  return CATEGORIES.map(({ cat }) => {
    const d = drops.find((x) => (isBox(x) ? BOXES[x].cat : ITEMS[x].cat) === cat);
    if (!d) return { cat, kind: "none" };
    const m = marks[markKey(ocid, key, cat)];
    if (isBox(d)) {
      const got = typeof m === "string" && (BOXES[d].opts as string[]).includes(m) ? (m as ItemId) : null;
      return { cat, kind: "box", id: d, got };
    }
    return { cat, kind: "item", id: d, on: m === true };
  });
}

/** The personal material of a boss in meso (a tenth of its box each), or 0. */
export function materialValue(key: string, prices: Prices): number {
  const m = MATERIALS[key];
  return m ? Math.floor((priceOf(m.box, prices) * m.count) / PER_BOX) : 0;
}

/**
 * Rewards of one cleared boss in meso, for one member: the checked drops shared the way the split calculator shares
 * them (`evenMemberShare` — sold on the auction house, the fee paid again on handing each part over), plus the personal
 * material in full (every member gets their own, nothing to sell or hand over) when that is counted.
 */
export function rewardOf(cells: Cell[], key: string, prices: Prices, withMaterial: boolean, party: number, feePercent: number): number {
  let drops = 0;
  for (const c of cells) {
    if (c.kind === "item" && c.on) drops += priceOf(c.id, prices);
    if (c.kind === "box" && c.got) drops += priceOf(c.got, prices);
  }
  return evenMemberShare(drops, party, feePercent) +(withMaterial ? materialValue(key, prices) : 0);
}

const DAY = 86_400_000;
const KST = 9 * 3_600_000;
/** Start of this boss week (Thursday 00:00 KST) as epoch ms. */
export function weekStart(now: number): number {
  const local = now + KST;
  const midnight = local - (((local % DAY) + DAY) % DAY);
  const dow = new Date(midnight).getUTCDay(); // 0 = Sunday … 4 = Thursday
  return midnight - ((dow - 4 + 7) % 7) * DAY - KST;
}
/** The week's id ("YYYY-MM-DD" of its Thursday, KST): checks of an older week are not shown. */
export const weekId = (now: number): string => new Date(weekStart(now) + KST).toISOString().slice(0, 10);
/** Time to the next reset, whole days and hours. */
export function untilReset(now: number): { days: number; hours: number } {
  const left = Math.max(0, weekStart(now) + 7 * DAY - now);
  return { days: Math.floor(left / DAY), hours: Math.floor((left % DAY) / 3_600_000) };
}

/** KST date of the last day of the previous boss week (Wednesday): its scheduler tells what was cleared before this week. */
export const lastWeekDate = (now: number): string => new Date(weekStart(now) - 1 + KST).toISOString().slice(0, 10);

/**
 * Whether a monthly boss cleared now was cleared this week. Its clear stays on the scheduler all month, so it would
 * otherwise count every week. True when the month began this week; otherwise it is this week's when last week's
 * scheduler (`prev`) does not have it cleared. null = not known yet (last week's scheduler not here, or that call failed).
 * A past date's scheduler is taken as that day's state (the guide does not say when in the day it is read).
 */
export function monthlyThisWeek(boss: string, prev: SchedulerState | null | undefined, now: number): boolean | null {
  const month = new Date(now + KST).toISOString().slice(0, 7);
  if (lastWeekDate(now).slice(0, 7) !== month) return true;
  if (!prev) return null;
  return !bossRows(prev).some((r) => r.monthly && r.done && r.boss === boss);
}
