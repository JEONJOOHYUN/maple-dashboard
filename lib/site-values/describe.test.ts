import assert from "node:assert/strict";
import { test } from "node:test";
import { knownItem, resolveItem } from "../enhance/items.ts";
import { cellOf, cleanValues, shownAs, storedOf, typedOf, unitFor, unitName } from "./cells.ts";
import { changeName, changeText, describeChange } from "./describe.ts";
import { canPrice, cleanDictState, dictKey, dictName, editedState, sameDict, type DictState } from "./dict-edit.ts";
import { extraKey, starItems } from "./values.ts";

test("a change reads as the admin page writes it", () => {
  assert.equal(describeChange("market|mesoWon", 1400, 1350), "1억 메소 1,400 → 1,350원");
  assert.equal(describeChange("crystal|림보|익스트림", 7_500_000_000, 7_800_000_000), "림보 익스트림 75억 → 78억");
  assert.equal(describeChange("crystal|자쿰|이지", 114_000, 120_000), "자쿰 이지 11만 4,000 → 12만");
  assert.equal(describeChange("spare|sin", 3500, 3800), "오만의 원죄 3,500 → 3,800억");
  assert.equal(describeChange("spare|estella", 0.0075, 0.01), "에스텔라 이어링 0.0075 → 0.01억");
  assert.equal(describeChange("reward|rr4", 330_000, 400_000), "리스트레인트 링 4레벨 33억 → 40억");
  assert.equal(describeChange("set|absolab", 0, 0.5), "앱솔랩스 장비 0 → 0.5억");
  // Two cells of one item say which price they are.
  assert.equal(changeName("mvp|pga|cash"), "플래티넘 카르마의 가위 캐시 가격");
  assert.equal(describeChange("mvp|pga|auction", 3, 3.2), "플래티넘 카르마의 가위 경매장 3 → 3.2억");
  assert.equal(describeChange("credit|prime|credit", 10_000, 9000), "프라임 큐브 크레딧 10,000 → 9,000크레딧");
  assert.equal(describeChange("mvp|boutiqueOpen|ticket", 5300, 5000), "부티크 기프트 10개 · 까서 · 부티크 티켓 5,300 → 5,000만");
  // A key the code no longer has says nothing.
  assert.equal(changeName("spare|gone"), null);
  assert.equal(changeText("spare|gone", 1, 2), "");
  assert.equal(describeChange("spare|gone", 1, 2), "");
  assert.equal(changeText("spare|sin", "x", 2), "");
});

test("a crystal is typed in 억 from 1억 up, in 만 under it", () => {
  const big = cellOf("crystal|림보|익스트림")!;
  assert.deepEqual(shownAs(big, 7_500_000_000), { unit: "억", scale: 100_000_000 });
  assert.equal(typedOf(big, 7_500_000_000, 100_000_000), 75);
  assert.equal(storedOf(big, 78, 100_000_000), 7_800_000_000);
  assert.equal(storedOf(big, 1.67, 100_000_000), 167_000_000);
  const small = cellOf("crystal|스우|하드")!;
  assert.deepEqual(shownAs(small, 48_900_000), { unit: "만", scale: 10_000 });
  assert.equal(typedOf(small, 48_900_000, shownAs(small, 48_900_000).scale), 4890);
  // The unit follows the value the cell has, so 9,950만 typed up to 1억 2,000만 is still read as 만.
  assert.equal(storedOf(small, 12_000, shownAs(small, 99_500_000).scale), 120_000_000);
  assert.deepEqual(shownAs(small, 100_000_000), { unit: "억", scale: 100_000_000 });
  // Every other cell keeps its own unit, whatever the value.
  assert.deepEqual(shownAs(cellOf("spare|sin")!, 3500), { unit: "억", scale: 1 });
  assert.deepEqual(shownAs(cellOf("reward|legacy")!, 6_700_000), { unit: "억", scale: 10_000 });
});

test("the unit choice above the crystal table, and text that keeps the unit it was typed in", () => {
  const cell = cellOf("crystal|스우|하드")!;
  assert.deepEqual(unitFor(cell, 48_900_000, "auto"), { unit: "만", scale: 10_000 });
  assert.deepEqual(unitFor(cell, 48_900_000, "억"), { unit: "억", scale: 100_000_000 });
  assert.deepEqual(unitFor(cell, 48_900_000, "만"), { unit: "만", scale: 10_000 });
  // 원본 = meso as it is: 9억 is typed 900,000,000.
  assert.deepEqual(unitFor(cell, 48_900_000, "메소"), { unit: "메소", scale: 1 });
  assert.equal(storedOf(cell, 900_000_000, unitFor(cell, 48_900_000, "메소").scale), 900_000_000);
  assert.equal(typedOf(cell, 48_900_000, 1), 48_900_000);
  assert.equal(typedOf(cell, 48_900_000, 100_000_000), 0.489);
  // A value of 1.5억 is typed in 억. "0.6" typed there stays 6천만 after the value itself has dropped under 1억
  // (applied in between): read by the value's new unit it would have been 6천 메소.
  const big = cellOf("crystal|진 힐라|하드")!;
  const typedIn = unitFor(big, 150_000_000, "auto").scale;
  assert.equal(typedIn, 100_000_000);
  assert.deepEqual(unitFor(big, 50_000_000, "auto"), { unit: "만", scale: 10_000 });
  assert.deepEqual(unitFor(big, 50_000_000, "auto", typedIn), { unit: "억", scale: 100_000_000 });
  assert.equal(storedOf(big, 0.6, unitFor(big, 50_000_000, "auto", typedIn).scale), 60_000_000);
  // The choice does not move typed text either; only the page converts it, on purpose, when the choice changes.
  assert.deepEqual(unitFor(big, 50_000_000, "만", typedIn), { unit: "억", scale: 100_000_000 });
  assert.equal(unitName(1), "메소");
  assert.equal(unitName(10_000), "만");
  // Cells that are not crystals have one unit whatever is chosen.
  assert.deepEqual(unitFor(cellOf("spare|sin")!, 3500, "메소", 1), { unit: "억", scale: 1 });
});

const ROW: DictState = { level: 250, part: "장갑", icon: "KEPKJAIA", spareEok: null, blocked: false };

test("a dictionary row: what the admin types becomes the row to store", () => {
  const name = "에테르넬 나이트글러브";
  assert.deepEqual(editedState(ROW, {}, name), { state: ROW });
  assert.deepEqual(editedState(ROW, { level: "200", part: " 신발 ", spare: "12.5" }, name), { state: { ...ROW, level: 200, part: "신발", spareEok: 12.5 } });
  // An emptied level keeps the level; an emptied price takes the price away.
  assert.deepEqual(editedState({ ...ROW, spareEok: 12 }, { level: "", spare: "" }, name), { state: ROW });
  assert.deepEqual(editedState(ROW, { blocked: true, icon: "" }, name), { state: { ...ROW, blocked: true, icon: "" } });
  assert.deepEqual(editedState(ROW, { level: "0" }, name), { bad: ["level"] });
  assert.deepEqual(editedState(ROW, { level: "2.5", spare: "-1" }, name), { bad: ["level", "spare"] });
  assert.deepEqual(editedState(ROW, { spare: "1,234.56789" }, name), { state: { ...ROW, spareEok: 1234.5679 } });
  // A name the dictionary does not have yet needs a level.
  assert.deepEqual(editedState(null, { part: "반지" }, "새 반지"), { bad: ["level"] });
  assert.deepEqual(editedState(null, { level: "200", part: "반지", spare: "20" }, "새 반지"), { state: { level: 200, part: "반지", icon: "", spareEok: 20, blocked: false } });
  // An item the code lists has its price there, not here.
  assert.equal(canPrice("오만의 원죄"), false);
  assert.deepEqual(editedState(ROW, { spare: "3800" }, "오만의 원죄"), { bad: ["spare"] });
  assert.deepEqual(editedState(ROW, { level: "250" }, "오만의 원죄"), { state: ROW });
});

test("a dictionary row: what the server is sent is checked field by field", () => {
  const name = "에테르넬 나이트글러브";
  assert.deepEqual(cleanDictState({ ...ROW, more: 1 }, name), ROW);
  assert.deepEqual(cleanDictState({ ...ROW, spareEok: 12.5 }, name), { ...ROW, spareEok: 12.5 });
  for (const bad of [{ level: 0 }, { level: 2.5 }, { level: "250" }, { part: " 장갑" }, { part: "가".repeat(21) }, { icon: "a/b" }, { blocked: "no" }, { spareEok: -1 }, { spareEok: 1.23456 }, { spareEok: "1" }])
    assert.equal(cleanDictState({ ...ROW, ...bad }, name), null, JSON.stringify(bad));
  assert.equal(cleanDictState({ ...ROW, spareEok: 1 }, "오만의 원죄"), null);
  assert.equal(cleanDictState(null, name), null);
  assert.equal(dictName(dictKey(name)), name);
  assert.equal(dictName("spare|sin"), null);
  assert.equal(dictName(dictKey(" 앞에 빈칸")), null);
  assert.equal(dictName(dictKey("가".repeat(61))), null);
  assert.ok(sameDict(ROW, { ...ROW }));
  assert.ok(!sameDict(ROW, { ...ROW, spareEok: 0 }));
  assert.ok(!sameDict(ROW, null));
  assert.ok(sameDict(null, null));
});

test("a changed dictionary row reads as words", () => {
  const key = dictKey("에테르넬 나이트글러브");
  assert.equal(changeName(key), "에테르넬 나이트글러브");
  assert.equal(changeText(key, ROW, { ...ROW, level: 200 }), "레벨 250 → 200");
  assert.equal(changeText(key, ROW, { ...ROW, part: "신발", spareEok: 12 }), "부위 장갑 → 신발 · 노작값 없음 → 12억");
  assert.equal(changeText(key, { ...ROW, spareEok: 12 }, ROW), "노작값 12억 → 없음");
  assert.equal(changeText(key, ROW, { ...ROW, blocked: true, icon: "" }), "막음 · 그림 지움");
  assert.equal(changeText(key, { ...ROW, blocked: true }, ROW), "막기 풂");
  assert.equal(describeChange(dictKey("새 반지"), null, { level: 200, part: "반지", icon: "", spareEok: 20, blocked: false }), "새 반지 새로 넣음 · Lv.200 · 반지 · 노작값 20억");
  assert.equal(changeText(key, ROW, null), "");
});

test("the history's items are read from the list in force", () => {
  // A priced dictionary item reaches the screens as one more item of the star force list.
  const values = cleanValues([
    { key: "spare|sin", value: 3800 },
    { key: "set|absolab", value: 0.5 },
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
  // Sets that are not on the list: nothing unless the admin page gives the set a price.
  assert.deepEqual(knownItem("앱솔랩스 메이지슈즈"), { level: 160, spare: 0 });
  assert.deepEqual(knownItem("앱솔랩스 메이지슈즈", list, values), { level: 160, spare: 0.5e8 });
  assert.deepEqual(knownItem("파프니르 윙부츠", list, values), { level: 150, spare: 0 });
  assert.equal(resolveItem("앱솔랩스 메이지슈즈", {}, { levels: {}, spares: {} }, {}, list, values).spare, 0.5e8);
  assert.equal(resolveItem("앱솔랩스 메이지슈즈", {}, { levels: {}, spares: { "앱솔랩스 메이지슈즈": 2 } }, {}, list, values).spare, 2e8);
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
