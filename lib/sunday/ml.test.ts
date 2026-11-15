import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { ML_MODEL, blendPrediction, mlDataHash, mlFor, parseMlUpload, type MlScores } from "./ml.ts";
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

test("mixing with the model's own scores changes nothing", () => {
  const b = blendPrediction(stats, own);
  assert.deepEqual(b.ranked.map((r) => r.id), stats.ranked.map((r) => r.id));
  assert.deepEqual(b.picks, stats.picks);
  for (const k of Object.keys(stats.themes) as (keyof typeof stats.themes)[]) assert.ok(Math.abs(b.themes[k] - stats.themes[k]) < 1e-12, k);
});

test("half and half; a bundle without a score keeps its own; picks and themes follow the mixed scores", () => {
  const b = blendPrediction(stats, { shining: 0.9, "monster-park": 0 });
  const pOf = (id: string) => b.ranked.find((r) => r.id === id)!.p;
  assert.ok(Math.abs(pOf("shining") - (own.shining + 0.9) / 2) < 1e-12);
  assert.ok(Math.abs(pOf("monster-park") - own["monster-park"] / 2) < 1e-12);
  assert.equal(pOf("treasure"), own.treasure);
  assert.equal(b.ranked[0].id, "shining");
  assert.deepEqual(b.picks, pickFive(b.ranked));
  assert.ok(Math.abs(b.pBig - (pOf("shining") + pOf("miracle"))) < 1e-12);
  assert.ok(b.themes.starforce > stats.themes.starforce);
  for (let i = 1; i < b.ranked.length; i++) assert.ok(b.ranked[i - 1].p >= b.ranked[i].p);
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
  const row: MlScores = { sunday: "2026-11-15", model: ML_MODEL, data_end: "2026-11-08", data_hash: hash15, scores: { shining: 0.9 } };
  const plain = getSundayPageData(now, SUNDAYS);
  const mixed = getSundayPageData(now, SUNDAYS, [row]);
  assert.equal(plain.prediction.ml, false);
  assert.equal(mixed.prediction.ml, true);
  assert.equal(mixed.prediction.picks[0].id, "shining");
  assert.equal(predictionRow(SUNDAYS, now).model, MODEL_VERSION);
  const logged = predictionRow(SUNDAYS, now, [row]);
  assert.equal(logged.model, `${MODEL_VERSION}+${ML_MODEL}`);
  assert.equal(logged.picks[0].id, "shining");
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
