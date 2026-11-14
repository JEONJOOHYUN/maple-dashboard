// Event rounds for the 모아보기 event pick (user, 2026-11-14: "회차별" — one Sunday's 샤타포스, a three-day sale …).
import type { SfRow } from "./parse.ts";
import { addDays, kstDate } from "./kst.ts";

/** One round: the KST days it ran on (the days something was done in it), and what it was. */
export type EventRound = { id: string; label: string; what: string; from: string; to: string; dates: Set<string> };

/** A star force try with an event on — the line "이벤트 때 vs 평소" splits on. */
export const starEventOn = (row: Pick<SfRow, "set" | "sr" | "plus">) => row.set !== "none" || row.sr > 0 || row.plus > 0;

/** The events on for a try, named as its badges are (TryBadges), or "" for none. */
export function starEventKind(row: Pick<SfRow, "set" | "sr" | "plus">): string {
  const out: string[] = [];
  if (row.set === "shining") out.push("샤타포스");
  else if (row.set === "sale30") out.push("30% 할인");
  else if (row.set === "destroy30") out.push("파괴 30% 감소");
  if (row.sr >= 100) out.push("100% 성공");
  if (row.plus > 0) out.push("1+1");
  return out.join(" · ");
}

const ORDER = ["샤타포스", "30% 할인", "파괴 30% 감소", "100% 성공", "1+1", "미라클 타임"];
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

/** "11월 9일(일)" for one day, "10월 3일 ~ 5일" · "10월 31일 ~ 11월 2일" for more. */
export function roundDates(from: string, to: string): string {
  if (from === to) return `${md(from)}(${WEEKDAY[new Date(`${from}T00:00:00Z`).getUTCDay()]})`;
  return from.slice(0, 7) === to.slice(0, 7) ? `${md(from)} ~ ${Number(to.slice(8, 10))}일` : `${md(from)} ~ ${md(to)}`;
}

/**
 * Event rounds, newest first. `kind` = the events on for one record ("" = none). A day's events are all its records'
 * together, and days with the same events at most two days apart are one round: a three-day event the player skipped
 * a day of is still one, while weekly Sunday events stay apart.
 */
export function eventRounds<T>(records: T[], at: (r: T) => number, kind: (r: T) => string): EventRound[] {
  const byDay = new Map<string, Set<string>>();
  for (const r of records) {
    const k = kind(r);
    if (!k) continue;
    const day = kstDate(at(r));
    const set = byDay.get(day) ?? new Set<string>();
    for (const part of k.split(" · ")) set.add(part);
    byDay.set(day, set);
  }
  const rounds: EventRound[] = [];
  // One order for the names, whichever record came first that day: the same events read the same on every day.
  const rank = (name: string) => (ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length);
  for (const day of [...byDay.keys()].sort()) {
    const what = [...byDay.get(day)!].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko")).join(" · ");
    const last = rounds.at(-1);
    if (last && last.what === what && addDays(last.to, 2) >= day) {
      last.to = day;
      last.dates.add(day);
    } else rounds.push({ id: "", label: "", what, from: day, to: day, dates: new Set([day]) });
  }
  return rounds.map((r) => ({ ...r, id: `${r.from}|${r.what}`, label: `${r.what} · ${roundDates(r.from, r.to)}` })).reverse();
}

/** Whether a record was in the round: on one of its days, with an event on. */
export const inRound = (round: EventRound, t: number, on: boolean) => on && round.dates.has(kstDate(t));
