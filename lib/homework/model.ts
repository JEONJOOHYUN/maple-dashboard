// Homework from NEXON's scheduler answer, kept apart from the screen so it can be tested.
// What the fields mean was read off real answers (2026-11-24): see the notes on each rule below.
import { addDays, dayStart, kstDate } from "../enhance/kst.ts";
import { bossRows, type SchedulerState as BossState } from "../revenue/calc.ts";

/** One row of the scheduler's `daily_contents` / `weekly_contents`. */
export type SchedulerContent = {
  content_name?: string;
  /** "contents" (counted by the game) or "quest" (`quest_state`). */
  type?: string;
  /** "true" when the row is on the character's in-game scheduler. */
  registration_flag?: string;
  now_count?: number;
  max_count?: number;
  /** Quests only: "0" not started · "1" under way · "2" done. */
  quest_state?: string | null;
};
export type HomeworkState = BossState & { daily_contents?: SchedulerContent[]; weekly_contents?: SchedulerContent[] };

export type Item = { name: string; done: boolean; /** "2/5": shown when the game counts more than one run. */ progress?: string; /** Bosses only. */ diff?: string };
export type Group = { items: Item[]; done: number; total: number };
export type CharHomework = { today: Group; week: Group; bosses: Group; monthly: Group; left: number };
export type AccountHomework = { today: Group; week: Group; left: number };

const group = (items: Item[]): Group => ({ items, done: items.filter((i) => i.done).length, total: items.length });
const EMPTY = group([]);
const leftOf = (...groups: Group[]) => groups.reduce((n, g) => n + g.total - g.done, 0);

/**
 * Homework that one clear finishes for every character of the NEXON account: the answer carries the same state (and
 * the same registration) on each of them. Monster Park is 14 runs a day for the whole account.
 */
export const isAccountWide = (name: string) =>
  name === "몬스터파크" || name.startsWith("에픽 던전") || name.startsWith("[몬스터파크]") || name.startsWith("[메이플 유니온]");

/**
 * A quest is done at state "2". Counted contents are done at their limit; the ones without a limit (epic dungeons,
 * the guild's culvert, whose count is a score) are done once the count is above zero.
 */
export function contentDone(c: SchedulerContent): boolean {
  if (c.type === "quest") return c.quest_state === "2";
  const now = c.now_count ?? 0;
  const max = c.max_count ?? 0;
  return max > 0 ? now >= max : now > 0;
}

/** The scheduler's names without their category in brackets; the long Monster Park quest gets its usual name. */
export function shortName(name: string): string {
  if (name.startsWith("[몬스터파크]")) return "몬스터파크 익스트림";
  if (name.startsWith("[메이플 유니온] ")) return `유니온 ${name.slice("[메이플 유니온] ".length)}`;
  return name.replace(/^\[(일일 퀘스트|주간 퀘스트|길드)\] /, "");
}

function toItem(c: SchedulerContent): Item {
  const max = c.max_count ?? 0;
  return { name: shortName(c.content_name as string), done: contentDone(c), ...(max > 1 ? { progress: `${c.now_count ?? 0}/${max}` } : {}) };
}

/** Picks the scheduler rows that count as homework. */
export type Shown = (row: { content_name?: string; registration_flag?: string }) => boolean;
/** The rows on the character's in-game scheduler. */
const registered: Shown = (c) => c.registration_flag === "true";

/**
 * One character's own homework: today (daily rows), this week (weekly rows), weekly bosses and monthly bosses.
 * `shown` picks the rows; by default the ones registered on the in-game scheduler. Account-wide rows are left to
 * `accountHomework`. Bosses come from the same rows as boss revenue: a boss registered at one difficulty and cleared
 * at another is done, a boss cleared without being registered (for that cycle) is not homework.
 */
export function charHomework(state: HomeworkState | null | undefined, shown: Shown = registered): CharHomework {
  if (!state) return { today: EMPTY, week: EMPTY, bosses: EMPTY, monthly: EMPTY, left: 0 };
  const own = (rows: SchedulerContent[] | undefined) => group((rows ?? []).filter((c) => c.content_name && !isAccountWide(c.content_name) && shown(c)).map(toItem));
  // Registered per cycle: a boss on the daily list only is not this week's homework, even when its weekly one was cleared.
  const wanted = new Set((state.boss_contents ?? []).filter(shown).map((b) => `${b.cycle}|${b.content_name}`));
  const rows = bossRows(state).filter((r) => wanted.has(`${r.monthly ? "bossMonthly" : "bossWeekly"}|${r.boss}`));
  const boss = (monthly: boolean) => group(rows.filter((r) => r.monthly === monthly).map((r) => ({ name: r.boss, diff: r.diff, done: r.done })));
  const today = own(state.daily_contents);
  const week = own(state.weekly_contents);
  const bosses = boss(false);
  const monthly = boss(true);
  return { today, week, bosses, monthly, left: leftOf(today, week, bosses, monthly) };
}

/**
 * The account-wide homework of one NEXON account, from the answers of its characters. Any character that carries a
 * row will do (a character that has not logged in for long carries fewer rows); a row is done when any of them says so.
 */
export function accountHomework(states: (HomeworkState | null | undefined)[], shown: Shown = registered): AccountHomework {
  const collect = (part: "daily_contents" | "weekly_contents") => {
    const byName = new Map<string, Item>();
    for (const s of states)
      for (const c of s?.[part] ?? []) {
        if (!c.content_name || !isAccountWide(c.content_name) || !shown(c)) continue;
        const item = toItem(c);
        const had = byName.get(c.content_name);
        if (!had || (item.done && !had.done)) byName.set(c.content_name, item);
      }
    return group([...byName.values()]);
  };
  const today = collect("daily_contents");
  const week = collect("weekly_contents");
  return { today, week, left: leftOf(today, week) };
}

export type Tally = { done: number; total: number; left: number };
const tally = (groups: Group[]): Tally => {
  const done = groups.reduce((n, g) => n + g.done, 0);
  const total = groups.reduce((n, g) => n + g.total, 0);
  return { done, total, left: total - done };
};

/** The page's four numbers: today, this week's contents, the weekly bosses and the monthly bosses. */
export function summarize(chars: CharHomework[], accounts: AccountHomework[]): { today: Tally; week: Tally; bosses: Tally; monthly: Tally } {
  return {
    today: tally([...chars.map((c) => c.today), ...accounts.map((a) => a.today)]),
    week: tally([...chars.map((c) => c.week), ...accounts.map((a) => a.week)]),
    bosses: tally(chars.map((c) => c.bosses)),
    monthly: tally(chars.map((c) => c.monthly)),
  };
}

/** What is left on a card, in a few words: counts for the long lists, names for the short ones. */
export function leftChips(hw: CharHomework): string[] {
  const out: string[] = [];
  const todayLeft = hw.today.total - hw.today.done;
  if (todayLeft > 0) out.push(`일일 ${todayLeft}`);
  const week = hw.week.items.filter((i) => !i.done);
  if (week.length > 2) out.push(`주간 ${week.length}`);
  else for (const i of week) out.push(i.progress ? `${i.name} ${i.progress}` : i.name);
  const bossLeft = hw.bosses.total - hw.bosses.done;
  if (bossLeft > 0) out.push(`주간 보스 ${bossLeft}`);
  for (const i of hw.monthly.items) if (!i.done) out.push(`월간 · ${i.name}`);
  return out;
}

/** Time left until the daily reset (00:00 KST). */
export function untilDailyReset(now: number): { hours: number; minutes: number } {
  const left = dayStart(addDays(kstDate(now), 1)) - now;
  return { hours: Math.floor(left / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) };
}

/**
 * One account's homework out of what each of its characters said about it (`accountHomework` of one answer each):
 * every row once, done when any character says so.
 */
export function mergeShared(parts: AccountHomework[]): AccountHomework {
  const merge = (lists: Item[][]) => {
    const byName = new Map<string, Item>();
    for (const items of lists)
      for (const item of items) {
        const had = byName.get(item.name);
        if (!had || (item.done && !had.done)) byName.set(item.name, item);
      }
    return group([...byName.values()]);
  };
  const today = merge(parts.map((p) => p.today.items));
  const week = merge(parts.map((p) => p.week.items));
  return { today, week, left: leftOf(today, week) };
}
