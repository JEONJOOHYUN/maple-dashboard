// One row of sunday_predictions (supabase/migrations/010_add_sunday_predictions.sql): the prediction the pages show
// right now, kept before the notice so the real record can be scored later. A backtest can be run again; what was
// shown cannot. Pure: the Cron reads the weeks and writes the row (store.ts).
import { predictionTarget, type SundayWeek } from "./history.ts";
import { ML_MODEL, blendPrediction, mlFor, type MlScores } from "./ml.ts";
import { MODEL_VERSION, bigDayWindow, predictSunday, shownPicks } from "./predict.ts";

export type Odds = { id: string; p: number };

export type PredictionRow = {
  sunday: string;
  model: string;
  /** The five picks in page order. */
  picks: Odds[];
  ranked: Odds[];
  themes: Record<string, number>;
  big_days: Record<string, { last: string | null; minWeeks: number; maxWeeks: number } | null>;
  data_end: string;
  missing_weeks: number;
};

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** `mlRows`: the stored foundation-model scores; when the page mixes them in, the row does too (model "stats+ml"). */
export function predictionRow(weeks: SundayWeek[], now: Date, mlRows: MlScores[] = []): PredictionRow {
  const sunday = predictionTarget(now, weeks);
  const ml = mlFor(mlRows, weeks, sunday);
  const p = ml ? blendPrediction(predictSunday(weeks, sunday), ml.scores) : predictSunday(weeks, sunday);
  const pOf = new Map(p.ranked.map((r) => [r.id, r.p]));
  const window = (id: string) => {
    const w = bigDayWindow(weeks, id, sunday);
    return w && { last: w.last, minWeeks: w.minWeeks, maxWeeks: w.maxWeeks };
  };
  return {
    sunday,
    model: ml ? `${MODEL_VERSION}+${ML_MODEL}` : MODEL_VERSION,
    picks: shownPicks(p).map((id) => ({ id, p: round4(pOf.get(id) ?? 0) })),
    ranked: p.ranked.map((r) => ({ id: r.id, p: round4(r.p) })),
    themes: Object.fromEntries(Object.entries(p.themes).map(([k, v]) => [k, round4(v)])),
    big_days: { shining: window("shining"), miracle: window("miracle") },
    data_end: weeks.filter((w) => w.date < sunday).at(-1)?.date ?? "",
    missing_weeks: p.missingWeeks,
  };
}
