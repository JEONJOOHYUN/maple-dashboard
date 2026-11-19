import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_DATA, checkSkills, type SkillRaw } from "./check.ts";
import { SKILL_KEY, cellOf, columnCounts, guildColumns, sortRows, type Cell, type MemberRow } from "./guild-table.ts";

const COMMON = SPEC_DATA.common.skills0.map((s) => s.name);
const EVENT = "아르고 호의 가호";

/** A level 280 character of `cls` with these 0th-job skills; hyper passives all taken except `hpOff`. */
function member(cls: string, skills: [string, number][], hpOff: string[] = []): SkillRaw {
  return {
    basic: { character_name: "테스트", world_name: "스카니아", character_class: cls, character_level: 280 },
    skill0: { character_skill: skills.map(([skill_name, skill_level]) => ({ skill_name, skill_level })) },
    hyperPassive: { character_skill: SPEC_DATA.classes[cls].hyperPassive.map((n) => ({ skill_name: n, skill_level: hpOff.includes(n) ? 0 : 1 })) },
  };
}
/** Everything a class can have, at max: common skills, its attack buff, its own 0th-job skills. */
function full(cls: string): [string, number][] {
  const rule = SPEC_DATA.classes[cls];
  return [...SPEC_DATA.common.skills0.map((s): [string, number] => [s.name, s.max]), ...rule.atkBuff.slice(0, 1).map((n): [string, number] => [n, 1]), ...rule.skills0.map((s): [string, number] => [s.name, s.max])];
}
const cellsOf = (raw: SkillRaw, ev: string[] = []) => checkSkills(raw, SPEC_DATA, ev).map(cellOf);
const short = (c: Cell | null) => (c ? `${c.key}|${c.text}|${c.tier}` : "none");

test("guild table: a skill line → its column and short text (user, 2026-11-20 시안 C)", () => {
  // Night Lord: 연합 · 영웅의 메아리 not learned, 여제 24, 정령 14, one hyper passive off, the event skill not taken
  const nl = SPEC_DATA.classes["나이트로드"];
  const skills = full("나이트로드")
    .filter(([n]) => n !== "연합의 의지" && n !== nl.atkBuff[0])
    .map(([n, lv]): [string, number] => [n, n === "여제의 축복" ? 24 : n === "정령의 축복" ? 14 : lv]);
  assert.deepEqual(cellsOf(member("나이트로드", skills, [nl.hyperPassive[0]]), [EVENT]).map(short), [
    "하이퍼 패시브|1개|now",
    "여제의 축복|24 / 30|quest",
    "연합의 의지|안 배움|quest",
    "보약|안 배움|quest",
    `공격 버프|${nl.atkBuff[0]}|quest`,
    "정령의 축복|14 / 20|long",
  ]);
  // Evan without 계승된 의지: the column of the class's own skills names the skill
  const evan = full("에반").filter(([n]) => n !== "계승된 의지");
  assert.deepEqual(cellsOf(member("에반", evan)).map(short), ["직업 0차|계승된 의지|quest"]);
  // a 0th-job skill half raised keeps its level: "괴이봉인 4 / 10"; 여제 under 24 = raising other characters
  const hy = full("호영").map(([n, lv]): [string, number] => [n, n === "괴이봉인" ? 4 : n === "여제의 축복" ? 18 : lv]);
  const max = SPEC_DATA.classes["호영"].skills0.find((s) => s.name === "괴이봉인")!.max;
  assert.deepEqual(cellsOf(member("호영", hy)).map(short), [`직업 0차|괴이봉인 4 / ${max}|quest`, "여제의 축복|18 / 30|long"]);
  // the whole line stays for a hover
  assert.equal(cellsOf(member("에반", evan))[0]!.note, `계승된 의지 안 배움 · ${SPEC_DATA.classes["에반"].skills0.find((s) => s.name === "계승된 의지")!.effect}`);
  // a hyper passive line is as many things as it names
  const four = nl.hyperPassive.slice(0, 4);
  const hp = cellsOf(member("나이트로드", full("나이트로드"), four))[0]!;
  assert.deepEqual([hp.text, hp.n], ["4개", 4]);
  assert.equal(cellsOf(member("나이트로드", skills))[1]!.n, 1);
});

test("guild table: every skill line of every class lands in a column", () => {
  const cols = guildColumns(COMMON, true);
  for (const cls of Object.keys(SPEC_DATA.classes)) {
    // nothing learned and every hyper passive off: every line there can be
    const none = member(cls, [], SPEC_DATA.classes[cls].hyperPassive);
    const lines = checkSkills(none, SPEC_DATA, [EVENT]);
    assert.ok(lines.length >= COMMON.length + 1, cls);
    for (const line of lines) {
      const c = cellOf(line);
      assert.ok(c && cols.includes(c.key), `${cls}: ${line.cat} ${line.what}`);
    }
  }
});

test("guild table: columns, left to right", () => {
  assert.deepEqual(guildColumns(COMMON, false), ["직업 0차", "공격 버프", "연합의 의지", "여제의 축복", "정령의 축복", "하이퍼 패시브"]);
  assert.deepEqual(guildColumns(COMMON, true).at(-1), SKILL_KEY.event);
});

const cell = (key: string): Cell => ({ key, text: "안 배움", tier: "quest", note: "", n: 1 });
const ok = (name: string, level: number, cls: string, keys: string[] = []): MemberRow => ({ ok: true, name, level, cls, known: true, recent: true, cells: keys.map(cell) });

test("guild table: sorting (user, 2026-11-20: 가장 많이 놓친 사람부터 · 레벨 · 이름 · 직업)", () => {
  const rows: MemberRow[] = [
    ok("다람쥐", 295, "아란"),
    { ok: false, name: "가나", reason: "failed" },
    ok("나비", 285, "에반", ["연합의 의지"]),
    ok("가람", 290, "아란", ["연합의 의지", "하이퍼 패시브"]),
    ok("라벤더", 280, "나이트로드", ["하이퍼 패시브"]),
    { ok: false, name: "가가", reason: "notFound" },
  ];
  const names = (by: Parameters<typeof sortRows>[1]) => sortRows(rows, by).map((r) => r.name);
  // most missed first; the same count → higher level first; members not checked always last, by name
  assert.deepEqual(names("miss"), ["가람", "나비", "라벤더", "다람쥐", "가가", "가나"]);
  assert.deepEqual(names("level"), ["다람쥐", "가람", "나비", "라벤더", "가가", "가나"]);
  assert.deepEqual(names("name"), ["가람", "나비", "다람쥐", "라벤더", "가가", "가나"]);
  // 나이트로드 < 아란 < 에반, a class's members by level
  assert.deepEqual(names("class"), ["라벤더", "다람쥐", "가람", "나비", "가가", "가나"]);
  // a column: who missed it first, then the rest as "miss"
  assert.deepEqual(names("col:하이퍼 패시브"), ["가람", "라벤더", "나비", "다람쥐", "가가", "가나"]);
  // things, not lines: 4 hyper passives outrank 연합 + one hyper passive
  const hp4 = ok("마루", 250, "에반");
  if (hp4.ok) hp4.cells = [{ ...cell("하이퍼 패시브"), text: "4개", n: 4 }];
  assert.deepEqual(sortRows([...rows, hp4], "miss").slice(0, 2).map((r) => r.name), ["마루", "가람"]);
});

test("guild table: a column counts members, not lines", () => {
  const two0 = ok("제로", 280, "제로", ["직업 0차", "직업 0차"]);
  const counts = columnCounts([two0, ok("아란", 280, "아란", ["직업 0차", "연합의 의지"]), { ok: false, name: "x", reason: "failed" }], ["직업 0차", "연합의 의지", "보약"]);
  assert.deepEqual(counts, { "직업 0차": 2, "연합의 의지": 1, 보약: 0 });
});
