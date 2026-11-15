import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { ML_COLUMNS, ML_MIN_HISTORY, mlRows, type MlRow } from "./ml-features.ts";

const named = (r: MlRow) => Object.fromEntries(ML_COLUMNS.map((c, i) => [c, Number.isNaN(r.x[i]) ? null : r.x[i]]));
const find = (rows: MlRow[], date: string, bundle: string) => rows.find((r) => r.date === date && r.bundle === bundle)!;

// The same numbers as the 2026-11-15 experiment's rows (C:/dev/_work/maple-sunday-data/hf/data/rows.csv; every row and
// column of it matched the port, hf/check-port.mjs). A change here changes what the model was tested on.
test("feature rows match the backtested experiment", () => {
  const { bids, train, target } = mlRows(SUNDAYS, "2026-11-15");
  assert.equal(bids.length, 18);
  assert.equal(train.length, 2383);
  assert.equal(target.length, 15);
  assert.equal(train[0].date, SUNDAYS[ML_MIN_HISTORY].date);
  assert.deepEqual(named(find(train, "2026-11-08", "treasure")), {
    g: 3, ratio: 0.285714, c4: 0.25, c8: 0.25, c13: 0.230769, c26: 0.269231, dr26: 0.222037, isBig: 0, isHunt: 1, isEnh: 0, isSf: 0,
    kindGap: 0.2, kindCnt4: 0.5, gBig: 1, bigSame: 0, prev2Has: 0, trans: 0.233695, transLift: 0.053665, prevSize: 1, prevHunt: 0,
    first: 0, last: 0, vac: 0, bid: 17, s_hit: 0, s_quiet: 0, s_p: null, s_since: 20, s_winter: 0, big_s_hit: 0, big_s_quiet: 0,
  });
  assert.equal(find(train, "2026-11-08", "treasure").y, 1);
  // the winter season patch's big-day Sunday (+2 weeks after 2025-12-18)
  assert.deepEqual(named(find(train, "2026-01-04", "miracle")), {
    g: 11, ratio: 0.169753, c4: 0, c8: 0, c13: 0.076923, c26: 0.038462, dr26: 0.056555, isBig: 1, isHunt: 0, isEnh: 0, isSf: 0,
    kindGap: 0.3, kindCnt4: 0.25, gBig: 3, bigSame: 0, prev2Has: 0, trans: 0.081822, transLift: 0.028216, prevSize: 5, prevHunt: 4,
    first: 1, last: 0, vac: 1, bid: 5, s_hit: 1, s_quiet: 0, s_p: 0.75, s_since: 2, s_winter: 1, big_s_hit: 1, big_s_quiet: 0,
  });
  const next = find(target, "2026-11-15", "miracle");
  assert.equal(next.y, null);
  assert.deepEqual([named(next).g, named(next).gBig, named(next).prevHunt, named(next).s_since], [7, 2, 2, 21]);
});

test("walk-forward: a week's row does not change when later weeks are added", () => {
  const early = mlRows(SUNDAYS.filter((w) => w.date < "2026-03-01"), "2026-03-01");
  const late = mlRows(SUNDAYS, "2026-11-15");
  const bidAt = ML_COLUMNS.indexOf("bid");
  for (const r of [...early.train, ...early.target]) {
    const l = find(late.train, r.date, r.bundle);
    assert.ok(l, `${r.date} ${r.bundle}`);
    assert.deepEqual(l.x.filter((_, i) => i !== bidAt), r.x.filter((_, i) => i !== bidAt), `${r.date} ${r.bundle}`);
    if (r.y !== null) assert.equal(l.y, r.y);
  }
});

test("too little history", () => {
  assert.throws(() => mlRows(SUNDAYS, SUNDAYS[ML_MIN_HISTORY - 1].date));
});
