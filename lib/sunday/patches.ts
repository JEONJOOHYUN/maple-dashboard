// Season patch dates without a hand step (user 2026-11-17: "everything automatic, sure, without mistakes"). The bundled
// list (data/patches.json, checked by hand) plus the rows of sunday_patches, which the Sunday Cron writes from the
// NEXON Open API event notices (store.ts checkPatches). Every reader merges the two the same way (live.ts for the
// pages, store.ts for the prediction log, scripts/sunday-ml/export.mjs for the weekly model job), so the season rhythm
// (predict.ts seasonCall) and the model's fingerprint (ml.ts mlDataHash) agree everywhere.
//
// The rule, from the notices (checked 2026-11-17): the events that start on a season patch run until the day before
// the next one (VIP 사우나 2026-06-18 ~ 12-16 -> winter patch 12-17, the date estimated by hand before). Mid-season
// events run about 9 weeks (아르고 09-17 ~ 11-18). On the patch day the next season's events start, which confirms it.
import type { SeasonPatch } from "./predict.ts";

/** One event notice as the rule reads it: Korea-time dates (YYYY-MM-DD). */
export type EventSpan = { title: string; start: string; end: string };

/** A row of sunday_patches (supabase/migrations/012_add_sunday_patches.sql). */
export type StoredPatch = { season_key: string; date: string; season: "summer" | "winter"; confirmed: boolean };

/** An event at least this long runs from one season patch to the next (VIP 사우나: 181 days; mid-season ~62 · 90). */
export const SEASON_LONG_DAYS = 140;

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const isThursday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 4;
const month = (d: string) => Number(d.slice(5, 7));

/** "2026-winter": one summer and one winter patch a year; a winter patch moved into January keeps December's year. */
export function seasonKey(p: { date: string; season: string }): string {
  const year = Number(p.date.slice(0, 4));
  return `${p.season === "winter" && month(p.date) === 1 ? year - 1 : year}-${p.season}`;
}

/** Months a season patch can fall in: so far 12-18 ~ 12-21 and 06-18 ~ 06-20, with a month of slack after. */
function inSeason(date: string, season: "summer" | "winter"): boolean {
  const m = month(date);
  return season === "winter" ? m === 12 || m === 1 : m === 6 || m === 7;
}

/**
 * The bundled list with the stored rows, in date order: a stored row replaces the bundled entry of its season, except a
 * confirmed bundled entry (checked by hand), which nothing moves.
 */
export function mergePatches(bundled: SeasonPatch[], stored: StoredPatch[]): SeasonPatch[] {
  const byKey = new Map(bundled.map((p) => [seasonKey(p), p]));
  for (const s of stored) {
    if (byKey.get(s.season_key)?.confirmed) continue;
    byKey.set(s.season_key, { date: s.date, season: s.season, confirmed: s.confirmed });
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Event notices as spans: the KST date part of the NEXON times ("2026-11-15T00:00+09:00"). Undated ones are dropped. */
export function eventSpans(list: { title?: string; date_event_start?: string | null; date_event_end?: string | null }[]): EventSpan[] {
  return list
    .filter((n) => /^\d{4}-\d{2}-\d{2}/.test(n.date_event_start ?? "") && /^\d{4}-\d{2}-\d{2}/.test(n.date_event_end ?? ""))
    .map((n) => ({ title: n.title ?? "", start: n.date_event_start!.slice(0, 10), end: n.date_event_end!.slice(0, 10) }));
}

export type PatchCheck =
  | { action: "write"; key: string; patch: SeasonPatch; basis: PatchBasis; evidence: EventSpan[] }
  | {
      action: "skip";
      reason: "no-confirmed-patch" | "patch-day-no-events" | "out-of-season" | "not-thursday" | "keep-confirmed" | "unchanged";
      date?: string;
    };

/**
 * What a written date rests on: "season-events" = the end of the events that started on the last season patch,
 * "26-weeks" = no such event, 26 weeks after the last patch, "patch-day" = events started on the estimated day,
 * "season-started" = the next season's long events started on another day (a moved patch).
 */
export type PatchBasis = "season-events" | "26-weeks" | "patch-day" | "season-started";

/** Every season patch so far came exactly 26 weeks after the one before (6 of 6, 2023-12-21 ~ 2026-12-17). */
export const SEASON_WEEKS = 26;

/**
 * The next season patch from the ongoing event notices (NEXON lists ongoing and upcoming events only), as of `today`
 * (KST date). `known` = the merged list. Writes only what the notices show; anything odd is a skip with its reason and
 * the date stays as it was:
 * 1. Estimate: the events that started on the last confirmed season patch end the day before the next one (event
 *    lengths in between do not matter: only events of at least SEASON_LONG_DAYS count). Once they are gone (ended),
 *    the estimate already kept stands; with none at all, 26 weeks after the last patch.
 * 2. Once that day has come, events starting on it confirm it.
 * 3. A day that came without events of its own: the next season's long events that already started give the patch
 *    day, confirmed (a patch that was moved).
 */
export function checkSeasonPatch(known: SeasonPatch[], events: EventSpan[], today: string): PatchCheck {
  const sorted = [...known].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.filter((p) => p.confirmed && p.date <= today).at(-1);
  if (!last) return { action: "skip", reason: "no-confirmed-patch" };
  const season: SeasonPatch["season"] = last.season === "summer" ? "winter" : "summer";
  const long = (e: EventSpan) => daysBetween(e.start, e.end) >= SEASON_LONG_DAYS;

  const running = events.filter((e) => long(e) && e.start === last.date);
  const runningEnd = running.map((e) => e.end).sort().at(-1);
  const kept = sorted.find((p) => p.season === season && p.date > last.date);
  let date: string | null;
  let basis: PatchBasis;
  if (runningEnd) {
    date = addDays(runningEnd, 1);
    basis = "season-events";
  } else if (kept) {
    date = kept.date;
    basis = "season-events"; // written before from the events; unchanged unless confirmed below
  } else {
    date = addDays(last.date, SEASON_WEEKS * 7);
    basis = "26-weeks";
  }
  let confirmed = false;
  let evidence: EventSpan[] = running.filter((e) => e.end === runningEnd);
  // A season that already started before the estimate (a patch moved earlier, review 2026-11-18): its long events
  // (SEASON_LONG_DAYS+, only ever started on a season patch) give the day now, not once the estimate has passed.
  const estimate = date;
  const early = events.filter((e) => long(e) && e.start > last.date && e.start <= today && e.start < estimate && inSeason(e.start, season));
  if (date > today && early.length) {
    date = early.map((e) => e.start).sort()[0];
    confirmed = true;
    basis = "season-started";
    evidence = early.filter((e) => e.start === date);
  } else if (date <= today) {
    const opened = events.filter((e) => e.start === date);
    if (opened.length) {
      confirmed = true;
      basis = "patch-day";
      evidence = [...evidence, ...opened];
    } else date = null;
  }
  if (!date) {
    const started = events.filter((e) => long(e) && e.start > last.date && e.start <= today && inSeason(e.start, season));
    if (!started.length) return { action: "skip", reason: "patch-day-no-events" };
    date = started.map((e) => e.start).sort()[0];
    confirmed = true;
    basis = "season-started";
    evidence = started.filter((e) => e.start === date);
  }

  if (!inSeason(date, season)) return { action: "skip", reason: "out-of-season", date };
  if (!isThursday(date)) return { action: "skip", reason: "not-thursday", date };
  const key = seasonKey({ date, season });
  const now = sorted.find((p) => seasonKey(p) === key);
  if (now?.confirmed && (now.date !== date || !confirmed)) return { action: "skip", reason: "keep-confirmed", date };
  if (now && now.date === date && now.confirmed === confirmed) return { action: "skip", reason: "unchanged", date };
  return { action: "write", key, patch: { date, season, confirmed }, basis, evidence };
}
