import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { HIT_CHANGE_FROM, HIT_MARKS, hitChange, hitChangeLabel, recentHits } from "./hits.ts";
import { ML_MODEL, type MlScores } from "./ml.ts";
import { BACKTEST_HITS, MODEL_VERSION, predictSunday, shownPicks } from "./predict.ts";
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
  // Last week's counts are the window before 2026-11-15 came in, and the newest dot is that Sunday.
  assert.deepEqual(moved.prev, { weeks: base.weeks, top3: base.top3, five: base.five });
  assert.deepEqual(moved.marks.at(-1), { date: "2026-11-15", top3: hit(added, 3), five: hit(added, 5) });
});

test("last week's counts = the record without the newest recorded Sunday", () => {
  const last = SUNDAYS.filter((w) => w.bundles.size).at(-1)!;
  const before = recentHits(
    SUNDAYS.filter((w) => w.date < last.date),
    [],
  );
  assert.deepEqual(base.prev, { weeks: before.weeks, top3: before.top3, five: before.five });
});

test("the dots are the last 12 recorded Sundays, oldest first, each counted like the rates", () => {
  const recorded = SUNDAYS.filter((w) => w.bundles.size);
  assert.equal(base.marks.length, HIT_MARKS);
  assert.deepEqual(
    base.marks.map((m) => m.date),
    recorded.slice(-HIT_MARKS).map((w) => w.date),
  );
  for (const m of base.marks) {
    const w = recorded.find((x) => x.date === m.date)!;
    const picks = shownPicks(predictSunday(SUNDAYS, m.date));
    assert.equal(m.top3, picks.slice(0, 3).some((id) => w.bundles.has(id)), m.date);
    assert.equal(m.five, picks.some((id) => w.bundles.has(id)), m.date);
  }
});

test("the change compares the shown (rounded) percents: 0 = same, null = nothing to compare", () => {
  const newest = { date: HIT_CHANGE_FROM, top3: true, five: true };
  const r = { ...base, weeks: 52, top3: 42, five: 47, prev: { weeks: 52, top3: 42, five: 46 }, marks: [newest] };
  assert.equal(hitChange(r, "top3"), 0); // 81% -> 81%
  assert.equal(hitChange(r, "five"), 2); // 88% -> 90%
  assert.equal(hitChange({ ...r, prev: { weeks: 52, top3: 43, five: 45 } }, "top3"), -2); // 83% -> 81%
  assert.equal(hitChange({ ...r, five: 46, prev: { weeks: 52, top3: 42, five: 45 } }, "five"), 1); // 87% -> 88%
  assert.equal(hitChange({ ...r, prev: null }, "top3"), null);
  // Before the first Sunday the models in use predicted ahead of its notice is recorded: "-", whatever the counts say.
  assert.equal(hitChange({ ...r, marks: [{ ...newest, date: "2026-11-15" }] }, "five"), null);
  assert.equal(hitChange(base, "five"), null); // bundled history ends 2026-11-08
});

test("HIT_CHANGE_FROM is a Sunday after the models in use were made (move it when MODEL_VERSION or ML_MODEL changes)", () => {
  assert.equal(new Date(`${HIT_CHANGE_FROM}T00:00:00Z`).getUTCDay(), 0);
  for (const version of [MODEL_VERSION, ML_MODEL]) {
    const made = version.match(/\d{4}-\d{2}-\d{2}$/)?.[0];
    assert.ok(made && HIT_CHANGE_FROM > made, `${version}: HIT_CHANGE_FROM ${HIT_CHANGE_FROM} must come after ${made}`);
  }
});

test("the chip text: '-' before a last week, '유지' when the same, '▲ 2%' / '▼ 2%' with a space after the arrow", () => {
  assert.deepEqual(hitChangeLabel(null), { text: "-", tone: "none", spoken: "비교할 지난주 없음" });
  assert.deepEqual(hitChangeLabel(0), { text: "유지", tone: "same", spoken: "지난주와 같음" });
  assert.deepEqual(hitChangeLabel(2), { text: "▲ 2%", tone: "up", spoken: "지난주보다 2% 오름" });
  assert.deepEqual(hitChangeLabel(-2), { text: "▼ 2%", tone: "down", spoken: "지난주보다 2% 내림" });
  assert.equal(hitChangeLabel(1).text, "▲ 1%");
});
