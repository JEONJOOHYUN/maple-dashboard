import assert from "node:assert/strict";
import { test } from "node:test";
import { CREDIT_SHOP, GIFT_WON_PER_10K, MESO_MARKET_MP, MESO_RATE_WON, MVP_ITEMS, STAR_ITEMS } from "../ev/defaults.ts";
import { CRYSTAL, ITEMS, SPARE_LINK } from "../revenue/data.ts";
import { CELLS, OWN_REWARDS, cellOf, cleanValue, cleanValues, sameValue, storedOf, typedOf } from "./cells.ts";
import { crystalTable, rewardPrices } from "./revenue.ts";
import { NO_VALUES, creditShop, extraKey, extraName, extras, market, mvpItems, starItems } from "./values.ts";

test("nothing stored: every screen reads the code's own tables", () => {
  for (const values of [undefined, NO_VALUES, {}]) {
    assert.equal(starItems(values), STAR_ITEMS);
    assert.equal(crystalTable(values), CRYSTAL);
    assert.equal(mvpItems(values), MVP_ITEMS);
    assert.equal(creditShop(values), CREDIT_SHOP);
    assert.deepEqual(market(values), { mesoWon: MESO_RATE_WON, mesoMp: MESO_MARKET_MP, giftWon: GIFT_WON_PER_10K });
    const rewards = rewardPrices(values);
    for (const id of Object.keys(ITEMS) as (keyof typeof ITEMS)[]) assert.equal(rewards[id], ITEMS[id].price, id);
  }
});

test("the cells are the code's values, one key each", () => {
  assert.equal(new Set(CELLS.map((c) => c.key)).size, CELLS.length);
  assert.equal(CELLS.filter((c) => c.group === "crystal").length, Object.keys(CRYSTAL).length);
  assert.equal(CELLS.filter((c) => c.group === "spare").length, STAR_ITEMS.reduce((n, g) => n + g.items.length, 0));
  assert.equal(OWN_REWARDS.length + Object.keys(SPARE_LINK).length, Object.keys(ITEMS).length);
  assert.equal(CELLS.filter((c) => c.group === "reward").length, OWN_REWARDS.length);
  // Every default passes its own check and survives typed → stored → typed.
  for (const c of CELLS) {
    assert.equal(cleanValue(c.key, c.def), c.def, c.key);
    assert.equal(storedOf(c, typedOf(c, c.def)), c.def, c.key);
  }
  // 플래티넘 카르마의 가위 has one auction price: the cash item's.
  assert.equal(cellOf("credit|pga|auction"), undefined);
  assert.ok(cellOf("mvp|pga|auction"));
});

test("typed and stored units", () => {
  const crystal = cellOf("crystal|자쿰|이지")!;
  assert.equal(typedOf(crystal, 114_000), 11.4);
  assert.equal(storedOf(crystal, 11.4), 114_000);
  assert.equal(storedOf(crystal, 780_000), 7_800_000_000);
  const reward = cellOf("reward|rr4")!;
  assert.equal(typedOf(reward, 330_000), 33);
  assert.equal(storedOf(reward, 33.5), 335_000);
  const spare = cellOf("spare|estella")!;
  assert.equal(typedOf(spare, 0.0075), 0.0075);
  assert.equal(storedOf(spare, 0.1 + 0.2), 0.3);
  assert.equal(storedOf(spare, -1), null);
  assert.equal(storedOf(spare, Number.NaN), null);
  assert.equal(storedOf(spare, 1e9), null);
  assert.equal(storedOf(cellOf("market|mesoWon")!, 1350.4), 1350);
});

test("values that do not belong are dropped", () => {
  assert.equal(cleanValue("spare|sin", 3800), 3800);
  assert.equal(cleanValue("spare|sin", "3800"), null);
  assert.equal(cleanValue("spare|sin", -1), null);
  assert.equal(cleanValue("spare|nothing", 1), null);
  assert.equal(cleanValue("market|mesoWon", 1350.5), null);
  assert.equal(cleanValue("crystal|림보|익스트림", 7_800_000_000), 7_800_000_000);
  assert.equal(cleanValue("crystal|림보|이지", 1), null);
  assert.equal(cleanValue("__proto__", 1), null);
  assert.deepEqual(cleanValue(extraKey("에테르넬 나이트헬름"), { level: 250, icon: "KEPCOOGA", spareEok: 0.1, more: 1 }), { level: 250, icon: "KEPCOOGA", spareEok: 0.1 });
  assert.equal(cleanValue(extraKey("에테르넬 나이트헬름"), { level: 0, icon: "", spareEok: 1 }), null);
  assert.equal(cleanValue(extraKey("에테르넬 나이트헬름"), { level: 250, icon: "a/b", spareEok: 1 }), null);
  // An item the code already lists is not added a second time.
  assert.equal(extraName(extraKey("오만의 원죄")), null);
  assert.equal(extraName(extraKey(" 앞에 빈칸")), null);
  assert.deepEqual(cleanValues([{ key: "spare|sin", value: 3800 }, { key: "spare|sin2", value: 1 }, { key: 3, value: 1 }, { key: "market|mesoMp", value: null }]), { "spare|sin": 3800 });
});

test("a changed spare price moves the item, the reward and nothing else", () => {
  const values = { "spare|sin": 3800, "spare|eterArmor": 20 };
  const items = starItems(values);
  assert.notEqual(items, STAR_ITEMS);
  assert.equal(starItems(values), items, "worked out once per values object");
  const lv250 = items.find((g) => g.level === 250)!.items;
  assert.equal(lv250.find((it) => it.id === "sin")!.spareEok, 3800);
  assert.deepEqual(lv250.map((it) => it.spareEok), [...lv250.map((it) => it.spareEok)].sort((a, b) => a - b));
  // The code's own list is not touched.
  assert.equal(STAR_ITEMS.find((g) => g.level === 250)!.items.find((it) => it.id === "sin")!.spareEok, 3500);
  const rewards = rewardPrices(values);
  assert.equal(rewards.sin, 38_000_000);
  assert.equal(rewards.eterWill, 200_000);
  assert.equal(rewards.eterDesire, ITEMS.eterDesire.price);
  assert.equal(rewards.rr4, ITEMS.rr4.price);
  assert.equal(crystalTable(values), CRYSTAL);
});

test("own reward prices, crystals, the market and the shops", () => {
  const values = { "reward|rr4": 400_000, "crystal|림보|익스트림": 7_800_000_000, "market|mesoWon": 1350, "mvp|pga|auction": 3.2, "mvp|boutiqueOpen|ticket": 5000, "credit|prime|auction": 8, "credit|prime|credit": 9000 };
  assert.equal(rewardPrices(values).rr4, 400_000);
  assert.equal(rewardPrices(values).ct4, ITEMS.ct4.price);
  assert.equal(crystalTable(values)["림보|익스트림"], 7_800_000_000);
  assert.equal(crystalTable(values)["림보|하드"], CRYSTAL["림보|하드"]);
  assert.equal(Object.keys(crystalTable(values)).length, Object.keys(CRYSTAL).length);
  assert.deepEqual(market(values), { mesoWon: 1350, mesoMp: MESO_MARKET_MP, giftWon: GIFT_WON_PER_10K });
  const cash = mvpItems(values);
  assert.equal(cash.find((it) => it.id === "pga")!.auctionEok, 3.2);
  assert.equal(cash.find((it) => it.id === "boutiqueOpen")!.ticketMan, 5000);
  assert.equal(cash.find((it) => it.id === "royal")!.cash, 22_000);
  const shop = creditShop(values);
  assert.deepEqual(shop.find((it) => it.id === "prime"), { id: "prime", name: "프라임 큐브", credit: 9000, auctionEok: 8 });
  assert.equal(shop.find((it) => it.id === "pga")!.auctionEok, 3.2, "the cash item's auction price");
  assert.equal(shop.find((it) => it.id === "circulator")!.auctionEok, 2.6);
  assert.equal(starItems(values), STAR_ITEMS);
});

test("an item added from the dictionary joins its level", () => {
  const values = cleanValues([
    { key: extraKey("새 반지"), value: { level: 200, icon: "ABCD", spareEok: 20 } },
    { key: extraKey("새 레벨 장비"), value: { level: 275, icon: "", spareEok: 1 } },
  ]);
  assert.deepEqual(extras(values), { "새 반지": { level: 200, icon: "ABCD", spareEok: 20 }, "새 레벨 장비": { level: 275, icon: "", spareEok: 1 } });
  const items = starItems(values);
  assert.deepEqual(items.map((g) => g.level), [...STAR_ITEMS.map((g) => g.level), 275]);
  const ring = items.find((g) => g.level === 200)!.items.find((it) => it.name === "새 반지")!;
  assert.deepEqual(ring, { id: "x:새 반지", name: "새 반지", icons: ["ABCD"], spareEok: 20 });
  assert.deepEqual(items.find((g) => g.level === 275)!.items[0].icons, []);
  assert.equal(STAR_ITEMS.find((g) => g.level === 200)!.items.some((it) => it.name === "새 반지"), false);
});

test("sameValue", () => {
  assert.ok(sameValue(3, 3));
  assert.ok(!sameValue(3, 4));
  assert.ok(!sameValue(3, null));
  assert.ok(sameValue(null, null));
  assert.ok(sameValue({ level: 1, icon: "a", spareEok: 2 }, { level: 1, icon: "a", spareEok: 2 }));
  assert.ok(!sameValue({ level: 1, icon: "a", spareEok: 2 }, { level: 1, icon: "a", spareEok: 3 }));
});
