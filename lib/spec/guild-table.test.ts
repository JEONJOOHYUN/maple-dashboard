import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_DATA, checkSkills, type SkillRaw } from "./check.ts";
import { GUILD_COLUMNS, SKILL_KEY, cellOf, columnCounts, groupPeople, matchName, matchPeople, sortPeople, sortRows, subMatches, type Cell, type MemberRow } from "./guild-table.ts";

const EVENT = "아르고 호의 가호";
const NOW = new Date("2026-11-20T12:00:00+09:00");

/**
 * A level 280 character of `cls` with these 0th-grade skills; hyper passives all taken except `hpOff`; the class's
 * standard links on preset 1 but `linkOff`; its pet buffs registered but `petOff`.
 */
function member(cls: string, skills: [string, number][], { hpOff = [] as string[], linkOff = [] as string[], petOff = [] as string[], noLinks = false } = {}): SkillRaw {
  const rule = SPEC_DATA.classes[cls];
  const buffs = [...new Set([...rule.petBuff, "쓸만한 홀리 심볼"])].filter((n) => !petOff.includes(n));
  return {
    basic: { character_name: "테스트", world_name: "스카니아", character_class: cls, character_level: 280 },
    skill0: { character_skill: skills.map(([skill_name, skill_level]) => ({ skill_name, skill_level })) },
    hyperPassive: { character_skill: rule.hyperPassive.map((n) => ({ skill_name: n, skill_level: hpOff.includes(n) ? 0 : 1 })) },
    link: noLinks ? {} : { character_link_skill_preset_1: rule.link.filter((n) => !linkOff.includes(n)).map((n) => ({ skill_name: n, skill_level: 2 })) },
    pet: Object.fromEntries(
      ["pet_1", "pet_2", "pet_3", "world_share_pet_1", "world_share_pet_2", "world_share_pet_3"].map((p, i) => [`${p}_auto_skill`, { skill_1: buffs[i * 2] ?? null, skill_2: buffs[i * 2 + 1] ?? null }]),
    ),
  };
}
/** Everything a class can have, at max: common skills, its attack buff, its own 0th-job skills. */
function full(cls: string): [string, number][] {
  const rule = SPEC_DATA.classes[cls];
  return [...SPEC_DATA.common.skills0.map((s): [string, number] => [s.name, s.max]), ...rule.atkBuff.slice(0, 1).map((n): [string, number] => [n, 1]), ...rule.skills0.map((s): [string, number] => [s.name, s.max])];
}
const cellsOf = (raw: SkillRaw, ev: string[] = []) => checkSkills(raw, SPEC_DATA, ev, NOW).map(cellOf).filter((c): c is Cell => !!c);
const short = (c: Cell) => `${c.key}|${c.text}|${c.tier}`;

test("guild table: six columns — 정령의 축복 and 영웅의 메아리 left out, 링크 · 펫 버프 in (user, 2026-11-20)", () => {
  assert.deepEqual(GUILD_COLUMNS, ["0차 스킬", "연합의 의지", "여제의 축복", "하이퍼 패시브", "링크", "펫 버프"]);
});

test("guild table: a line → its column and short text", () => {
  // Night Lord: 연합 · 영웅의 메아리 not learned, 여제 24, 정령 14, one hyper passive off, the event skill not taken
  const nl = SPEC_DATA.classes["나이트로드"];
  const skills = full("나이트로드")
    .filter(([n]) => n !== "연합의 의지" && n !== nl.atkBuff[0])
    .map(([n, lv]): [string, number] => [n, n === "여제의 축복" ? 24 : n === "정령의 축복" ? 14 : lv]);
  // 영웅의 메아리 and 정령의 축복 have no column; 보약 sits in the 0차 스킬 column under its skill's name
  assert.deepEqual(cellsOf(member("나이트로드", skills, { hpOff: [nl.hyperPassive[0]] }), [EVENT]).map(short), [
    "하이퍼 패시브|1개|now",
    "여제의 축복|24 / 30|quest",
    "연합의 의지|안 배움|quest",
    `0차 스킬|${EVENT}|quest`,
  ]);
  // Evan without 계승된 의지: the column names the skill, and the bubble has the whole line
  const evan = full("에반").filter(([n]) => n !== "계승된 의지");
  const [ev] = cellsOf(member("에반", evan));
  assert.equal(short(ev), "0차 스킬|계승된 의지|quest");
  assert.equal(ev.what, "계승된 의지 안 배움");
  assert.deepEqual(ev.detail, [SPEC_DATA.classes["에반"].skills0.find((s) => s.name === "계승된 의지")!.effect]);
  // a 0th-job skill half raised keeps its level: "괴이봉인 4 / 10"; 여제 under 24 = raising other characters
  const hy = full("호영").map(([n, lv]): [string, number] => [n, n === "괴이봉인" ? 4 : n === "여제의 축복" ? 18 : lv]);
  const max = SPEC_DATA.classes["호영"].skills0.find((s) => s.name === "괴이봉인")!.max;
  assert.deepEqual(cellsOf(member("호영", hy)).map(short), [`0차 스킬|괴이봉인 4 / ${max}|quest`, "여제의 축복|18 / 30|long"]);
});

test("guild table: links and pet buffs are counted things (user, 2026-11-20: 자주 실수하는 펫버프, 링크)", () => {
  const nl = SPEC_DATA.classes["나이트로드"];
  const cells = cellsOf(member("나이트로드", full("나이트로드"), { hpOff: nl.hyperPassive.slice(0, 4), linkOff: nl.link.slice(0, 2), petOff: nl.petBuff.slice(0, 1) }));
  // in the character check's order (all 바로 됨): hyper passives, pet buffs, links
  assert.deepEqual(cells.map((c) => [c.key, c.text, c.n]), [
    ["하이퍼 패시브", "4개", 4],
    ["펫 버프", "1개", 1],
    ["링크", "2개", 2],
  ]);
  // the bubble lists the links with the class that gives them
  const link = cells.find((c) => c.key === SKILL_KEY.link)!;
  assert.ok(link.what.startsWith("대부분 끼는 것 2개 빠짐"));
  assert.equal(link.detail.length, 1);
  // no link at all: "미장착", every standard link counted
  const none = cellsOf(member("나이트로드", full("나이트로드"), { noLinks: true })).find((c) => c.key === SKILL_KEY.link)!;
  assert.deepEqual([none.text, none.n], ["미장착", nl.link.length]);
});

test("guild table: every line of every class has a column, but the two left out", () => {
  const left = new Set<string>([SKILL_KEY.atkBuff, "정령의 축복"]);
  for (const cls of Object.keys(SPEC_DATA.classes)) {
    // nothing learned, every hyper passive off, no links, no pet buffs: every line there can be
    const rule = SPEC_DATA.classes[cls];
    const none = member(cls, [], { hpOff: rule.hyperPassive, noLinks: true, petOff: [...rule.petBuff, "쓸만한 홀리 심볼"] });
    for (const line of checkSkills(none, SPEC_DATA, [EVENT], NOW)) {
      const c = cellOf(line);
      assert.ok(c ? GUILD_COLUMNS.includes(c.key) : left.has(line.key ?? ""), `${cls}: ${line.cat} ${line.what}`);
    }
  }
});

const cell = (key: string): Cell => ({ key, text: "안 배움", tier: "quest", what: "", detail: [], n: 1 });
const ok = (name: string, level: number, cls: string, keys: string[] = [], main: string | null = null): MemberRow => ({ ok: true, name, level, cls, known: true, recent: true, main, cells: keys.map(cell) });

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
  // columns first, then things: 연합 + one hyper passive (2 columns) before 4 hyper passives (1 column), which comes
  // before one hyper passive — and 12 links off (a link-holder alt, 가몽 2026-11-20) does not jump the line
  const hp4 = ok("마루", 250, "에반");
  if (hp4.ok) hp4.cells = [{ ...cell("하이퍼 패시브"), text: "4개", n: 4 }];
  const alt = ok("링크부캐", 276, "비숍");
  if (alt.ok) alt.cells = [{ ...cell("링크"), text: "미장착", n: 12 }];
  assert.deepEqual(sortRows([...rows, hp4, alt], "miss").slice(0, 4).map((r) => r.name), ["가람", "링크부캐", "마루", "나비"]);
});

test("guild table: a member by name (user, 2026-11-20: 길드 내에서도 특정 인원을 검색)", () => {
  const rows: MemberRow[] = [ok("음덩", 285, "은월"), ok("데몬10세기", 281, "데몬어벤져"), ok("Maple", 270, "아란"), { ok: false, name: "음덩이", reason: "failed" }];
  assert.deepEqual(matchName(rows, "음덩").map((r) => r.name), ["음덩", "음덩이"]);
  assert.deepEqual(matchName(rows, " maple ").map((r) => r.name), ["Maple"]);
  assert.equal(matchName(rows, "").length, 4);
  assert.deepEqual(matchName(rows, "없는 이름"), []);
});

test("guild players: a main with its other characters under it (user, 2026-11-20: 계정 그룹 캐릭들은 따로 묶어서)", () => {
  const rows: MemberRow[] = [
    ok("아델10세기", 274, "아델", ["링크"], "데몬10세기"),
    ok("데몬10세기", 281, "데몬어벤져", ["연합의 의지"], "데몬10세기"),
    ok("음덩", 285, "은월", [], "음덩"),
    // its main is in another guild: the highest of the rest heads the line, the main named beside it
    ok("풍마죽", 278, "나이트로드", ["링크"], "잊힌한우"),
    ok("풍마죽2", 260, "보우마스터", [], "잊힌한우"),
    // no union row: a player of its own
    ok("새캐릭", 200, "아란", [], null),
    { ok: false, name: "확인실패", reason: "failed" },
    // the main could not be checked while its other character names it: it still heads the line
    { ok: false, name: "흑소", reason: "failed" },
    ok("푸소", 285, "데몬슬레이어", [], "흑소"),
  ];
  const people = groupPeople(rows);
  const line = (key: string) => people.find((p) => p.key === key)!;
  assert.equal(people.length, 6);
  assert.deepEqual([line("데몬10세기").head.name, line("데몬10세기").subs.map((r) => r.name), line("데몬10세기").away], ["데몬10세기", ["아델10세기"], null]);
  assert.deepEqual([line("잊힌한우").head.name, line("잊힌한우").subs.map((r) => r.name), line("잊힌한우").away], ["풍마죽", ["풍마죽2"], "잊힌한우"]);
  assert.deepEqual([line("흑소").head.name, line("흑소").subs.map((r) => r.name)], ["흑소", ["푸소"]]);
  assert.deepEqual([line("음덩").subs, line("새캐릭").subs, line("확인실패").subs], [[], [], []]);
  // every member once
  assert.equal(people.reduce((s, p) => s + 1 + p.subs.length, 0), rows.length);
});

test("guild players: sorted by their mains, ties by their other characters", () => {
  const people = groupPeople([
    ok("가람", 290, "아란", ["링크"], "가람"),
    ok("나비", 295, "에반", ["링크"], "나비"),
    ok("나비2", 270, "아란", ["펫 버프"], "나비"),
    ok("다람쥐", 280, "레테", [], "다람쥐"),
    ok("다람쥐2", 260, "렌", ["링크", "펫 버프"], "다람쥐"),
    ok("다람쥐3", 265, "제로", [], "다람쥐"),
    ok("라벤더", 299, "비숍", [], "라벤더"),
    { ok: false, name: "가가", reason: "failed" },
  ]);
  const keys = (by: Parameters<typeof sortPeople>[1]) => sortPeople(people, by).map((p) => p.key);
  // 가람 = 나비 on their mains (one column each): 나비's other character missed something, so 나비 first;
  // 다람쥐 = 라벤더 (mains clean): 다람쥐 has an other character that missed, 라벤더 none; not checked last
  assert.deepEqual(keys("miss"), ["나비", "가람", "다람쥐", "라벤더", "가가"]);
  assert.deepEqual(keys("level"), ["라벤더", "나비", "가람", "다람쥐", "가가"]);
  // a column: mains that missed it, then players whose other characters did
  assert.deepEqual(keys("col:펫 버프"), ["나비", "다람쥐", "가람", "라벤더", "가가"]);
  // the others in the same order: 다람쥐2 (two columns) before 다람쥐3 (none)
  assert.deepEqual(sortPeople(people, "miss").find((p) => p.key === "다람쥐")!.subs.map((r) => r.name), ["다람쥐2", "다람쥐3"]);
});

test("guild players: found by any of their characters' names, the line opening for another's", () => {
  const people = groupPeople([ok("데몬10세기", 281, "데몬어벤져", [], "데몬10세기"), ok("아델10세기", 274, "아델", [], "데몬10세기"), ok("음덩", 285, "은월", [], "음덩")]);
  assert.deepEqual(matchPeople(people, "아델").map((p) => p.key), ["데몬10세기"]);
  assert.deepEqual(matchPeople(people, "데몬").map((p) => p.key), ["데몬10세기"]);
  assert.equal(matchPeople(people, " ").length, 2);
  const demon = people.find((p) => p.key === "데몬10세기")!;
  assert.equal(subMatches(demon, "아델"), true);
  assert.equal(subMatches(demon, "데몬10"), false);
  assert.equal(subMatches(demon, ""), false);
});

test("guild table: a column counts members, not lines", () => {
  const two0 = ok("제로", 280, "제로", ["0차 스킬", "0차 스킬"]);
  const counts = columnCounts([two0, ok("아란", 280, "아란", ["0차 스킬", "연합의 의지"]), { ok: false, name: "x", reason: "failed" }], ["0차 스킬", "연합의 의지", "링크"]);
  assert.deepEqual(counts, { "0차 스킬": 2, "연합의 의지": 1, 링크: 0 });
});
