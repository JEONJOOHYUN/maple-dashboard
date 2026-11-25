// A character that has not logged in since the last reset gets a thin scheduler answer from NEXON: a couple of boss
// rows (the cleared ones) and one daily row, where a full answer lists every boss (82 rows) and every daily content
// (18), each with whether it is on the in-game scheduler. Read as it comes, a thin answer has nothing registered, so
// the character showed as "다 끝남" right after a reset (2026-11-26, checked against 14 days of real answers: the
// weekly rows come whole either way). The registrations are taken from the character's latest full answer of the
// last 14 days (what NEXON keeps); whether a row is done still comes from today's answer — a row it leaves out has
// not been done since the reset. Shared by the homework server, the member's boss revenue and a browser key's.
import { addDays, kstDate } from "../enhance/kst.ts";
import type { HomeworkState, SchedulerContent } from "./model.ts";
import type { SchedulerBoss } from "../revenue/calc.ts";

/** One character's scheduler: today's, or a past day's (NEXON keeps 14). Path and query, for the server's and the browser's callers. */
export const schedulerAsk = (ocid: string, date?: string): [string, Record<string, string>] => ["scheduler/character-state", date ? { ocid, date } : { ocid }];

/** A full answer lists every boss (82 in 2026-11); a thin one a few. */
const FULL_BOSS_ROWS = 20;
/** How far back NEXON answers for a date. */
export const LOOK_BACK_DAYS = 14;

export const isThin = (s: HomeworkState | null | undefined): boolean => !!s && (s.boss_contents?.length ?? 0) < FULL_BOSS_ROWS;

/** The part of a full answer that fills a thin one: the registered rows of the two lists a thin answer drops (a tenth of the answer). */
export type Registrations = Pick<HomeworkState, "boss_contents" | "daily_contents">;
const onSchedule = (row: { registration_flag?: string }) => row.registration_flag === "true";
export const registrationsOf = (s: HomeworkState): Registrations => ({ boss_contents: (s.boss_contents ?? []).filter(onSchedule), daily_contents: (s.daily_contents ?? []).filter(onSchedule) });

const contentKey = (c: SchedulerContent) => c.content_name ?? "";
const bossKey = (b: SchedulerBoss) => `${b.content_name}|${b.difficulty}|${b.cycle}`;
const notDone = (c: SchedulerContent): SchedulerContent => ({ ...c, now_count: 0, quest_state: c.type === "quest" ? "0" : c.quest_state });
const notCleared = (b: SchedulerBoss): SchedulerBoss => ({ ...b, complete_flag: "false" });

/**
 * The full answer's rows, each as today's answer has it (kept registered when either says so), or not done when today
 * leaves it out; rows only today has are kept too.
 */
function merged<T>(full: T[], today: T[], key: (row: T) => string, reset: (row: T) => T, flag: (row: T) => string | undefined): T[] {
  const now = new Map(today.map((row) => [key(row), row]));
  const out = full.map((row) => {
    const mine = now.get(key(row));
    if (!mine) return reset(row);
    now.delete(key(row));
    return flag(row) === "true" && flag(mine) !== "true" ? { ...mine, registration_flag: "true" } : mine;
  });
  return [...out, ...now.values()];
}

/** Today's thin answer with the registrations of a full one. A full answer (or none to fill from) comes back as it is. */
export function fillThin(today: HomeworkState, full: Registrations | null): HomeworkState {
  if (!full || !isThin(today)) return today;
  const flag = (row: { registration_flag?: string }) => row.registration_flag;
  return {
    ...today,
    boss_contents: merged(full.boss_contents ?? [], today.boss_contents ?? [], bossKey, notCleared, flag),
    daily_contents: merged(full.daily_contents ?? [], today.daily_contents ?? [], contentKey, notDone, flag),
  };
}

/** One past day's answer, or the kind of refusal NEXON gave (the caller's own names: "busy", "badKey", …). */
export type DayAnswer = { body: HomeworkState } | { kind: string };

/**
 * The latest full answer before today, newest day first. Two refusals are skipped: yesterday's "busy" (NEXON fills
 * the day before until early morning) and any on the oldest day (it may be past what NEXON keeps). Any other —
 * the network, maintenance, the key, the quota — throws: that is not "none found", so the caller does not keep it
 * and asks again. null = none of the last 14 days was full.
 */
export async function latestFull(now: number, day: (date: string) => Promise<DayAnswer>): Promise<Registrations | null> {
  const today = kstDate(now);
  for (let back = 1; back <= LOOK_BACK_DAYS; back++) {
    const got = await day(addDays(today, -back));
    if ("body" in got) {
      if (!isThin(got.body)) return registrationsOf(got.body);
    } else if (!((back === 1 && got.kind === "busy") || back === LOOK_BACK_DAYS)) throw new Error(got.kind);
  }
  return null;
}
