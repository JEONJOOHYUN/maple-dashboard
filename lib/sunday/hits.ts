// The hit record on the Sunday page (user 2026-11-15: "the same numbers every week are not great"): how often the shown
// picks held a real benefit over the last 52 recorded Sundays, each predicted the way the page does it — the
// statistical model mixed with that week's stored model scores (sunday_ml_scores rows of ML_MODEL), or the statistical
// model alone for a week without them. Recomputed on every render (52 predictions, about 10 ms), so it moves as weeks
// are recorded and the weekly job adds scores. Weeks before the model went live (2026-11-15) were filled from its
// walk-forward backtest made with the same scripts (C:/dev/_work/maple-sunday-data/hf/out/e2e-deploy-v2.json).
import type { SundayWeek } from "./history.ts";
import { ML_MODEL, blendPrediction, type MlScores } from "./ml.ts";
import { predictSunday, shownPicks } from "./predict.ts";

export const HIT_WEEKS = 52;

export type HitRecord = {
  weeks: number;
  /** Sundays where one of cards 1 ~ 3 came. */
  top3: number;
  /** Sundays where one of the 5 picks came. */
  five: number;
  /** Sundays predicted with model scores (the rest: statistical model alone). */
  ml: number;
};

export function recentHits(weeks: SundayWeek[], mlRows: MlScores[], n = HIT_WEEKS): HitRecord {
  // Any stored row of this model for that Sunday counts, even if a week before it was corrected afterwards: the record
  // is what the page showed then.
  const scores = new Map(mlRows.filter((r) => r.model === ML_MODEL).map((r) => [r.sunday, r.scores]));
  const recorded = weeks.filter((w) => w.bundles.size).slice(-n);
  let top3 = 0;
  let five = 0;
  let ml = 0;
  for (const w of recorded) {
    const stats = predictSunday(weeks, w.date);
    const s = scores.get(w.date);
    if (s) ml++;
    const picks = shownPicks(s ? blendPrediction(stats, s) : stats);
    if (picks.slice(0, 3).some((id) => w.bundles.has(id))) top3++;
    if (picks.some((id) => w.bundles.has(id))) five++;
  }
  return { weeks: recorded.length, top3, five, ml };
}
