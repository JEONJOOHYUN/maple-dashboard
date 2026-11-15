// The foundation-model half of the Sunday prediction. Every week a GitHub Actions job (scripts/sunday-ml) builds the
// feature rows (ml-features.ts), runs TabICL v2 (Hugging Face jingang/TabICL, BSD-3) on them and posts the scores to
// app/api/sunday/ml, which keeps them in sunday_ml_scores. The pages mix them half and half with the statistical model.
// Why half and half (backtest 2026-11-15, C:/dev/_work/maple-sunday-data/hf/README.md): alone, TabICL misses most big
// days (1st pick right 16 of the last 52 Sundays vs 22); mixed, 24 · 40 · 46 of 52 (1st / any of 3 / any of 5) vs
// 22 · 38 · 45, and better on the 76 weeks before and on 39 earlier weeks no choice was made on. The weight was fixed
// in advance (0.3 ~ 0.7 score about the same). Without a fresh row the pages show the statistical model alone.
import { BUNDLES } from "./bundles.ts";
import type { SundayWeek } from "./history.ts";
import { SEASON_PATCHES, pickFive, themeOdds, type SundayPrediction } from "./predict.ts";

/** Stored with the scores and with every logged prediction that used them; change it with the features or settings. */
export const ML_MODEL = "tabicl2-2026-11-15";
export const ML_WEIGHT = 0.5;

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

/** The statistical prediction mixed with the model's scores (bundles it has no score for keep their own). */
export function blendPrediction(p: SundayPrediction, scores: Record<string, number>, w = ML_WEIGHT): SundayPrediction {
  const ranked = p.ranked
    .map((r) => ({ ...r, p: scores[r.id] === undefined ? r.p : (1 - w) * r.p + w * scores[r.id] }))
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
