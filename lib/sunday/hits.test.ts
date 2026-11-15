import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { recentHits } from "./hits.ts";
import { ML_MODEL, type MlScores } from "./ml.ts";
import { BACKTEST_HITS, predictSunday, shownPicks } from "./predict.ts";
import { mergeStored } from "./stored.ts";

const base = recentHits(SUNDAYS, []);

test("without model scores the record is the statistical backtest (bundled history ends 2026-11-08)", () => {
  assert.deepEqual({ weeks: base.weeks, top3: base.top3, five: base.five }, BACKTEST_HITS);
  assert.equal(base.ml, 0);
});

test("a week with this model's scores is counted with the mix; other models' rows are ignored", () => {
  const last = SUNDAYS.filter((w) => w.bundles.size).at(-1)!;
  const stats = predictSunday(SUNDAYS, last.date);
  assert.ok(shownPicks(stats).some((id) => last.bundles.has(id)), "the statistical picks held one that week");
  // Scores that bury the bundles that really came: with them that week's five picks miss.
  const scores = Object.fromEntries(stats.ranked.map((r) => [r.id, last.bundles.has(r.id) ? 0 : 0.99]));
  const row: MlScores = { sunday: last.date, model: ML_MODEL, data_end: "2026-11-01", data_hash: "x", scores };
  const mixed = recentHits(SUNDAYS, [row]);
  assert.equal(mixed.ml, 1);
  assert.equal(mixed.five, base.five - 1);
  assert.deepEqual(recentHits(SUNDAYS, [{ ...row, model: "older-model" }]), base);
});

test("one more recorded week moves the window: the new Sunday counts, the oldest drops out", () => {
  // 2026-11-15 as the Cron stored it (option enhance + hunting day).
  const nov15 = {
    sunday: "2026-11-15",
    notice_id: 1409,
    special: false,
    items: [
      { name: "몬스터 컬렉션 신규 몬스터 등록 확률 추가 100%" },
      { name: "사냥 시 소환되는 엘리트 몬스터 수 증가(1마리→3마리)" },
      { name: "주문의 흔적 강화 비용 50% 할인" },
      { name: "어빌리티 재설정 비용 50% 할인" },
    ],
  };
  const weeks = mergeStored(SUNDAYS, [nov15]);
  const hit = (w: (typeof weeks)[number], k: number) => shownPicks(predictSunday(weeks, w.date)).slice(0, k).some((id) => w.bundles.has(id));
  const recorded = weeks.filter((w) => w.bundles.size);
  const [dropped, added] = [recorded.at(-53)!, recorded.at(-1)!];
  assert.deepEqual([dropped.date, added.date], ["2025-11-16", "2026-11-15"]);
  const moved = recentHits(weeks, []);
  assert.equal(moved.weeks, 52);
  assert.equal(moved.top3, base.top3 - Number(hit(dropped, 3)) + Number(hit(added, 3)));
  assert.equal(moved.five, base.five - Number(hit(dropped, 5)) + Number(hit(added, 5)));
});
