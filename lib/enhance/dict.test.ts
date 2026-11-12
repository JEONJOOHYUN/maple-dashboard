import assert from "node:assert/strict";
import { test } from "node:test";
import { ICON_BASE, MAX_NAMES, MAX_REPORT, cleanNames, cleanReport, fillOf, iconCode, iconUrl, reportOf } from "./dict.ts";
import { itemIcon, resolveItem } from "./items.ts";

const icon = (code: string) => ICON_BASE + code;
const NO_OVERRIDES = { levels: {}, spares: {} };

test("icon: only a NEXON item icon address gives a code", () => {
  assert.equal(iconCode(icon("KEPCPPOI")), "KEPCPPOI");
  assert.equal(iconUrl("KEPCPPOI"), icon("KEPCPPOI"));
  assert.equal(iconUrl(""), "");
  for (const bad of ["https://evil.example/static/maplestory/item/icon/KEPCPPOI", icon("../../x"), icon("KEP?x=1"), icon(""), icon("A".repeat(41)), "", null, 3])
    assert.equal(iconCode(bad), "", String(bad));
});

test("report: what is not exactly an item fact is dropped", () => {
  const ok = { name: "에테르넬 메이지슈즈", level: 250, icon: "KEPFIGLI", part: "신발" };
  assert.deepEqual(cleanReport([ok]), [ok]);
  // The name is trimmed, a missing part is empty, a bad icon is left out but the item stays.
  assert.deepEqual(cleanReport([{ name: "  데스티니 데스페라도 ", level: 250, icon: "https://x/y" }]), [{ name: "데스티니 데스페라도", level: 250, icon: "", part: "" }]);
  const bad = [
    { ...ok, name: "" },
    { ...ok, name: "가".repeat(61) },
    { ...ok, name: "줄\n바꿈" },
    { ...ok, name: 7 },
    { ...ok, level: 0 },
    { ...ok, level: 301 },
    { ...ok, level: 199.5 },
    { ...ok, level: "250" },
    { ...ok, part: "가".repeat(21) },
    { ...ok, part: 3 },
    null,
    "에테르넬 메이지슈즈",
  ];
  assert.deepEqual(cleanReport(bad), []);
  // One per name (the first), and nothing at all from a report that is too long or not a list.
  assert.deepEqual(cleanReport([ok, { ...ok, level: 200 }]), [ok]);
  assert.deepEqual(cleanReport(Array.from({ length: MAX_REPORT + 1 }, (_, i) => ({ ...ok, name: `아이템 ${i}` }))), []);
  assert.deepEqual(cleanReport({ 0: ok }), []);
});

test("lookup names: strings only, no repeats, not too many", () => {
  assert.deepEqual(cleanNames(["가", " 가 ", "나", 3, null, "", "다\u0000"]), ["가", "나"]);
  assert.deepEqual(cleanNames(Array.from({ length: MAX_NAMES + 1 }, (_, i) => `아이템 ${i}`)), []);
  assert.deepEqual(cleanNames("가"), []);
});

test("saved items keep their level; only an empty icon or part is filled", () => {
  const saved = { level: 250, icon: "", part: "" };
  assert.deepEqual(fillOf(saved, { level: 200, icon: "KEPFIGLI", part: "신발" }), { icon: "KEPFIGLI", part: "신발" });
  assert.deepEqual(fillOf({ level: 250, icon: "AAAA", part: "" }, { level: 250, icon: "BBBB", part: "신발" }), { part: "신발" });
  assert.equal(fillOf({ level: 250, icon: "AAAA", part: "신발" }, { level: 200, icon: "BBBB", part: "무기" }), null);
  assert.equal(fillOf(saved, { level: 250, icon: "", part: "" }), null);
});

test("what a browser tells the dictionary: only what it lacks", () => {
  const found = {
    "아케인셰이드 메이지햇": { level: 200, icon: icon("KEPCPPOI"), part: "모자" },
    "아스트라 엄브럴 실드": { level: 200, icon: icon("KEMHIFOC"), part: "보조무기" },
    "가디언 엔젤 링": { level: 160, icon: icon("KEODIEPC"), part: "반지" },
    // Not NEXON's host: the icon is not sent.
    "이상한 그림": { level: 100, icon: "https://evil.example/a.png", part: "모자" },
  };
  const rolled = [
    { item: "아스트라 엄브럴 실드", level: 200, part: "방패" },
    { item: "데스티니 데스페라도", level: 250, part: "무기" },
    { item: "레벨 없는 것", level: 0, part: "무기" },
  ];
  const dict = {
    // Complete: nothing to add.
    "아케인셰이드 메이지햇": { level: 200, icon: "KEPCPPOI", part: "모자" },
    // Has a level but no picture: the picture is worth sending.
    "가디언 엔젤 링": { level: 160, icon: "", part: "반지" },
  };
  assert.deepEqual(reportOf(found, rolled, dict), [
    // The history names the part more exactly than the equipment does.
    { name: "아스트라 엄브럴 실드", level: 200, icon: "KEMHIFOC", part: "방패" },
    { name: "가디언 엔젤 링", level: 160, icon: "KEODIEPC", part: "반지" },
    { name: "이상한 그림", level: 100, icon: "", part: "모자" },
    { name: "데스티니 데스페라도", level: 250, icon: "", part: "무기" },
  ]);
  assert.deepEqual(reportOf({}, [], dict), []);
});

test("the dictionary comes after everything the account itself knows", () => {
  const dict = {
    "미트라의 분노 : 도적": { level: 200, icon: "KEOLKHOA", part: "엠블렘" },
    // A wrong level someone sent for an item the calculator's list knows (Lv.250) and the account wears.
    "에테르넬 메이지슈즈": { level: 100, icon: "WRONG", part: "신발" },
    "데스티니 데스페라도": { level: 100, icon: "KENEJHLA", part: "무기" },
  };
  // Unknown to the account and the list: level, picture and part come from the dictionary.
  const a = resolveItem("미트라의 분노 : 도적", {}, NO_OVERRIDES, dict);
  assert.deepEqual([a.level, a.icon, a.part, a.source], [200, icon("KEOLKHOA"), "엠블렘", "dict"]);
  // The account's own equipment wins on every field.
  const worn = { "에테르넬 메이지슈즈": { level: 250, icon: icon("KEPFIGLI"), part: "신발" } };
  const b = resolveItem("에테르넬 메이지슈즈", worn, NO_OVERRIDES, dict);
  assert.deepEqual([b.level, b.icon, b.source], [250, icon("KEPFIGLI"), "api"]);
  // The list knows the level of a 데스티니 weapon but has no picture for the group: the level stays the list's.
  const c = resolveItem("데스티니 데스페라도", {}, NO_OVERRIDES, dict);
  assert.deepEqual([c.level, c.icon, c.source], [250, icon("KENEJHLA"), "table"]);
  // The user's own number beats all of it; without a dictionary nothing changes.
  assert.equal(resolveItem("미트라의 분노 : 도적", {}, { levels: { "미트라의 분노 : 도적": 140 }, spares: {} }, dict).level, 140);
  assert.deepEqual([resolveItem("미트라의 분노 : 도적", {}, NO_OVERRIDES).level, resolveItem("미트라의 분노 : 도적", {}, NO_OVERRIDES).source], [0, "none"]);
  // A name that is also an object key is not a dictionary entry.
  assert.equal(resolveItem("constructor", {}, NO_OVERRIDES, dict).source, "none");

  assert.equal(itemIcon("미트라의 분노 : 도적", {}, dict), icon("KEOLKHOA"));
  assert.equal(itemIcon("에테르넬 메이지슈즈", worn, dict), icon("KEPFIGLI"));
  assert.equal(itemIcon("없는 아이템", {}, dict), undefined);
});
