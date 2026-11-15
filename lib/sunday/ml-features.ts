// Feature rows for the Sunday foundation model (scripts/sunday-ml): one row per (Sunday, bundle), each built only from
// the Sundays before it (walk-forward), so a model trained on earlier rows never sees the week it predicts.
// Ported from the 2026-11-15 experiment (C:/dev/_work/maple-sunday-data/exp/m2-lib.mjs rowsAt, hf/export.mjs) without
// three columns: the event age (new weeks read by the Cron carry no event name), the weeks since a game update (it came
// from another site's list) and the lunar-holiday flag (a date list to keep up; the backtest was as good without it).
// ml-features.test.ts pins the port to the experiment's numbers.
import { bundleTheme, isBigBundle } from "./bundles.ts";
import type { SundayWeek } from "./history.ts";
import { SEASON_PATCHES, seasonCall, sundayAfter } from "./predict.ts";

/** Columns in file order; `bid` is categorical (bundle index), the rest numeric. */
export const ML_COLUMNS = [
  "g", "ratio", "c4", "c8", "c13", "c26", "dr26", "isBig", "isHunt", "isEnh", "isSf", "kindGap", "kindCnt4", "gBig", "bigSame",
  "prev2Has", "trans", "transLift", "prevSize", "prevHunt", "first", "last", "vac",
  "bid", "s_hit", "s_quiet", "s_p", "s_since", "s_winter", "big_s_hit", "big_s_quiet",
] as const;

export type MlRow = { date: string; bundle: string; /** null = the week to predict */ y: 0 | 1 | null; x: number[] };

/** Weeks of history before the first training row. */
export const ML_MIN_HISTORY = 8;

type Kind4 = "big" | "starforce" | "enhance" | "hunt" | "other";
const kind4 = (id: string): Kind4 => (isBigBundle(id) ? "big" : (bundleTheme(id) ?? "other"));
const isBigWeek = (w: SundayWeek) => w.bundles.has("shining") || w.bundles.has("miracle");

/** Week type for the transition counts: S / M = big day, H / E = hunting or enhancing only, X = both, O = other. */
function typeOf(w: SundayWeek): string {
  if (w.bundles.has("shining")) return "S";
  if (w.bundles.has("miracle")) return "M";
  const ks = new Set([...w.bundles].filter((b) => b !== "gift").map((b) => (bundleTheme(b) === "hunt" ? "H" : bundleTheme(b) ? "E" : "O")));
  if (ks.size === 0) return "O";
  if (ks.size === 1) return [...ks][0];
  return ks.has("O") ? "O" : "X";
}

function seasonFeatures(before: SundayWeek[], date: string) {
  const c = seasonCall(before, date);
  let since = 26;
  let winter = 0;
  for (const p of SEASON_PATCHES) {
    const s0 = sundayAfter(p.date, 0);
    if (s0 > date) break;
    since = Math.min(26, Math.round((Date.parse(date) - Date.parse(s0)) / 604_800_000));
    winter = p.season === "winter" ? 1 : 0;
  }
  return { hit: c?.kind === "hit" ? 1 : 0, quiet: c?.kind === "quiet" ? 1 : 0, p: c ? c.p : NaN, since, winter };
}

/** Same rounding as the experiment's CSV, so the model sees the same numbers. */
const r6 = (v: number) => (Number.isFinite(v) ? +v.toFixed(6) : NaN);

/**
 * Rows of one Sunday (`date`, index `j` in `weeks` or `weeks.length` for a Sunday not recorded yet), built from
 * weeks[0..j-1]. `bids` = the bundle ids in a fixed order (categorical index).
 */
function rowsFor(weeks: SundayWeek[], types: string[], j: number, date: string, t: number, bids: string[], truth: Set<string> | null): MlRow[] {
  const hist = weeks.slice(0, j);
  const T = t;
  const app = new Map<string, number[]>();
  const kindLast = new Map<Kind4, number>();
  for (const w of hist) {
    for (const id of w.bundles) {
      if (!app.has(id)) app.set(id, []);
      app.get(id)!.push(w.t);
      kindLast.set(kind4(id), w.t);
    }
  }
  // bundles seen in the last 52 weeks, newest week first (the experiment's order)
  const active = new Set<string>();
  for (let i = j - 1; i >= 0 && weeks[i].t >= T - 52; i--) for (const b of weeks[i].bundles) active.add(b);

  const bigW = hist.filter(isBigWeek);
  const gBig = bigW.length ? T - bigW[bigW.length - 1].t : 9;
  const lastBig = bigW.length ? bigW[bigW.length - 1] : null;
  const lastBigId = lastBig ? (lastBig.bundles.has("shining") ? "shining" : "miracle") : null;
  const last = hist[hist.length - 1];
  const byT = new Map(hist.slice(-6).map((w) => [w.t, w]));
  const prevWeek = byT.get(T - 1);
  const prev = prevWeek?.bundles ?? new Set<string>();
  const prev2 = byT.get(T - 2)?.bundles ?? new Set<string>();
  const prevType = prevWeek ? types[weeks.indexOf(prevWeek)] : "O";
  // decayed counts (half-life 52 weeks): every bundle, and what followed a week of last week's type
  let nTau = 0;
  let nAll = 0;
  const nTauB = new Map<string, number>();
  const nB = new Map<string, number>();
  for (let k = 0; k < hist.length; k++) {
    const wt = 0.5 ** ((T - hist[k].t) / 52);
    nAll += wt;
    for (const id of hist[k].bundles) nB.set(id, (nB.get(id) ?? 0) + wt);
    if (k > 0 && hist[k].t - hist[k - 1].t === 1 && types[k - 1] === prevType) {
      nTau += wt;
      for (const id of hist[k].bundles) nTauB.set(id, (nTauB.get(id) ?? 0) + wt);
    }
  }
  const prevHunt = [...prev].filter((b) => bundleTheme(b) === "hunt").length;
  const d = new Date(date + "T00:00:00Z");
  const day = d.getUTCDate();
  const mon = d.getUTCMonth() + 1;
  const dim = new Date(Date.UTC(d.getUTCFullYear(), mon, 0)).getUTCDate();
  const first = day <= 7 ? 1 : 0;
  const lastW = day > dim - 7 ? 1 : 0;
  const vac = mon === 1 || mon === 2 || mon === 7 || mon === 8 || (mon === 12 && day >= 20) ? 1 : 0;
  const dT = last.t;
  let dDen = 0;
  for (const w of hist) dDen += 0.5 ** ((dT - w.t) / 26);
  const season = seasonFeatures(hist, date);

  const rows: MlRow[] = [];
  for (const b of active) {
    const ts = app.get(b);
    if (!ts) continue;
    const g = Math.min(30, T - ts[ts.length - 1]);
    const gaps = ts.slice(1).map((v, i) => v - ts[i]).slice(-6);
    const mean = gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : Math.max(2, hist.length / ts.length);
    const ratio = Math.min(g / mean, 3) / 3;
    const cnt = (n: number) => ts.filter((v) => T - v <= n).length / n;
    let dn = 0;
    for (const v of ts) dn += 0.5 ** ((dT - v) / 26);
    const k4 = kind4(b);
    const big = k4 === "big" ? 1 : 0;
    const kindGap = Math.min(10, T - (kindLast.get(k4) ?? T - 10)) / 10;
    let kc = 0;
    for (const w of byT.values()) if (T - w.t <= 4 && [...w.bundles].some((x) => kind4(x) === k4)) kc++;
    const rate = (nB.get(b) ?? 0) / nAll;
    const trans = ((nTauB.get(b) ?? 0) + 4 * rate) / (nTau + 4);
    const x = [
      g, ratio, cnt(4), cnt(8), cnt(13), cnt(26), dn / dDen, big, k4 === "hunt" ? 1 : 0, k4 === "enhance" ? 1 : 0, k4 === "starforce" ? 1 : 0,
      kindGap, kc / 4, Math.min(gBig, 6), lastBigId === b ? 1 : 0,
      prev2.has(b) ? 1 : 0, trans, trans - rate, prev.size, prevHunt, first, lastW, vac,
    ].map(r6);
    x.push(bids.indexOf(b), season.hit, season.quiet, r6(season.p), season.since, season.winter, big * season.hit, big * season.quiet);
    rows.push({ date, bundle: b, y: truth ? (truth.has(b) ? 1 : 0) : null, x });
  }
  return rows;
}

/**
 * Training rows for every recorded Sunday after the first `ML_MIN_HISTORY`, then the rows of `target` (a Sunday after
 * the last recorded one). `weeks` = recorded Sundays in date order (bundled history + published weeks).
 */
export function mlRows(weeks: SundayWeek[], target: string): { bids: string[]; train: MlRow[]; target: MlRow[] } {
  const before = weeks.filter((w) => w.date < target);
  if (before.length <= ML_MIN_HISTORY) throw new Error(`not enough Sundays before ${target}`);
  const bids = [...new Set(before.flatMap((w) => [...w.bundles]))].sort();
  const types = before.map(typeOf);
  const train: MlRow[] = [];
  for (let j = ML_MIN_HISTORY; j < before.length; j++) train.push(...rowsFor(before, types, j, before[j].date, before[j].t, bids, before[j].bundles));
  const t = Math.round(Date.parse(target) / 604_800_000);
  return { bids, train, target: rowsFor(before, types, before.length, target, t, bids, null) };
}
