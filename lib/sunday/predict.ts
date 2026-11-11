// Next-Sunday prediction (statistics, no ML). Chosen by walk-forward backtests (2026-11-10, C:/dev/_work/maple-sunday-data/exp):
// 1) shining / miracle are one "big day" cycle (gaps 2~4 weeks in 18 of 22 cases) -> P(big day) from that gap, then split
//    by each one's own gap; 2) other bundles: gap hazard x recent frequency, learned on non-big weeks; 3) the 3 shown
//    picks cover different kinds, because hunting bundles all miss together on a big day.
// Last 52 weeks: 38/52 Sundays had one of the first 3 picks (maplessunday's published record: 24/27 on its 27 weeks,
// ours 22/27). Five picks are shown since 2026-11-11 (user): 45/52 and 27/27 — the misses were mostly a second hunting
// benefit at rank 2~4. 551 other models (ML, longer history, cycle scores) did not beat this one out of sample
// (C:/dev/_work/maple-sunday-data/exp/m2-table.txt).
import { THEMES, bundleTheme, isBigBundle, type ThemeId } from "./bundles.ts";
import type { SundayWeek } from "./history.ts";
import { weekIndex } from "./history.ts";

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
  /** Sundays between the last recorded one and the target that are missing from the data (predictions get worse). */
  missingWeeks: number;
};

const isBig: Has = (w) => [...w.bundles].some(isBigBundle);
const kindOf = (id: string) => (isBigBundle(id) ? "big" : bundleTheme(id) === "hunt" ? "hunt" : bundleTheme(id) ? "enhance" : "other");

export function predictSunday(weeks: SundayWeek[], date: string, start = TRAIN_START): SundayPrediction {
  const t = weekIndex(date);
  const before = weeks.filter((w) => w.date < date);
  const train = before.filter((w) => w.date >= start);
  if (!train.length) throw new Error(`no Sunday history before ${date}`);
  const active = new Set(before.filter((w) => w.t >= t - ACTIVE_WEEKS).flatMap((w) => [...w.bundles]));

  // stage 1: big day, then which one
  const pBig = Math.min(0.9, hazard(train, isBig, since(train, isBig, t), 0));
  const own = (id: string) => {
    const has: Has = (w) => w.bundles.has(id);
    return active.has(id) ? hazard(train, has, since(train, has, t)) : 0;
  };
  const hS = own("shining");
  const hM = own("miracle");
  const hSum = hS + hM || 1;
  const scores = new Map<string, number>([
    ["shining", (pBig * hS) / hSum],
    ["miracle", (pBig * hM) / hSum],
  ]);

  // stage 2: everything else, learned on regular (non-big) weeks
  const regular = train.filter((w) => !isBig(w));
  const onRegular = new Map<string, number>(); // score given that it is a regular week
  for (const id of active) {
    if (isBigBundle(id)) continue;
    const has: Has = (w) => w.bundles.has(id);
    const q = regular.some(has) ? Math.sqrt(hazard(regular, has, since(regular, has, t)) * decayRate(regular, has)) : 0.01 / (1 - pBig);
    onRegular.set(id, q);
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

  const picks: string[] = [];
  const used = new Set<string>();
  for (const r of ranked) {
    if (picks.length === KINDS_FIRST) break;
    if (used.has(kindOf(r.id))) continue;
    picks.push(r.id);
    used.add(kindOf(r.id));
  }
  for (const r of ranked) if (picks.length < PICKS && !picks.includes(r.id)) picks.push(r.id);

  // P(theme shows up) = its big day (shining -> starforce, miracle -> enhance) + regular week x P(any of its bundles | regular).
  // Big days and regular weeks exclude each other, so the regular part is combined before multiplying by P(regular) once.
  const bigOf: Partial<Record<ThemeId, number>> = { starforce: scores.get("shining") ?? 0, enhance: scores.get("miracle") ?? 0 };
  const themes = Object.fromEntries(
    THEMES.map(({ id }) => {
      let none = 1;
      for (const [b, q] of onRegular) if (bundleTheme(b) === id) none *= 1 - Math.min(0.95, q);
      return [id, (bigOf[id] ?? 0) + (1 - pBig) * (1 - none)];
    }),
  ) as Record<ThemeId, number>;

  const last = before[before.length - 1];
  return { date, ranked, picks, themes, missingWeeks: Math.max(0, t - last.t - 1) };
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
