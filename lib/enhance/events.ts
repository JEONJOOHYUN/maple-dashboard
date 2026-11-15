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

/**
 * One choice of the 모아보기 event field (A안, user 2026-11-16): one event with its own rounds, or every event
 * together (`name` = ""). A day with 샤타포스 and 1+1 on belongs to both events, so a three-day 샤타포스 with a 1+1
 * day inside it is still one 샤타포스 round.
 */
export type EventGroup = { name: string; label: string; rounds: EventRound[] };

const parts = (kind: string) => (kind ? kind.split(" · ") : []);

/** The event choices, in badge order: "이벤트 전체" first when there is more than one event. */
export function eventGroups<T>(records: T[], at: (r: T) => number, kind: (r: T) => string): EventGroup[] {
  const names = new Set<string>();
  for (const r of records) for (const name of parts(kind(r))) names.add(name);
  const rank = (name: string) => (ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length);
  const groups = [...names]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko"))
    .map((name) => ({ name, label: name, rounds: eventRounds(records, at, (r) => (parts(kind(r)).includes(name) ? name : "")) }));
  if (groups.length > 1) groups.unshift({ name: "", label: "이벤트 전체", rounds: eventRounds(records, at, kind) });
  return groups;
}

/** What the 모아보기 event fields picked, handed to an item window so it counts the same records. */
export type EventScope = { group: EventGroup; round?: EventRound };

/** Whether a record counts in a choice: the event on (any, for every event), on one of the round's days when one is picked. */
export const inGroup = (group: EventGroup, round: EventRound | undefined, t: number, kind: string) =>
  (group.name ? parts(kind).includes(group.name) : kind !== "") && (!round || round.dates.has(kstDate(t)));

/** A round as its date row reads: the dates alone under one event, with the events under every event. */
export const roundName = (group: EventGroup, round: EventRound) => (group.name ? roundDates(round.from, round.to) : round.label);

/** The days of a group's rounds, for counting how many rounds a card was in. */
export function roundOfDay(group: EventGroup): Map<string, number> {
  const out = new Map<string, number>();
  group.rounds.forEach((r, i) => r.dates.forEach((d) => out.set(d, i)));
  return out;
}

/** A group's records, all of them and per round (in `group.rounds` order), in one pass. */
export function splitGroup<T>(records: T[], group: EventGroup, at: (r: T) => number, kind: (r: T) => string): { all: T[]; rounds: T[][] } {
  const day = roundOfDay(group);
  const all: T[] = [];
  const rounds = group.rounds.map(() => [] as T[]);
  for (const r of records) {
    const t = at(r);
    if (!inGroup(group, undefined, t, kind(r))) continue;
    all.push(r);
    const i = day.get(kstDate(t));
    if (i !== undefined) rounds[i].push(r);
  }
  return { all, rounds };
}

/** How many rounds each card (by `key`) has records in. */
export function roundsPerCard<T>(rounds: T[][], key: (r: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of rounds) for (const k of new Set(list.map(key))) out.set(k, (out.get(k) ?? 0) + 1);
  return out;
}
