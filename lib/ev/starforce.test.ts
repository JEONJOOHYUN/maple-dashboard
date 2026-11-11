import assert from "node:assert/strict";
import { test } from "node:test";
import { baseCost, maxStarFor, rates, starRange, starSteps, type StarOptions } from "./starforce.ts";

const base: StarOptions = {
  level: 200,
  event: "none",
  mvp: "none",
  pcRoom: false,
  starCatch: true,
  spareMeso: 0,
  protect: "auto",
  restore: "auto",
};

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

test("try cost follows the namu formula", () => {
  // 29→30 at Lv.200 is about 3.89억 (mapletiptip shows the same).
  near(baseCost(200, 29), 389_360_000, 100_000, "29→30");
  // Stars 0~9 use (S+1)/36.
  assert.equal(baseCost(200, 0), Math.round((1000 + 200 ** 3 / 36) / 100) * 100);
});

test("star catch matches the namu table", () => {
  const r15 = rates(15, { event: "none", starCatch: true });
  near(r15.success, 0.315, 1e-9, "15 success");
  near(r15.destroy, 0.02055, 1e-6, "15 destroy");
  const r29 = rates(29, { event: "none", starCatch: true });
  near(r29.destroy, 0.1979, 1e-4, "29 destroy");
  // The Sunday destroy cut is 30 % multiplicative.
  near(rates(15, { event: "destroy30", starCatch: true }).destroy, 0.014385, 1e-6, "15 destroy -30%");
});

test("max star by item level", () => {
  assert.equal(maxStarFor(160), 30);
  assert.equal(maxStarFor(130), 20);
  assert.equal(starSteps({ ...base, level: 130 }).length, 20);
});

test("cheapest choice per star matches the namu break-even table (Lv.200, no event)", () => {
  const pick = (spareEok: number, star: number) => {
    const s = starSteps({ ...base, spareMeso: spareEok * 1e8 })[star];
    return s.protect ? "protect" : s.restore ? "restore" : "floor";
  };
  // namu: 15성 restore below 65.08억, prevention above.
  assert.equal(pick(64, 15), "restore");
  assert.equal(pick(66.5, 15), "protect");
  // 16성: 12성 below 27.11억, restore up to 71.25억, prevention above.
  assert.equal(pick(25, 16), "floor");
  assert.equal(pick(40, 16), "restore");
  assert.equal(pick(72.5, 16), "protect");
  // 17성: 12성 below 23.63억, prevention above.
  assert.equal(pick(23, 17), "floor");
  assert.equal(pick(24.5, 17), "protect");
  // 19성 always 12성, 20 · 22성 always restore.
  for (const spare of [1, 50, 300]) {
    assert.equal(pick(spare, 19), "floor");
    assert.equal(pick(spare, 20), "restore");
    assert.equal(pick(spare, 22), "restore");
  }
});

test("manual choices are respected", () => {
  const steps = starSteps({ ...base, spareMeso: 10e8, protect: [15, 16, 17], restore: [] });
  assert.ok(steps[15].protect && steps[16].protect && steps[17].protect);
  assert.equal(steps[15].destroys, 0);
  assert.ok(!steps[18].restore);
  const none = starSteps({ ...base, spareMeso: 10e8, protect: [], restore: [] });
  assert.ok(none.slice(15, 23).every((s) => !s.protect && !s.restore));
});

test("ranges add up and grow with the spare price", () => {
  const steps = starSteps(base);
  const a = starRange(steps, 12, 17);
  const b = starRange(steps, 17, 22);
  const all = starRange(steps, 12, 22);
  near(a.meso + b.meso, all.meso, 1, "range sum");
  const pricey = starRange(starSteps({ ...base, spareMeso: 30e8 }), 12, 22);
  assert.ok(pricey.meso > all.meso);
  // Below 15 nothing can break and tries are 1/p.
  const low = starRange(steps, 0, 1);
  near(low.tries, 1 / 0.9975, 1e-9, "0→1 tries");
  assert.equal(low.destroys, 0);
});

test("matches starforce.gg (컴언 Lv.200, Shining, no MVP / PC room, spare 190억, optimized)", () => {
  // Table read from starforce.gg/ev on 2026-11-08 (12성 start, cumulative 억 메소).
  const steps = starSteps({ ...base, event: "shining", spareMeso: 190e8 });
  const gg: [number, number][] = [
    [13, 0.63],
    [15, 4.33],
    [17, 17.64],
    [18, 40.05],
    [19, 120.97],
    [20, 263.15],
    [21, 369.92],
    [22, 696.39],
    [23, 1653],
    [25, 13348],
  ];
  for (const [to, eok] of gg) {
    const got = starRange(steps, 12, to).meso / 1e8;
    assert.ok(Math.abs(got - eok) <= Math.max(0.02, eok * 0.0005), `12→${to}: ${got} vs ${eok}`);
  }
  // Prevention at 15 · 16 · 17, restore at 18.
  assert.deepEqual(steps.filter((s) => s.protect).map((s) => s.star), [15, 16, 17]);
  assert.deepEqual(steps.filter((s) => s.restore).map((s) => s.star), [18]);
});

test("max star: level bands, and an item's own cap below them", () => {
  const cases: [number, number][] = [[90, 5], [94, 5], [95, 8], [107, 8], [108, 10], [117, 10], [118, 15], [127, 15], [128, 20], [130, 20], [135, 20], [137, 20], [138, 30], [140, 30], [250, 30]];
  for (const [level, max] of cases) assert.equal(maxStarFor(level), max, `Lv.${level}`);
  const base: Omit<StarOptions, "level"> = { event: "none", mvp: "none", pcRoom: false, starCatch: true, spareMeso: 0, protect: [], restore: [] };
  assert.equal(starSteps({ ...base, level: 135 }).length, 20);
  assert.equal(starSteps({ ...base, level: 250 }).length, 30);
  // 데스티니 무기(2차): Lv.250 but 25 stars at most; the steps below the cap do not change.
  const capped = starSteps({ ...base, level: 250, maxStar: 25 });
  assert.equal(capped.length, 25);
  assert.equal(capped[24].meso, starSteps({ ...base, level: 250 })[24].meso);
  // A cap above the level rule does nothing.
  assert.equal(starSteps({ ...base, level: 130, maxStar: 25 }).length, 20);
});
