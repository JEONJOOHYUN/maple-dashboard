import assert from "node:assert/strict";
import { test } from "node:test";
import { baseCost, starSteps } from "../ev/starforce.ts";
import { knownItem, resolveItem } from "./items.ts";
import { caught, judge, restoredIds, starAfter, trackCopies } from "./judge.ts";
import { restorePrice } from "../ev/starforce.ts";
import { datesBetween, kstDate, kstWeekday } from "./kst.ts";
import { inRange, parseStarforce, type RawStarforce, type SfRow } from "./parse.ts";
import { buildStats, type Entry } from "./stats.ts";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

// The shape the API returned on 2026-11-12 (values made up).
const SHINING = [
  { success_rate: null, destroy_decrease_rate: null, cost_discount_rate: "30", plus_value: null, starforce_event_range: "0~29", recovery_cost_discount_rate: null },
  { success_rate: null, destroy_decrease_rate: null, cost_discount_rate: null, plus_value: null, starforce_event_range: null, recovery_cost_discount_rate: "20" },
  { success_rate: null, destroy_decrease_rate: "30", cost_discount_rate: null, plus_value: null, starforce_event_range: "15,16,17,18,19,20,21", recovery_cost_discount_rate: null },
];
let seq = 0;
const raw = (over: Partial<RawStarforce> = {}): RawStarforce => ({
  id: `id${seq++}`,
  item_upgrade_result: "실패(유지)",
  before_starforce_count: 17,
  after_starforce_count: 17,
  starforce_event_list: null,
  starcatch_result: null,
  superior_item_flag: "슈페리얼 장비 미해당",
  destroy_defence: "파괴 방지 미적용",
  chance_time: "찬스타임 미적용",
  event_field_flag: "파괴 방지 이벤트맵 미적용",
  upgrade_item: "",
  character_name: "테스트",
  world_name: "스카니아",
  target_item: "에테르넬 메이지팬츠",
  date_create: "2026-11-01T22:34:16.451+09:00",
  ...over,
});
const row = (over: Partial<RawStarforce> = {}): SfRow => parseStarforce(raw(over))!;
const ITEM = { level: 250, spare: 1e7 };

test("event ranges", () => {
  assert.ok(inRange("0~29", 17));
  assert.ok(inRange("15,16,17", 16));
  assert.ok(!inRange("15,16,17", 18));
  assert.ok(inRange(null, 3));
});

test("parse: flags, result and the events that apply to this star", () => {
  const a = row({ starforce_event_list: SHINING, destroy_defence: "파괴 방지 적용" });
  assert.deepEqual([a.r, a.from, a.to, a.pr, a.sup, a.sc, a.via], ["fail", 17, 17, true, false, false, ""]);
  assert.deepEqual([a.set, a.sale, a.cut, a.rs], ["shining", 30, 30, 20]);
  // The destroy cut stops at 21, the discount does not.
  const b = row({ starforce_event_list: SHINING, before_starforce_count: 22, after_starforce_count: 22 });
  assert.deepEqual([b.set, b.sale, b.cut], ["shining", 30, 0]);
  assert.equal(row({ item_upgrade_result: "성공", after_starforce_count: 18 }).r, "success");
  assert.equal(row({ item_upgrade_result: "파괴" }).r, "destroy");
  assert.equal(row({ starcatch_result: "성공" }).sc, true);
  assert.equal(row({ upgrade_item: "펄스 인핸서" }).via, "펄스 인핸서");
  assert.equal(parseStarforce({ id: "x" }), null);
});

test("judge: cost is rebuilt from level, star, discount and prevention", () => {
  const base = baseCost(250, 17);
  assert.equal(judge(row(), ITEM).cost, base);
  near(judge(row({ starforce_event_list: SHINING }), ITEM).cost, base * 0.7, 1, "30% off");
  near(judge(row({ starforce_event_list: SHINING, destroy_defence: "파괴 방지 적용" }), ITEM).cost, base * 0.7 + 2 * base, 1, "prevention adds 200% of the base");
});

test("judge: a try made the cheapest way is worth 0 on average", () => {
  // 2026-01 = the mini game still existed (caught or not); 2026-11 = always caught.
  for (const events of [null, SHINING]) {
    for (const [starcatch_result, date_create] of [[null, "2026-01-10T12:00:00+09:00"], ["성공", "2026-01-10T12:00:00+09:00"], [null, "2026-11-01T12:00:00+09:00"]] as const) {
      const some = row({ starforce_event_list: events, starcatch_result, date_create });
      const steps = starSteps({ level: 250, event: some.set, mvp: "none", pcRoom: false, starCatch: caught(some), spareMeso: ITEM.spare, protect: "auto", restore: "auto" });
      for (let s = 0; s < 30; s++) {
        const plan = steps[s];
        const r = row({ starforce_event_list: events, starcatch_result, date_create, before_starforce_count: s, after_starforce_count: s, destroy_defence: plan.protect ? "파괴 방지 적용" : "파괴 방지 미적용" });
        const j = judge(r, ITEM);
        assert.ok(j.ok);
        near(j.mean / plan.meso, 0, 1e-9, `mean at ${s} (${some.set}, catch ${caught(some)})`);
        assert.ok(j.variance > 0);
      }
    }
  }
});

test("judge: MVP and PC room lower the cost up to the 16→17 try and keep the average at 0", () => {
  const mine = { mvp: "diamond", pcRoom: true } as const;
  const at16 = row({ before_starforce_count: 16, after_starforce_count: 16, starforce_event_list: SHINING });
  near(judge(at16, ITEM, false, mine).cost, baseCost(250, 16) * 0.85 * 0.7, 1, "10% + 5%, then 30% off");
  assert.equal(judge(row(), ITEM, false, mine).cost, baseCost(250, 17));
  const steps = starSteps({ level: 250, event: "none", mvp: "diamond", pcRoom: true, starCatch: true, spareMeso: ITEM.spare, protect: "auto", restore: "auto" });
  for (let s = 0; s < 30; s++) {
    const r = row({ before_starforce_count: s, after_starforce_count: s, destroy_defence: steps[s].protect ? "파괴 방지 적용" : "파괴 방지 미적용" });
    near(judge(r, ITEM, false, mine).mean / steps[s].meso, 0, 1e-9, `mean at ${s}`);
  }
});

test("judge: success gains the star, fail loses the cost, destroy also loses the stars and the spare", () => {
  const ok = judge(row({ item_upgrade_result: "성공", after_starforce_count: 18 }), ITEM);
  const fail = judge(row(), ITEM);
  const boom = judge(row({ item_upgrade_result: "파괴" }), ITEM);
  const back = judge(row({ item_upgrade_result: "파괴" }), ITEM, true);
  assert.ok(ok.delta > 0);
  assert.equal(fail.delta, -fail.cost);
  assert.ok(boom.delta < fail.delta - ITEM.spare);
  assert.ok(back.restored && back.delta < fail.delta && back.delta !== boom.delta);
  // A restore is meso spent as well (17 stars at Lv.250: the published 34.46억).
  assert.equal(back.cost - boom.cost, restorePrice(250, 17)!.meso);
  // Prevention: no destroy chance.
  assert.equal(judge(row({ destroy_defence: "파괴 방지 적용" }), ITEM).d, 0);
});

test("star catch: always on since 2026-03-19, before that as recorded", () => {
  const p = (over: Partial<RawStarforce>) => judge(row({ before_starforce_count: 15, after_starforce_count: 15, ...over }), ITEM).p;
  near(p({ date_create: "2026-03-18T23:00:00+09:00" }), 0.3, 1e-9, "before, not caught");
  near(p({ date_create: "2026-03-18T23:00:00+09:00", starcatch_result: "성공" }), 0.315, 1e-9, "before, caught");
  near(p({ date_create: "2026-03-19T12:00:00+09:00" }), 0.315, 1e-9, "after");
});

test("judge: what is left out", () => {
  assert.equal(judge(row({ date_create: "2025-03-20T15:00:00+09:00" }), ITEM).why, "old");
  assert.equal(judge(row({ date_create: "2025-03-21T00:00:01+09:00" }), ITEM).ok, true);
  assert.equal(judge(row({ superior_item_flag: "슈페리얼 장비" }), ITEM).why, "superior");
  assert.equal(judge(row({ upgrade_item: "펄스 인핸서" }), ITEM).why, "item");
  assert.equal(judge(row(), { level: 0, spare: 0 }).why, "level");
  // A Lv.130 item stops at 20 stars.
  assert.equal(judge(row({ before_starforce_count: 21, after_starforce_count: 21 }), { level: 130, spare: 0 }).why, "range");
});

test("restored destroys: the next try on the same item is still at that star", () => {
  const boom1 = row({ item_upgrade_result: "파괴", date_create: "2026-11-01T10:00:00+09:00" });
  const next1 = row({ date_create: "2026-11-01T10:01:00+09:00" });
  const boom2 = row({ item_upgrade_result: "파괴", date_create: "2026-11-01T10:02:00+09:00" });
  const next2 = row({ before_starforce_count: 12, after_starforce_count: 12, date_create: "2026-11-01T10:03:00+09:00" });
  const other = row({ item_upgrade_result: "파괴", target_item: "다른 장비", date_create: "2026-11-01T10:04:00+09:00" });
  assert.deepEqual([...restoredIds([next2, other, boom2, next1, boom1])], [boom1.id]);
});

test("star after a try: destroy goes to 12 or stays when restored (22 at most), a fail keeps the API value", () => {
  assert.equal(starAfter(row({ item_upgrade_result: "성공", after_starforce_count: 18 }), false), 18);
  assert.equal(starAfter(row({ item_upgrade_result: "파괴" }), false), 12);
  assert.equal(starAfter(row({ item_upgrade_result: "파괴" }), true), 17);
  assert.equal(starAfter(row({ item_upgrade_result: "파괴", before_starforce_count: 23, after_starforce_count: 23 }), true), 22);
  // An item with no known level is not judged, but its restored destroy still shows 17 → 17.
  const unknown = judge(row({ item_upgrade_result: "파괴" }), { level: 0, spare: 0 }, true);
  assert.deepEqual([unknown.ok, unknown.restored, starAfter(row({ item_upgrade_result: "파괴" }), unknown.restored)], [false, true, 17]);
  // Before the 2025 revamp a fail could drop a star.
  assert.equal(starAfter(row({ item_upgrade_result: "실패(하락)", before_starforce_count: 16, after_starforce_count: 15 }), false), 15);
});

test("pieces with the same name are told apart by following the stars", () => {
  let n = 0;
  const at = () => `2026-11-01T10:${String(n++).padStart(2, "0")}:00+09:00`;
  const ok = (from: number) => row({ item_upgrade_result: "성공", before_starforce_count: from, after_starforce_count: from + 1, date_create: at() });
  const no = (from: number) => row({ before_starforce_count: from, after_starforce_count: from, date_create: at() });
  const boom = (from: number) => row({ item_upgrade_result: "파괴", before_starforce_count: from, after_starforce_count: from, date_create: at() });
  // piece 1: 15 → 16 → destroyed at 16 → continues at 12; piece 2 starts at 0 while piece 1 sits at 13; piece 1 again at 13.
  const list = [ok(15), boom(16), ok(12), ok(0), ok(1), no(13), ok(13)];
  const { copy, restored } = trackCopies(list);
  assert.deepEqual(list.map((r) => copy.get(r.id)), [1, 1, 1, 2, 2, 1, 1]);
  assert.equal(restored.size, 0);
  const info = resolveItem("에테르넬 메이지팬츠", {}, { levels: {}, spares: {} });
  const items = buildStats(list.map((r) => ({ row: r, j: judge(r, info), info, copy: copy.get(r.id)! }))).items;
  assert.deepEqual(items.map((it) => [it.copy, it.copies, it.start, it.now, it.tries]), [[1, 2, 15, 14, 5], [2, 2, 0, 2, 2]]);
  // What the results are worth = profit + meso spent.
  near(items[0].worth, items[0].delta + items[0].spent, 1e-6, "worth");
});

test("stats: counts, items and streaks", () => {
  const list = [
    row({ date_create: "2026-11-01T10:00:00+09:00" }),
    row({ date_create: "2026-11-01T10:01:00+09:00" }),
    row({ item_upgrade_result: "성공", after_starforce_count: 18, date_create: "2026-11-01T10:02:00+09:00" }),
    row({ before_starforce_count: 18, after_starforce_count: 18, item_upgrade_result: "파괴", date_create: "2026-11-02T10:03:00+09:00" }),
    row({ upgrade_item: "펄스 인핸서", target_item: "어센던트 펄스 링", date_create: "2026-11-02T10:04:00+09:00" }),
  ];
  const info = resolveItem("에테르넬 메이지팬츠", {}, { levels: {}, spares: {} });
  const entries: Entry[] = list.map((r) => ({ row: r, j: judge(r, info), info, copy: 1 }));
  const s = buildStats(entries);
  assert.deepEqual([s.total, s.judged, s.success, s.fail, s.destroy, s.skipped.item], [5, 4, 1, 2, 1, 1]);
  const pants = s.items.find((it) => it.item === "에테르넬 메이지팬츠")!;
  assert.deepEqual([pants.tries, pants.start, pants.now, pants.streak.n, pants.streak.star, pants.top.star, pants.top.destroy], [4, 17, 12, 2, 17, 18, 1]);
  near(pants.delta, s.delta, 1e-6, "one judged item holds the whole delta");
  assert.equal(s.luckTop, null);
  assert.deepEqual(s.odds.map((o) => [o.star, o.n]), [[17, 3], [18, 1]]);
  assert.equal(s.days.get("2026-11-01")!.tries, 3);
  assert.equal(s.days.get("2026-11-01")!.best!.label, "에테르넬 메이지팬츠 18성");
  // 2026-11-01 is a Sunday.
  assert.ok(s.weekdays[0] !== 0 && s.weekdays[1] !== 0 && s.weekdays[2] === 0);
});

test("stats: longest run of successes and of fails per item", () => {
  const at = (n: number) => `2026-11-01T10:${String(n).padStart(2, "0")}:00+09:00`;
  const ok = (from: number, n: number) => row({ item_upgrade_result: "성공", before_starforce_count: from, after_starforce_count: from + 1, date_create: at(n) });
  const no = (from: number, n: number) => row({ before_starforce_count: from, after_starforce_count: from, date_create: at(n) });
  // Tries under 12 stars are not part of a run: five fails at 9 and the climb from 9 to 12 do not count.
  const list = [no(9, 0), no(9, 1), no(9, 2), no(9, 3), no(9, 4), ok(9, 5), ok(10, 6), ok(11, 7), ok(12, 8), ok(13, 9), ok(14, 10), no(15, 11), no(15, 12), ok(15, 13), ok(16, 14), no(17, 15)];
  const info = resolveItem("에테르넬 메이지팬츠", {}, { levels: {}, spares: {} });
  const [it] = buildStats(list.map((r) => ({ row: r, j: judge(r, info), info, copy: 1 }))).items;
  assert.deepEqual(it.win, { n: 3, from: 12, to: 15 });
  assert.deepEqual(it.streak, { star: 15, n: 2 });
});

test("item table: sets, exact names and the user's own values", () => {
  assert.equal(knownItem("에테르넬 메이지팬츠")!.level, 250);
  assert.ok(knownItem("에테르넬 메이지케이프")!.spare > knownItem("에테르넬 메이지팬츠")!.spare);
  assert.equal(knownItem("여명의 가디언 엔젤 링")!.level, 160);
  assert.equal(knownItem("컴플리트 언더컨트롤")!.level, 200);
  assert.equal(knownItem("처음 보는 장비"), null);
  const found = { "처음 보는 장비": { level: 140, icon: "x", part: "반지" } };
  assert.equal(resolveItem("처음 보는 장비", found, { levels: {}, spares: {} }).level, 140);
  const mine = resolveItem("처음 보는 장비", found, { levels: { "처음 보는 장비": 160 }, spares: { "처음 보는 장비": 3 } });
  assert.deepEqual([mine.level, mine.spare, mine.source], [160, 3e8, "user"]);
  assert.equal(resolveItem("모르는 장비", {}, { levels: {}, spares: {} }).source, "none");
});

test("KST days", () => {
  assert.equal(kstDate(Date.parse("2026-11-01T00:30:00+09:00")), "2026-11-01");
  assert.equal(kstWeekday(Date.parse("2026-11-01T23:59:00+09:00")), 0);
  assert.deepEqual(datesBetween("2026-10-30", "2026-11-01"), ["2026-11-01", "2026-10-31", "2026-10-30"]);
});
