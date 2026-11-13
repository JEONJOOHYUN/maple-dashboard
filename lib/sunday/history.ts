import history from "./data/history.json" with { type: "json" };
import benefits from "./data/benefits.json" with { type: "json" };
import { bundleOf, type HistoryItem } from "./bundles.ts";

type RawWeek = {
  date: string;
  day?: string;
  event: string | null;
  special: boolean | null;
  notice: number[];
  items: HistoryItem[];
  none?: "event-only" | "no-sunday";
  note?: string;
};

export type SundayWeek = {
  date: string;
  /** Week index (days since epoch / 7), so gaps are plain subtraction. */
  t: number;
  event: string | null;
  special: boolean;
  notice: number[];
  items: HistoryItem[];
  bundles: Set<string>;
  note?: string;
  /** When the site got this week (ISO time): only weeks read from the notice by the Cron have one. */
  updated?: string;
  /** The pictures of the notice the week was read from (NEXON's addresses), for weeks read by the Cron. */
  images?: string[];
};

const groupByName = new Map(benefits.map((b) => [b.name, b.group]));
const groupOfName = (name: string) => groupByName.get(name) ?? "etc";

export const weekIndex = (date: string) => Math.round(Date.parse(date) / 604_800_000);

export function toWeek(w: RawWeek): SundayWeek {
  return {
    date: w.date,
    t: weekIndex(w.date),
    event: w.event,
    special: w.special === true,
    notice: w.notice,
    items: w.items,
    bundles: new Set(w.items.map((it) => bundleOf(it, groupOfName))),
    note: w.note,
  };
}

/** Sundays only (the 2023-01 power-up week and the 2024-04-01 Monday edition are left out of the model). */
export const SUNDAYS: SundayWeek[] = (history.weeks as RawWeek[]).filter((w) => !w.day).map(toWeek);
export const HISTORY_RANGE = history.range as [string, string];

/** Korea-time calendar date (YYYY-MM-DD) of an instant. */
export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** The Sunday of the current week in Korea time: today if it is Sunday, else the coming one. */
export function upcomingSunday(now: Date): string {
  const d = new Date(kstDate(now) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

export const addWeeks = (date: string, n: number) => new Date(Date.parse(date) + n * 604_800_000).toISOString().slice(0, 10);

/** "11월 15일(일)" style label. */
export function dateLabel(date: string, withDay = true): string {
  const d = new Date(date + "T00:00:00Z");
  const day = "일월화수목금토"[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일${withDay ? `(${day})` : ""}`;
}

export const noticeUrl = (id: number) => `https://maplestory.nexon.com/News/Event/${id}`;
