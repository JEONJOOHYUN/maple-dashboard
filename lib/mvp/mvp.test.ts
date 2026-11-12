import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auctionWon,
  chargePlan,
  creditPlan,
  itemRate,
  msToDeadline,
  mvpState,
  sellRoute,
  tierOf,
  weekList,
  weekStart,
  type ChargeMethod,
  type CreditItem,
  type Market,
  type SellItem,
} from "./mvp.ts";

// 2026-11-08 (Sun) 12:00 KST
const NOW = Date.parse("2026-11-08T03:00:00Z");

test("weeks start on Thursday (KST)", () => {
  assert.equal(weekStart(NOW), "2026-11-05");
  // Wednesday 23:30 KST still belongs to the week that started the Thursday before.
  assert.equal(weekStart(Date.parse("2026-11-11T14:30:00Z")), "2026-11-05");
  // Thursday 00:10 KST starts a new week.
  assert.equal(weekStart(Date.parse("2026-11-11T15:10:00Z")), "2026-11-12");
  const { closed, current } = weekList(NOW);
  assert.equal(closed.length, 13);
  assert.equal(closed[0], "2026-08-06");
  assert.equal(closed[12], "2026-10-29");
  assert.equal(current, "2026-11-05");
  // Deadline: Wed 11/11 23:59:59 → Thu 00:00 KST = 2026-11-11T15:00Z.
  assert.equal(msToDeadline(NOW), Date.parse("2026-11-11T15:00:00Z") - NOW);
});

test("grade now and next Thursday", () => {
  const amounts: Record<string, number> = {};
  const { closed, current } = weekList(NOW);
  [5, 0, 12, 8, 0, 10, 3, 0, 15, 5, 8, 2, 0].forEach((man, i) => (amounts[closed[i]] = man * 10_000));
  const s = mvpState(amounts, NOW);
  assert.equal(s.sumNow, 680_000);
  assert.equal(s.now?.name, "골드");
  // The oldest week (5만) drops out next Thursday.
  assert.equal(s.sumNext, 630_000);
  assert.equal(s.up?.name, "다이아");
  assert.equal(s.need, 270_000);
  amounts[current] = 270_000;
  assert.equal(mvpState(amounts, NOW).next?.name, "다이아");
  assert.equal(tierOf(149_999), null);
});

test("charge plan fills the biggest discount first within caps", () => {
  const methods: ChargeMethod[] = [
    { id: "book", name: "도서", note: "", discountPct: 6, monthlyCap: 200_000, unit: 50_000 },
    { id: "nexon", name: "넥슨카드", note: "", discountPct: 6, monthlyCap: 200_000, unit: 50_000 },
    { id: "plain", name: "일반", note: "", discountPct: 0, monthlyCap: Infinity, unit: 1 },
  ];
  const p = chargePlan(270_000, methods);
  assert.equal(p.charged, 300_000); // 50,000-won notes cover the need
  assert.equal(p.takes.book + p.takes.nexon, 300_000);
  assert.equal(p.takes.plain, 0);
  assert.equal(p.pay, 300_000 * 0.94);
  const big = chargePlan(700_000, [...methods, { id: "culture", name: "컬쳐", note: "", discountPct: 6, monthlyCap: 200_000, unit: 50_000 }]);
  // Gift cards: 600,000 together at most.
  assert.equal(big.takes.book + big.takes.nexon + big.takes.culture, 600_000);
  assert.equal(big.takes.plain, 100_000);
});

test("sell-back rate", () => {
  // 플가 5,900 cash · 3억, fee 3 %, 2,900 won per 1억.
  const r = itemRate(5900, 3, 3, 2900);
  assert.ok(Math.abs(r - (3 * 0.97 * 2900 * 0.97) / 5900) < 1e-12);
  assert.equal(itemRate(0, 3, 3, 2900), 0);
});

const MARKET: Market = { wonPer100m: 1500, mpPer100m: 2100, auctionFeePct: 3, giftWonPer10k: 7000, creditPct: 5, useCredit: true, creditNow: 0 };
const SHOP: CreditItem[] = [
  { id: "primeAddi", name: "프라임 에디셔널 큐브", credit: 20_000, eok: 14.5 },
  { id: "prime", name: "프라임 큐브", credit: 10_000, eok: 7.4 },
  { id: "pga", name: "플가", credit: 5_900, eok: 3 },
  { id: "circ", name: "심연의 서큘레이터", credit: 4_900, eok: 2.6 },
];

test("auction sale: 2.7억 platinum scissors come back as about 3,811 won", () => {
  assert.ok(Math.abs(auctionWon(2.7, MARKET) - 2.7 * 0.97 * 1500 * 0.97) < 1e-9);
  assert.equal(Math.round(auctionWon(2.7, MARKET)), 3811);
});

test("credit shop: spend 75,000 credit on what sells best", () => {
  const p = creditPlan(75_000, SHOP, MARKET);
  // 7 prime cubes (1.044 won per credit) + 1 circulator beats prime additional cubes (1.023).
  assert.deepEqual(p.buys, { prime: 7, circ: 1 });
  assert.equal(p.used, 74_900);
});

test("routes: all meso market, all gift, and the best mix", () => {
  const items: SellItem[] = [{ id: "pga", name: "플가", cash: 5900, eok: 2.7 }];
  const mm = sellRoute(1_500_000, 1_500_000, "mm", items, SHOP, MARKET);
  assert.equal(mm.mm.eok, 714);
  assert.equal(mm.leftover, 600);
  assert.equal(mm.credit.earned, Math.floor(714 * 2100 * 0.05));
  const gift = sellRoute(1_500_000, 1_500_000, "gift", items, SHOP, MARKET);
  assert.equal(gift.gift.won, 1_050_000);
  assert.equal(gift.credit.earned, 0);
  const best = sellRoute(1_500_000, 1_500_000, "best", items, SHOP, MARKET);
  // All meso market cannot hit 1,500,000 exactly (2,100 per 1억): 600 short, so it is not a valid plan to beat.
  assert.equal(mm.short, 600);
  assert.equal(best.short, 0);
  assert.ok(best.won >= gift.won - 1);
  // Without credit the gift (0.7 won per cash) beats the meso market (0.693).
  const noCredit = sellRoute(1_500_000, 1_500_000, "best", items, SHOP, { ...MARKET, useCredit: false });
  assert.equal(noCredit.gift.cash, 1_500_000);
});

test("routes always spend what the grade needs and never more than the cash (Codex review cases)", () => {
  const items: SellItem[] = [
    { id: "pga", name: "플가", cash: 5900, eok: 3 },
    { id: "royal", name: "로얄 10개", cash: 22000, eok: 12 },
    { id: "berry", name: "원더베리", cash: 54000, eok: 28 },
    { id: "boutique", name: "부티크", cash: 33000, eok: 17 },
  ];
  // Bronze: 150,000 must really be spent.
  const bronze = sellRoute(150_000, 150_000, "best", items, SHOP, MARKET);
  assert.equal(bronze.short, 0);
  assert.ok(bronze.cash - bronze.leftover >= 150_000);
  // Odd meso-market price: no overspending.
  const odd = sellRoute(900_000, 900_000, "mm", items, SHOP, { ...MARKET, mpPer100m: 1801 });
  assert.ok(odd.leftover >= 0);
  assert.equal(odd.mm.cash, odd.mm.eok * 1801);
  // Credit counted by its real exchange: 400,000 gets back at least the plan Codex found (326,001.48).
  const four = sellRoute(400_000, 400_000, "best", items, SHOP, MARKET);
  assert.ok(four.won >= 326_001.48 - 0.01, String(four.won));
  assert.equal(four.short, 0);
  // 310만 at an odd meso-market price (step 1): a plan that spends exactly 3,100,000 exists and must be chosen.
  const big = sellRoute(3_100_000, 3_100_000, "best", items, SHOP, { ...MARKET, mpPer100m: 1801 });
  assert.equal(big.short, 0);
  assert.ok(big.leftover >= 0);
  // 610만 with no gifting: needs the meso-market filler path; 플가 180 + 로얄 229 spends it exactly.
  const huge = sellRoute(6_100_000, 6_100_000, "best", items, SHOP, { ...MARKET, mpPer100m: 1801, giftWonPer10k: 0 });
  assert.equal(huge.short, 0);
  assert.ok(huge.leftover >= 0);
  assert.equal(huge.approx, true);
  // Same with gifting (Codex): 메소마켓 3,300억 + 로얄 3 + 부티크 1 + 플가 3 + 선물 4만 gets back 5,230,323.40.
  const mixed = sellRoute(6_100_000, 6_100_000, "best", items, SHOP, { ...MARKET, mpPer100m: 1801 });
  assert.equal(mixed.short, 0);
  assert.ok(mixed.won >= 5_230_323.4 - 0.01, String(mixed.won));
  // Below the limit the search is exact.
  assert.equal(sellRoute(3_100_000, 3_100_000, "best", items, SHOP, { ...MARKET, mpPer100m: 1801 }).approx, false);
});
