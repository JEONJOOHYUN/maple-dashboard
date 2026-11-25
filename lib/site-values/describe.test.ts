import assert from "node:assert/strict";
import { test } from "node:test";
import { knownItem, resolveItem } from "../enhance/items.ts";
import { changeName, changeText, describeChange } from "./describe.ts";
import { cleanValues } from "./cells.ts";
import { extraKey, starItems } from "./values.ts";

test("a change reads as the admin page writes it", () => {
  assert.equal(describeChange("market|mesoWon", 1400, 1350), "1억 메소 1,400 → 1,350원");
  assert.equal(describeChange("crystal|림보|익스트림", 7_500_000_000, 7_800_000_000), "림보 익스트림 75억 → 78억");
  assert.equal(describeChange("crystal|자쿰|이지", 114_000, 120_000), "자쿰 이지 11만 4,000 → 12만");
  assert.equal(describeChange("spare|sin", 3500, 3800), "오만의 원죄 3,500 → 3,800억");
  assert.equal(describeChange("spare|estella", 0.0075, 0.01), "에스텔라 이어링 0.0075 → 0.01억");
  assert.equal(describeChange("reward|rr4", 330_000, 400_000), "리스트레인트 링 4레벨 33억 → 40억");
  // Two cells of one item say which price they are.
  assert.equal(changeName("mvp|pga|cash"), "플래티넘 카르마의 가위 캐시 가격");
  assert.equal(describeChange("mvp|pga|auction", 3, 3.2), "플래티넘 카르마의 가위 경매장 3 → 3.2억");
  assert.equal(describeChange("credit|prime|credit", 10_000, 9000), "프라임 큐브 크레딧 10,000 → 9,000크레딧");
  assert.equal(describeChange("mvp|boutiqueOpen|ticket", 5300, 5000), "부티크 기프트 10개 · 까서 · 부티크 티켓 5,300 → 5,000만");
});

test("added items, and keys the code no longer has", () => {
  const key = extraKey("새 반지");
  const item = { level: 200, icon: "ABCD", spareEok: 20 };
  assert.equal(describeChange(key, null, item), "새 반지 새로 넣음 · 20억");
  assert.equal(describeChange(key, item, { ...item, spareEok: 25 }), "새 반지 20 → 25억");
  assert.equal(describeChange(key, item, null), "새 반지 뺌");
  assert.equal(changeName("spare|gone"), null);
  assert.equal(changeText("spare|gone", 1, 2), "");
  assert.equal(describeChange("spare|gone", 1, 2), "");
  assert.equal(changeText("spare|sin", "x", 2), "");
});

test("the history's items are read from the list in force", () => {
  const values = cleanValues([
    { key: "spare|sin", value: 3800 },
    { key: extraKey("새 반지"), value: { level: 200, icon: "ABCD", spareEok: 20 } },
  ]);
  const list = starItems(values);
  assert.equal(knownItem("오만의 원죄")!.spare, 3500e8);
  assert.equal(knownItem("오만의 원죄", list)!.spare, 3800e8);
  assert.equal(knownItem("새 반지"), null);
  assert.deepEqual(knownItem("새 반지", list), { level: 200, spare: 20e8, maxStar: undefined, icon: "https://open.api.nexon.com/static/maplestory/item/icon/ABCD" });
  // What the user typed still wins, and the level of a set piece comes from its group.
  assert.equal(resolveItem("오만의 원죄", {}, { levels: {}, spares: { "오만의 원죄": 1 } }, {}, list).spare, 1e8);
  assert.equal(resolveItem("오만의 원죄", {}, { levels: {}, spares: {} }, {}, list).spare, 3800e8);
  assert.equal(knownItem("에테르넬 메이지팬츠", list)!.level, 250);
});

test("an added piece of a set keeps the set's star limit", () => {
  const list = starItems(cleanValues([{ key: extraKey("데스티니 스태프"), value: { level: 250, icon: "", spareEok: 120 } }]));
  const added = list.find((g) => g.level === 250)!.items.find((it) => it.name === "데스티니 스태프")!;
  assert.equal(added.maxStar, 25);
  // The history reads it from the added row now (its own price), still capped like every 데스티니 weapon.
  assert.equal(knownItem("데스티니 스태프")!.maxStar, 25);
  assert.deepEqual(knownItem("데스티니 스태프", list), { level: 250, spare: 120e8, maxStar: 25, icon: undefined });
  // An item of no set has no limit of its own.
  const plain = starItems(cleanValues([{ key: extraKey("새 반지"), value: { level: 200, icon: "", spareEok: 1 } }]));
  assert.equal("maxStar" in plain.find((g) => g.level === 200)!.items.find((it) => it.name === "새 반지")!, false);
});
