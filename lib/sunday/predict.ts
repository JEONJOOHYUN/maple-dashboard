// Next-Sunday prediction (statistics, no ML). Chosen by walk-forward backtests (2026-11-10, C:/dev/_work/maple-sunday-data/exp):
// 1) shining / miracle are one "big day" cycle (gaps 2~4 weeks in 18 of 22 cases) -> P(big day) from that gap, then split
//    by each one's own gap; 2) other bundles: gap hazard x recent frequency, learned on non-big weeks; 3) the 3 shown
//    picks cover different kinds, because hunting bundles all miss together on a big day.
// Last 52 weeks: 38/52 Sundays had one of the first 3 picks (22/27 on the 27 weeks from 2026-05-10, the comparison
// window). Five picks are shown since 2026-11-11 (user): 45/52 and 27/27 — the misses were mostly a second hunting
// benefit at rank 2~4. 551 other models (ML, longer history, cycle scores) did not beat this one out of sample
// (C:/dev/_work/maple-sunday-data/exp/m2-table.txt).
// 2026-11-15: + the season rhythm (seasonCall below). Same 38 / 45, the most likely pick right 22/52 instead of 20/52
// and better probabilities (log loss 5.49 vs 5.59); spring / autumn updates made it worse and are left out
// (C:/dev/_work/maple-sunday-data/exp/season-model.mjs, V3).
// 2026-11-15: the pages mix these scores half and half with a foundation model's when its weekly scores are stored
// (ml.ts); this file stays the statistical half and the fallback.
import { THEMES, bundleTheme, isBigBundle, type ThemeId } from "./bundles.ts";
import patchData from "./data/patches.json" with { type: "json" };
import type { SundayWeek } from "./history.ts";
import { weekIndex } from "./history.ts";

/** Stored with every logged prediction (sunday_predictions.model); change it whenever the scores change. */
export const MODEL_VERSION = "2026-11-15";

/** Training starts at the 2025-03-23 starforce rework: the current benefit line-up; it beat 2023-08 and older starts. */
export const TRAIN_START = "2025-03-23";
const HAZARD_K = 3; // pseudo-count pulling small samples toward the base rate
const HALF_LIFE = 26; // weeks, for "how often lately"
const ACTIVE_WEEKS = 52; // not seen for a year = discontinued
const PICKS = 5; // shown picks
const KINDS_FIRST = 3; // the first picks cover different kinds

type Has = (w: SundayWeek) => boolean;

function gapsOf(train: SundayWeek[], has: Has) {
  const idx: number[] = [];
  train.forEach((w, i) => has(w) && idx.push(i));
  return { gaps: idx.slice(1).map((v, i) => train[v].t - train[idx[i]].t), rate: train.length ? idx.length / train.length : 0 };
}

/** P(appears exactly now | gap g so far), neighbouring gaps pooled, smoothed toward the base rate. */
function hazard(train: SundayWeek[], has: Has, g: number, pool = 1): number {
  const { gaps, rate } = gapsOf(train, has);
  if (!gaps.length) return rate;
  let reached = 0;
  let ended = 0;
  for (let d = -pool; d <= pool; d++) {
    const x = g + d;
    if (x < 1) continue;
    for (const y of gaps) {
      if (y >= x) reached++;
      if (y === x) ended++;
    }
  }
  return (ended + HAZARD_K * rate) / (reached + HAZARD_K);
}

function decayRate(train: SundayWeek[], has: Has): number {
  const T = train[train.length - 1].t;
  let n = 0;
  let d = 0;
  for (const w of train) {
    const wt = 0.5 ** ((T - w.t) / HALF_LIFE);
    d += wt;
    if (has(w)) n += wt;
  }
  return n / d;
}

function since(train: SundayWeek[], has: Has, t: number): number {
  for (let i = train.length - 1; i >= 0; i--) if (has(train[i])) return t - train[i].t;
  return 99;
}

export type SeasonPatch = { date: string; season: "summer" | "winter"; confirmed: boolean };
export const SEASON_PATCHES = patchData.patches as SeasonPatch[];

/** The Sunday k weeks after the first Sunday that follows a patch day (patches are on Thursdays: +3 days). */
export function sundayAfter(patch: string, k: number): string {
  const d = new Date(patch + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) + 7 * k);
  return d.toISOString().slice(0, 10);
}

export type SeasonCall = {
  /** "hit" = the Sunday the big day usually comes on; "quiet" = a Sunday between the patch and it. */
  kind: "hit" | "quiet";
  /** P(big day) learned from the earlier patches of the same season. */
  p: number;
  patch: string;
  offset: number;
};

/**
 * Season rhythm: since the 2023-08 director change every summer / winter season patch was followed by a big day on a
 * set Sunday (summer +1 week, winter +2), with only hunting or gifts on the Sundays before it (6 of 6). Learned
 * walk-forward from the earlier patches of the same season whose four following Sundays are recorded in `before`:
 * the usual offset, how often a big day came on it, how often one came earlier. Null when the date is not near a patch.
 */
export function seasonCall(before: SundayWeek[], date: string, patches: SeasonPatch[] = SEASON_PATCHES): SeasonCall | null {
  const byDate = new Map(before.map((w) => [w.date, w]));
  const big = (d: string) => [...(byDate.get(d)?.bundles ?? [])].some(isBigBundle);
  for (const patch of patches) {
    const k = [0, 1, 2, 3].find((n) => sundayAfter(patch.date, n) === date);
    if (k === undefined) continue;
    const done = patches.filter((q) => q.season === patch.season && q.date < patch.date && [0, 1, 2, 3].every((n) => byDate.has(sundayAfter(q.date, n))));
    const firsts = done.map((q) => [0, 1, 2, 3].find((n) => big(sundayAfter(q.date, n)))).filter((n): n is number => n !== undefined);
    if (!firsts.length) return null;
    const counts = new Map<number, number>();
    for (const n of firsts) counts.set(n, (counts.get(n) ?? 0) + 1);
    const offset = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    if (k > offset) return null;
    if (k === offset) {
      const hits = done.filter((q) => big(sundayAfter(q.date, offset))).length;
      return { kind: "hit", p: (hits + 1) / (done.length + 2), patch: patch.date, offset };
    }
    let early = 0;
    for (const q of done) for (let n = 0; n < offset; n++) if (big(sundayAfter(q.date, n))) early++;
    return { kind: "quiet", p: (early + 0.5) / (done.length * offset + 1), patch: patch.date, offset };
  }
  return null;
}

export type BundleOdds = {
  id: string;
  /** Model score, roughly a probability. */
  p: number;
  /** Weeks between its last appearance and the target Sunday (null = never in the training window). */
  sinceWeeks: number | null;
  /** Mean weeks between appearances in the training window (null = fewer than 2 appearances). */
  avgGap: number | null;
};

export type SundayPrediction = {
  date: string;
  ranked: BundleOdds[];
  /** The 5 shown picks: best of each kind (big day / hunting / enhancing) first, then by score. */
  picks: string[];
  themes: Record<ThemeId, number>;
  /** P(big day): shining + miracle, or the big-day cycle alone when neither has come for a year. */
  pBig: number;
  /** Sundays between the last recorded one and the target that are missing from the data (predictions get worse). */
  missingWeeks: number;
};

const isBig: Has = (w) => [...w.bundles].some(isBigBundle);
const kindOf = (id: string) => (isBigBundle(id) ? "big" : bundleTheme(id) === "hunt" ? "hunt" : bundleTheme(id) ? "enhance" : "other");

/** The 5 shown picks from bundles sorted by score: the best of each kind first (hunting bundles all miss together on a big day), then by score. */
export function pickFive(ranked: { id: string }[]): string[] {
  const picks: string[] = [];
  const used = new Set<string>();
  for (const r of ranked) {
    if (picks.length === KINDS_FIRST) break;
    if (used.has(kindOf(r.id))) continue;
    picks.push(r.id);
    used.add(kindOf(r.id));
  }
  for (const r of ranked) if (picks.length < PICKS && !picks.includes(r.id)) picks.push(r.id);
  return picks;
}

/**
 * P(theme shows up) from bundle scores, the way predictSunday combines them: a big day (shining -> starforce,
 * miracle -> enhance) and a regular week exclude each other, and on a regular week each bundle of the theme
 * comes with its score / P(regular week). `pBig` = P(big day).
 */
export function themeOdds(ranked: { id: string; p: number }[], pBig: number): Record<ThemeId, number> {
  const pOf = new Map(ranked.map((r) => [r.id, r.p]));
  const bigOf: Partial<Record<ThemeId, number>> = { starforce: pOf.get("shining") ?? 0, enhance: pOf.get("miracle") ?? 0 };
  return Object.fromEntries(
    THEMES.map(({ id }) => {
      let none = 1;
      for (const r of ranked) if (!isBigBundle(r.id) && bundleTheme(r.id) === id) none *= 1 - Math.min(0.95, r.p / (1 - pBig));
      return [id, (bigOf[id] ?? 0) + (1 - pBig) * (1 - none)];
    }),
  ) as Record<ThemeId, number>;
}

export function predictSunday(weeks: SundayWeek[], date: string, start = TRAIN_START): SundayPrediction {
  const t = weekIndex(date);
  const before = weeks.filter((w) => w.date < date);
  const train = before.filter((w) => w.date >= start);
  if (!train.length) throw new Error(`no Sunday history before ${date}`);
  const active = new Set(before.filter((w) => w.t >= t - ACTIVE_WEEKS).flatMap((w) => [...w.bundles]));

  // stage 1: big day, then which one. Near a season patch its rhythm overrides the gap: the big day's Sunday goes up,
  // the Sundays before it go down.
  const season = seasonCall(before, date);
  let pBig = Math.min(0.9, hazard(train, isBig, since(train, isBig, t), 0));
  if (season?.kind === "hit") pBig = Math.max(pBig, season.p);
  if (season?.kind === "quiet") pBig = Math.min(pBig, season.p);
  const own = (id: string) => {
    const has: Has = (w) => w.bundles.has(id);
    return active.has(id) ? hazard(train, has, since(train, has, t)) : 0;
  };
  let hS = own("shining");
  let hM = own("miracle");
  if (season?.kind === "hit" && hS > 0 && hM > 0) {
    // On that Sunday the one that had waited longer came, 5 of 5 times since 2025.
    const longerShining = since(before, (w) => w.bundles.has("shining"), t) >= since(before, (w) => w.bundles.has("miracle"), t);
    [hS, hM] = longerShining ? [0.8, 0.2] : [0.2, 0.8];
  }
  const hSum = hS + hM || 1;
  const scores = new Map<string, number>([
    ["shining", (pBig * hS) / hSum],
    ["miracle", (pBig * hM) / hSum],
  ]);

  // stage 2: everything else, learned on regular (non-big) weeks; q = score given that it is a regular week
  const regular = train.filter((w) => !isBig(w));
  for (const id of active) {
    if (isBigBundle(id)) continue;
    const has: Has = (w) => w.bundles.has(id);
    const q = regular.some(has) ? Math.sqrt(hazard(regular, has, since(regular, has, t)) * decayRate(regular, has)) : 0.01 / (1 - pBig);
    scores.set(id, (1 - pBig) * q);
  }

  const ranked: BundleOdds[] = [...scores]
    .sort((a, b) => b[1] - a[1])
    .map(([id, p]) => {
      const has: Has = (w) => w.bundles.has(id);
      const { gaps } = gapsOf(train, has);
      const s = since(train, has, t);
      return { id, p, sinceWeeks: s === 99 ? null : s, avgGap: gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : null };
    });

  const last = before[before.length - 1];
  return { date, ranked, picks: pickFive(ranked), themes: themeOdds(ranked, pBig), pBig, missingWeeks: Math.max(0, t - last.t - 1) };
}

/** The five picks in the order the pages show them: most likely first (the model takes one per kind first). */
export function shownPicks(p: SundayPrediction): string[] {
  const pOf = new Map(p.ranked.map((r) => [r.id, r.p]));
  return [...p.picks].sort((a, b) => (pOf.get(b) ?? 0) - (pOf.get(a) ?? 0));
}

/** Themes of a recorded Sunday, in display order. */
export function themesOf(week: SundayWeek): ThemeId[] {
  const set = new Set([...week.bundles].map(bundleTheme).filter((x): x is ThemeId => !!x));
  return THEMES.map((x) => x.id).filter((id) => set.has(id));
}

export type BigDayWindow = {
  id: string;
  /** Last Sunday it came (null = never in the training window). */
  last: string | null;
  /** The usual gap: the 3-week-wide range that holds the most past gaps, and how many of them. */
  minWeeks: number;
  maxWeeks: number;
  covered: number;
  total: number;
  /** Weeks from the last one to the target Sunday. */
  sinceWeeks: number;
};

/**
 * When the next big day (shining / miracle) is due: its last date plus the usual gap.
 * The gap is loose (shining 3~11 weeks since 2025-03, 4~6 in 8 of 13), so this is a range, not a date.
 */
export function bigDayWindow(weeks: SundayWeek[], id: string, date: string, start = TRAIN_START): BigDayWindow | null {
  const t = weekIndex(date);
  const seen = weeks.filter((w) => w.date >= start && w.date < date && w.bundles.has(id));
  if (seen.length < 4) return null;
  const gaps = seen.slice(1).map((w, i) => w.t - seen[i].t);
  let best = { lo: gaps[0], n: 0 };
  for (let lo = Math.min(...gaps); lo <= Math.max(...gaps); lo++) {
    const n = gaps.filter((g) => g >= lo && g <= lo + 2).length;
    if (n > best.n) best = { lo, n };
  }
  const last = seen[seen.length - 1];
  return { id, last: last.date, minWeeks: best.lo, maxWeeks: best.lo + 2, covered: best.n, total: gaps.length, sinceWeeks: t - last.t };
}
