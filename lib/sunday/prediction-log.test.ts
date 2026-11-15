import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { MODEL_VERSION } from "./predict.ts";
import { predictionRow } from "./prediction-log.ts";
import { mergeStored } from "./stored.ts";

const nov15 = {
  sunday: "2026-11-15",
  notice_id: 1409,
  special: false,
  items: [
    { name: "몬스터 컬렉션 신규 몬스터 등록 확률 추가 100%" },
    { name: "몬스터 컬렉션 '의문의 모몽' 3개 지급" },
    { name: "사냥 시 소환되는 엘리트 몬스터 수 증가(1마리→3마리)" },
    { name: "주문의 흔적 강화 비용 50% 할인" },
    { name: "어빌리티 재설정 비용 50% 할인" },
  ],
};

test("prediction row: the Sunday the page predicts, its five picks in page order", () => {
  // Tuesday 2026-11-10 KST: 11-15 is not recorded yet -> the row is for 11-15, made from data up to 11-08.
  const tue = predictionRow(SUNDAYS, new Date("2026-11-10T03:00:00Z"));
  assert.deepEqual([tue.sunday, tue.data_end, tue.missing_weeks, tue.model], ["2026-11-15", "2026-11-08", 0, MODEL_VERSION]);
  assert.equal(tue.picks.length, 5);
  // page order: the one-per-kind three by score, then the other two by score
  for (const [a, b] of [[0, 1], [1, 2], [3, 4]]) assert.ok(tue.picks[a].p >= tue.picks[b].p);
  assert.ok(tue.ranked.length >= tue.picks.length);
  // Sunday 2026-11-15 with that week stored: the row moves on to 11-22. Statistical model alone: the hunting /
  // special / enhancing cards first (28 · 18 · 16%), then rune 25% and sol erda 20% (the other likely ones).
  const sun = predictionRow(mergeStored(SUNDAYS, [nov15]), new Date("2026-11-15T03:00:00Z"));
  assert.deepEqual([sun.sunday, sun.data_end], ["2026-11-22", "2026-11-15"]);
  assert.deepEqual(sun.picks, [
    { id: "monster-park", p: 0.275 },
    { id: "miracle", p: 0.1836 },
    { id: "soul", p: 0.1565 },
    { id: "rune", p: 0.2477 },
    { id: "sol-erda-hunt", p: 0.2016 },
  ]);
  assert.deepEqual(sun.big_days.miracle, { last: "2026-09-27", minWeeks: 8, maxWeeks: 10 });
});
