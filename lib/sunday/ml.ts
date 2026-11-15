// The foundation-model part of the Sunday prediction. Every week a GitHub Actions job (scripts/sunday-ml) builds the
// feature rows (ml-features.ts), runs two pretrained tabular models on them, TabICL v2 (Hugging Face jingang/TabICL,
// BSD-3) and TabPFN v2 (Prior-Labs/TabPFN-v2-clf, Prior Labs License: "Built with PriorLabs-TabPFN" must be shown),
// averages them and posts the scores to app/api/sunday/ml (table sunday_ml_scores). The pages mix them with the
// statistical model (25% on the big days, 75% on the other bundles), then calibrate the mix (ML_CALIBRATION).
// Without a fresh row: the statistical model alone, uncalibrated.
// Why (backtests 2026-11-15, C:/dev/_work/maple-sunday-data/hf/README.md): alone, the foundation models miss most big
// days but rank hunting / enhancing bundles better than the statistical model. Weights and models were chosen on
// 2025-06-01 ~ 2026-05-03 (49 Sundays: 1st 16 -> 23, one-per-kind top 3 29 -> 36) and read once on the comparison
// site's 28 Sundays 2026-05-10 ~ 2026-11-15 (1st 13, top 3 23 -> 25, any of 5 28, log loss 5.83 -> 5.27).
import { BUNDLES } from "./bundles.ts";
import type { SundayWeek } from "./history.ts";
import { SEASON_PATCHES, pickFive, themeOdds, type SundayPrediction } from "./predict.ts";

/**
 * Stored with the scores and with every logged prediction that used them; change it with the features or settings
 * (the weights and the calibration below included: they change what the pages show and log).
 */
export const ML_MODEL = "tabicl2+tabpfn2-2026-11-15";
/**
 * Backtest of the mix over the same 52 Sundays as BACKTEST_HITS (2025-11-16 ~ 2026-11-08, site scripts end to end,
 * C:/dev/_work/maple-sunday-data/hf/e2e.mjs): cards 1 ~ 3 held a real benefit 42 times, the 5 picks 47 times.
 */
export const BACKTEST_HITS_ML = { weeks: 52, top3: 42, five: 47 };

/** Share of the model scores on shining / miracle, and on every other bundle. */
export const ML_WEIGHT_BIG = 0.25;
export const ML_WEIGHT = 0.75;

/**
 * Platt scaling of the mixed scores, q = sigmoid(a + b * logit(p)), fitted on the same 49 selection Sundays. The mix
 * was a little shy: its first card showed 37% on average and came on 46% of the 28 comparison Sundays. Calibrated: 42%,
 * log loss 5.269 -> 5.220 there (C:/dev/_work/maple-sunday-data/hf/calib.mjs). It only stretches the numbers (b > 1:
 * likely ones up, unlikely ones down), so the order, the picks and the hit counts stay the same.
 */
export const ML_CALIBRATION = { a: 0.368, b: 1.291 };

export function calibrate(p: number, c: { a: number; b: number } = ML_CALIBRATION): number {
  const q = Math.min(0.999, Math.max(0.001, p));
  return 1 / (1 + Math.exp(-(c.a + c.b * Math.log(q / (1 - q)))));
}

export type MlScores = {
  sunday: string;
  model: string;
  /** The last recorded Sunday the scores were computed from. */
  data_end: string;
  /** Fingerprint of everything the features read (mlDataHash): a week filled in or corrected later changes it. */
  data_hash: string;
  /** Bundle id -> P(it comes that Sunday). */
  scores: Record<string, number>;
};

/** 53-bit string hash (cyrb53): enough to notice changed inputs, not a security measure. */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Fingerprint of the inputs of the feature rows for `target` (ml-features.ts): every recorded Sunday before it with its
 * bundles, and the season patch dates. The last date alone is not enough: a missing week published later or a
 * corrected week changes the rows without changing it (Codex review 2026-11-15).
 */
export function mlDataHash(weeks: SundayWeek[], target: string): string {
  const days = weeks.filter((w) => w.date < target).map((w) => `${w.date}:${[...w.bundles].sort().join("+")}`);
  const patches = SEASON_PATCHES.map((p) => `${p.date}:${p.season}`);
  return hash53(`${days.join("|")}#${patches.join("|")}`);
}

/**
 * The scores to use for `target`: this model's row, computed from exactly the Sundays the page has before the target.
 * A row made before a week was recorded, filled in or corrected is ignored until the job runs again.
 */
export function mlFor(rows: MlScores[], weeks: SundayWeek[], target: string): MlScores | null {
  const mine = rows.filter((r) => r.sunday === target && r.model === ML_MODEL);
  if (!mine.length) return null;
  const hash = mlDataHash(weeks, target);
  return mine.find((r) => r.data_hash === hash) ?? null;
}

/**
 * The statistical prediction mixed with the model's scores (bundles it has no score for keep their own), then
 * calibrated (`cal` null = the plain mix, for tests).
 */
export function blendPrediction(
  p: SundayPrediction,
  scores: Record<string, number>,
  w = ML_WEIGHT,
  wBig = ML_WEIGHT_BIG,
  cal: { a: number; b: number } | null = ML_CALIBRATION,
): SundayPrediction {
  const ranked = p.ranked
    .map((r) => {
      const share = r.id === "shining" || r.id === "miracle" ? wBig : w;
      const mixed = scores[r.id] === undefined ? r.p : (1 - share) * r.p + share * scores[r.id];
      return { ...r, p: cal ? calibrate(mixed, cal) : mixed };
    })
    .sort((a, b) => b.p - a.p);
  const pBig = Math.min(0.95, ranked.filter((r) => r.id === "shining" || r.id === "miracle").reduce((s, r) => s + r.p, 0));
  return { ...p, ranked, picks: pickFive(ranked), themes: themeOdds(ranked, pBig), pBig };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isSunday = (d: unknown): d is string => typeof d === "string" && DATE.test(d) && new Date(d + "T00:00:00Z").getUTCDay() === 0;

/** Checks an upload from the weekly job; returns the row or why it was refused. */
export function parseMlUpload(body: unknown): MlScores | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Record<string, unknown>;
  if (!isSunday(b.sunday)) return "sunday must be a Sunday (YYYY-MM-DD)";
  if (!isSunday(b.data_end) || b.data_end >= b.sunday) return "data_end must be a Sunday before sunday";
  if (b.model !== ML_MODEL) return `model must be ${ML_MODEL}`;
  if (typeof b.data_hash !== "string" || !/^[0-9a-z]{1,16}$/.test(b.data_hash)) return "data_hash must be the job's fingerprint";
  if (!b.scores || typeof b.scores !== "object" || Array.isArray(b.scores)) return "scores must be an object";
  const entries = Object.entries(b.scores as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 40) return "scores must have 1 to 40 bundles";
  for (const [id, v] of entries) {
    if (!Object.hasOwn(BUNDLES, id)) return `unknown bundle ${id}`;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return `score of ${id} must be a number from 0 to 1`;
  }
  return { sunday: b.sunday, model: b.model, data_end: b.data_end, data_hash: b.data_hash, scores: Object.fromEntries(entries) as Record<string, number> };
}
