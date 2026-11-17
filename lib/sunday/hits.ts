// The hit record on the Sunday page (user 2026-11-15: "the same numbers every week are not great"): how often the shown
// picks held a real benefit over the last 52 recorded Sundays, each predicted the way the page does it — the
// statistical model mixed with that week's stored model scores (sunday_ml_scores rows of ML_MODEL), or the statistical
// model alone for a week without them. Recomputed on every render (52 predictions, about 10 ms), so it moves as weeks
// are recorded and the weekly job adds scores. Weeks before the model went live (2026-11-15) were filled from its
// walk-forward backtest made with the same scripts (C:/dev/_work/maple-sunday-data/hf/out/e2e-deploy-v2.json).
// Next to each rate (user 2026-11-17): its change since last week and the last 12 Sundays as dots.
import type { SundayWeek } from "./history.ts";
import { ML_MODEL, blendPrediction, type MlScores } from "./ml.ts";
import { TRAIN_START, predictSunday, shownPicks } from "./predict.ts";

export const HIT_WEEKS = 52;
/** Recorded Sundays drawn as dots under each rate. */
export const HIT_MARKS = 12;

export type HitKey = "top3" | "five";

/** One recorded Sunday: did cards 1 ~ 3 / the 5 picks hold a benefit that came. */
export type WeekHit = { date: string; top3: boolean; five: boolean };

type Counts = { weeks: number; top3: number; five: number };

export type HitRecord = Counts & {
  /** Sundays predicted with model scores (the rest: statistical model alone). */
  ml: number;
  /** The same counts one recorded Sunday earlier, before the newest week came in; null when there is no earlier week. */
  prev: Counts | null;
  /** The last HIT_MARKS recorded Sundays of the window, oldest first. */
  marks: WeekHit[];
};

export function recentHits(weeks: SundayWeek[], mlRows: MlScores[], n = HIT_WEEKS): HitRecord {
  // Any stored row of this model for that Sunday counts, even if a week before it was corrected afterwards: the record
  // is what the page showed then.
  const scores = new Map(mlRows.filter((r) => r.model === ML_MODEL).map((r) => [r.sunday, r.scores]));
  // One week more than the window: without the newest week it gives last week's counts. Only Sundays the statistical
  // model can predict (it needs a recorded week from TRAIN_START on before them).
  const recorded = weeks.filter((w) => w.bundles.size && w.date > TRAIN_START).slice(-(n + 1));
  const rows = recorded.map((w) => {
    const stats = predictSunday(weeks, w.date);
    const s = scores.get(w.date);
    const picks = shownPicks(s ? blendPrediction(stats, s) : stats);
    return {
      date: w.date,
      ml: s !== undefined,
      top3: picks.slice(0, 3).some((id) => w.bundles.has(id)),
      five: picks.some((id) => w.bundles.has(id)),
    };
  });
  const count = (xs: typeof rows): Counts => ({
    weeks: xs.length,
    top3: xs.filter((x) => x.top3).length,
    five: xs.filter((x) => x.five).length,
  });
  const now = rows.slice(-n);
  return {
    ...count(now),
    ml: now.filter((x) => x.ml).length,
    prev: rows.length > n ? count(rows.slice(0, n)) : null,
    marks: now.slice(-HIT_MARKS).map(({ date, top3, five }) => ({ date, top3, five })),
  };
}

/**
 * First Sunday the models in use (predict.ts MODEL_VERSION, ml.ts ML_MODEL) predicted before its notice. Until it is
 * recorded the change shows "-" (user 2026-11-17: "the model just started, so '-' at first"): the weeks before are
 * re-predicted (backtest), so there is no last week the page really showed with these models. Move it with the models.
 */
export const HIT_CHANGE_FROM = "2026-11-22";

/** The percent shown for a count. */
export const hitRate = (hits: number, weeks: number) => Math.round((hits / weeks) * 100);

/**
 * Change of the shown percent since last week, in points of the shown (rounded) numbers: 0 = same; null = nothing to
 * compare yet (no last week, or the newest recorded Sunday is before HIT_CHANGE_FROM).
 */
export function hitChange(r: HitRecord, key: HitKey): number | null {
  const newest = r.marks.at(-1)?.date;
  if (!r.prev?.weeks || !r.weeks || !newest || newest < HIT_CHANGE_FROM) return null;
  return hitRate(r[key], r.weeks) - hitRate(r.prev[key], r.prev.weeks);
}

export type HitChangeLabel = { text: string; tone: "none" | "same" | "up" | "down"; spoken: string };

/**
 * The chip next to a rate (user 2026-11-17): "-" before there is a last week to compare, "유지" when the shown percent
 * is the same, "▲ 2%" / "▼ 2%" (a space after the arrow) when it moved. `spoken` is for screen readers.
 */
export function hitChangeLabel(change: number | null): HitChangeLabel {
  if (change === null) return { text: "-", tone: "none", spoken: "비교할 지난주 없음" };
  if (change === 0) return { text: "유지", tone: "same", spoken: "지난주와 같음" };
  const up = change > 0;
  const size = Math.abs(change);
  return { text: `${up ? "▲" : "▼"} ${size}%`, tone: up ? "up" : "down", spoken: `지난주보다 ${size}% ${up ? "오름" : "내림"}` };
}
