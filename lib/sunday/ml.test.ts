import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { recentHits } from "./hits.ts";
import { ML_CALIBRATION, ML_MODEL, ML_WEIGHT, ML_WEIGHT_BIG, blendPrediction, calibrate, mlDataHash, mlFor, parseMlUpload, type MlScores } from "./ml.ts";
import { MODEL_VERSION, pickFive, predictSunday, themeOdds } from "./predict.ts";
import { predictionRow } from "./prediction-log.ts";
import { getSundayPageData } from "./view.ts";

const stats = predictSunday(SUNDAYS, "2026-11-15");
const own = Object.fromEntries(stats.ranked.map((r) => [r.id, r.p]));

test("theme odds from the scores are the statistical model's own themes", () => {
  for (const d of ["2026-01-04", "2026-06-28", "2026-11-08", "2026-11-15"]) {
    const p = predictSunday(SUNDAYS, d);
    const t = themeOdds(p.ranked, p.pBig);
    for (const k of Object.keys(p.themes) as (keyof typeof t)[]) assert.ok(Math.abs(t[k] - p.themes[k]) < 1e-12, `${d} ${k}`);
  }
});

test("mixing with the model's own scores changes nothing (before calibration)", () => {
  const b = blendPrediction(stats, own, ML_WEIGHT, ML_WEIGHT_BIG, null);
  assert.deepEqual(b.ranked.map((r) => r.id), stats.ranked.map((r) => r.id));
  assert.deepEqual(b.picks, stats.picks);
  for (const k of Object.keys(stats.themes) as (keyof typeof stats.themes)[]) assert.ok(Math.abs(b.themes[k] - stats.themes[k]) < 1e-12, k);
});

test("big days get 25% of the model, the rest 75%; a bundle without a score keeps its own; picks and themes follow", () => {
  assert.deepEqual([ML_WEIGHT_BIG, ML_WEIGHT], [0.25, 0.75]);
  const b = blendPrediction(stats, { shining: 0.9, "monster-park": 0, treasure: 0.95 }, ML_WEIGHT, ML_WEIGHT_BIG, null);
  const pOf = (id: string) => b.ranked.find((r) => r.id === id)!.p;
  assert.ok(Math.abs(pOf("shining") - (0.75 * own.shining + 0.25 * 0.9)) < 1e-12);
  assert.ok(Math.abs(pOf("monster-park") - 0.25 * own["monster-park"]) < 1e-12);
  assert.ok(Math.abs(pOf("treasure") - (0.25 * own.treasure + 0.75 * 0.95)) < 1e-12);
  assert.equal(pOf("rune"), own.rune);
  assert.equal(b.ranked[0].id, "treasure");
  assert.deepEqual(b.picks, pickFive(b.ranked));
  assert.ok(Math.abs(b.pBig - (pOf("shining") + pOf("miracle"))) < 1e-12);
  assert.ok(b.themes.starforce > stats.themes.starforce);
  for (let i = 1; i < b.ranked.length; i++) assert.ok(b.ranked[i - 1].p >= b.ranked[i].p);
});

test("calibration stretches the mixed numbers and keeps the order and the picks", () => {
  assert.deepEqual(ML_CALIBRATION, { a: 0.368, b: 1.291 });
  assert.ok(Math.abs(calibrate(0.37) - 0.4209) < 1e-4); // the mix's average first card on the comparison Sundays
  assert.ok(calibrate(0.5) > 0.5 && calibrate(0.1) < 0.1);
  const scores = { shining: 0.3, treasure: 0.4, "monster-park": 0.05 };
  const plain = blendPrediction(stats, scores, ML_WEIGHT, ML_WEIGHT_BIG, null);
  const b = blendPrediction(stats, scores);
  assert.deepEqual(b.ranked.map((r) => r.id), plain.ranked.map((r) => r.id));
  assert.deepEqual(b.picks, plain.picks);
  const plainOf = (id: string) => plain.ranked.find((r) => r.id === id)!.p;
  for (const r of b.ranked) assert.ok(Math.abs(r.p - calibrate(plainOf(r.id))) < 1e-12, r.id);
  assert.ok(Math.abs(b.pBig - (calibrate(plainOf("shining")) + calibrate(plainOf("miracle")))) < 1e-12);
  assert.deepEqual(b.themes, themeOdds(b.ranked, b.pBig));
});

const hash15 = mlDataHash(SUNDAYS, "2026-11-15");

test("scores are used only for the same Sunday, model and recorded weeks", () => {
  const row: MlScores = { sunday: "2026-11-15", model: ML_MODEL, data_end: "2026-11-08", data_hash: hash15, scores: { treasure: 0.5 } };
  assert.equal(mlFor([row], SUNDAYS, "2026-11-15"), row);
  assert.equal(mlFor([{ ...row, model: "old" }], SUNDAYS, "2026-11-15"), null);
  assert.equal(mlFor([row], SUNDAYS, "2026-11-22"), null);
  assert.equal(mlFor([], SUNDAYS, "2026-11-15"), null);
  // made before 11-08 was recorded
  assert.equal(mlFor([{ ...row, data_hash: mlDataHash(SUNDAYS.slice(0, -1), "2026-11-15") }], SUNDAYS, "2026-11-15"), null);
  // an older week corrected after the scores were made: the last date is the same, the fingerprint is not (Codex review)
  const corrected = SUNDAYS.map((w) => (w.date === "2026-10-04" ? { ...w, bundles: new Set([...w.bundles, "gift"]) } : w));
  assert.notEqual(mlDataHash(corrected, "2026-11-15"), hash15);
  assert.equal(mlFor([row], corrected, "2026-11-15"), null);
  // later weeks do not matter
  assert.equal(mlDataHash(SUNDAYS.filter((w) => w.date < "2026-11-15"), "2026-11-15"), hash15);
});

test("the pages and the prediction log mix in the scores and say so", () => {
  const now = new Date("2026-11-10T03:00:00Z"); // Tue: predicting 2026-11-15
  const row: MlScores = { sunday: "2026-11-15", model: ML_MODEL, data_end: "2026-11-08", data_hash: hash15, scores: { treasure: 0.95 } };
  const plain = getSundayPageData(now, SUNDAYS);
  const mixed = getSundayPageData(now, SUNDAYS, [row]);
  assert.equal(plain.prediction.ml, false);
  assert.equal(mixed.prediction.ml, true);
  assert.equal(mixed.prediction.picks[0].id, "treasure");
  // the hit record is the live one (hits.ts), with the stored rows
  assert.deepEqual(mixed.prediction.hits, recentHits(SUNDAYS, [row]));
  assert.deepEqual(plain.prediction.hits, recentHits(SUNDAYS, []));
  assert.equal(predictionRow(SUNDAYS, now).model, MODEL_VERSION);
  const logged = predictionRow(SUNDAYS, now, [row]);
  assert.equal(logged.model, `${MODEL_VERSION}+${ML_MODEL}`);
  assert.equal(logged.picks[0].id, "treasure");
});

test("uploads: only a well-formed row of this model", () => {
  const ok = { sunday: "2026-11-22", model: ML_MODEL, data_end: "2026-11-15", data_hash: "abc123", scores: { shining: 0.2, treasure: 0.31 } };
  assert.deepEqual(parseMlUpload(ok), ok);
  assert.match(parseMlUpload(null) as string, /object/);
  assert.match(parseMlUpload({ ...ok, sunday: "2026-11-21" }) as string, /Sunday/);
  assert.match(parseMlUpload({ ...ok, data_end: "2026-11-22" }) as string, /data_end/);
  assert.match(parseMlUpload({ ...ok, model: "other" }) as string, /model/);
  assert.match(parseMlUpload({ ...ok, data_hash: "" }) as string, /data_hash/);
  assert.match(parseMlUpload({ ...ok, data_hash: "<script>" }) as string, /data_hash/);
  assert.match(parseMlUpload({ ...ok, scores: [] }) as string, /object/);
  assert.match(parseMlUpload({ ...ok, scores: {} }) as string, /1 to 40/);
  assert.match(parseMlUpload({ ...ok, scores: { nope: 0.1 } }) as string, /unknown bundle/);
  assert.match(parseMlUpload({ ...ok, scores: { treasure: 1.2 } }) as string, /0 to 1/);
  assert.match(parseMlUpload({ ...ok, scores: { treasure: "0.3" } }) as string, /0 to 1/);
  assert.match(parseMlUpload({ ...ok, scores: { constructor: 0.1 } }) as string, /unknown bundle/);
});
