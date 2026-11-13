import assert from "node:assert/strict";
import { test } from "node:test";
import { koreanMeso, symbolGaps } from "./symbol.ts";
import { SPEC_DATA, abilityComplete, abilityLetter, bossPresets, checkSpec, type SpecRaw } from "./check.ts";

const L = (v: string) => ({ ability_grade: "레전드리", ability_value: v });
const U = (v: string) => ({ ability_grade: "유니크", ability_value: v });
const BOSS20 = "보스 몬스터 공격 시 데미지 20% 증가";
const STATUS8 = "상태 이상에 걸린 대상 공격 시 데미지 8% 증가";
const PASSIVE = "패시브 스킬 레벨 1 증가";

// A synthetic Night Lord with everything filled — each test breaks one thing.
function base(): SpecRaw {
  const nl = SPEC_DATA.classes["나이트로드"];
  const fullHyper = (boss: number, remain: number) => ({
    preset: [
      { stat_type: "보스 몬스터 공격 시 데미지 증가", stat_level: boss },
      { stat_type: "방어율 무시", stat_level: 10 },
      { stat_type: "데미지", stat_level: 13 },
    ],
    remain,
  });
  const h1 = fullHyper(15, 0);
  const h2 = fullHyper(0, 50);
  return {
    basic: { character_name: "테스트", world_name: "스카니아", character_class: "나이트로드", character_level: 285 },
    skill0: {
      character_skill: [
        { skill_name: "여제의 축복", skill_level: 30 },
        { skill_name: "정령의 축복", skill_level: 20 },
        { skill_name: "연합의 의지", skill_level: 1 },
        { skill_name: "영웅의 메아리", skill_level: 1 },
        { skill_name: "고급 무기 제련", skill_level: 1 },
      ],
    },
    hyperPassive: { character_skill: nl.hyperPassive.map((n) => ({ skill_name: n, skill_level: 1 })) },
    vmatrix: {
      character_v_core_equipment: [
        ...["스파이더 인 미러", "크레스트 오브 더 솔라", "바디 오브 스틸", "에르다 노바", "에르다의 의지"].map((n) => ({ v_core_name: n, v_core_type: "공용 코어", v_core_level: 30 })),
        { v_core_name: "일격필살 I", v_core_type: "특수 코어", v_core_level: 1 },
      ],
      character_v_matrix_remain_slot_upgrade_point: 0,
    },
    propensity: { charisma_level: 100, sensibility_level: 100, insight_level: 100, willingness_level: 40 },
    artifact: {
      union_artifact_effect: [
        "보스 몬스터 공격 시 데미지 15.00% 증가",
        "데미지 15.00% 증가",
        "크리티컬 데미지 4.00% 증가",
        "올스탯 150 증가",
        "몬스터 방어율 무시 20% 증가",
        "공격력 30, 마력 30 증가",
        "버프 지속시간 20% 증가",
        "크리티컬 확률 20% 증가",
        "메소 획득량 12% 증가",
      ].map((name) => ({ name, level: 10 })),
      union_artifact_remain_ap: 0,
    },
    equipment: {
      preset_no: 2,
      title: { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%" },
      item_equipment_preset_1: [{ item_name: "리스트레인트 링", potential_option_1: "보스 몬스터 공격 시 데미지 : +40%" }],
      item_equipment_preset_2: [{ item_name: "사냥 반지", potential_option_1: "아이템 드롭률 : +20%", potential_option_2: "메소 획득량 : +20%" }],
    },
    hyper: {
      use_preset_no: "2",
      hyper_stat_preset_1: h1.preset,
      hyper_stat_preset_1_remain_point: h1.remain,
      hyper_stat_preset_2: h2.preset,
      hyper_stat_preset_2_remain_point: h2.remain,
    },
    link: {
      character_link_skill_preset_1: nl.link.map((n) => ({ skill_name: n, skill_level: 2 })),
      character_link_skill_preset_2: [{ skill_name: "룬 퍼시스턴스", skill_level: 3 }],
    },
    ability: {
      preset_no: 2,
      ability_preset_1: { ability_info: [L(BOSS20), U(STATUS8), U("공격력 21 증가")] },
      ability_preset_2: { ability_info: [L("아이템 드롭률 20% 증가"), U("메소 획득량 15% 증가"), U(STATUS8)] },
    },
    pet: {
      pet_1_auto_skill: { skill_1: nl.petBuff[0], skill_2: nl.petBuff[1] },
      pet_2_auto_skill: { skill_1: nl.petBuff[2], skill_2: nl.petBuff[3] },
      world_share_pet_1_auto_skill: { skill_1: nl.petBuff[4] ?? null, skill_2: nl.petBuff[5] ?? null },
    },
    symbol: { symbol: [{ symbol_name: "아케인심볼 : 소멸의 여로", symbol_level: 20 }] },
  };
}

test("ability letters", () => {
  assert.equal(abilityLetter(PASSIVE), "패");
  assert.equal(abilityLetter(BOSS20), "보");
  assert.equal(abilityLetter("마력 21 증가"), "공");
  assert.equal(abilityLetter("14 레벨마다 마력 1 증가"), null);
  assert.equal(abilityLetter("버프 스킬의 지속 시간 38% 증가"), "벞");
  assert.equal(abilityLetter("최대 HP 20% 증가"), "피");
  assert.equal(abilityLetter("최대 HP 600 증가"), null);
});

test("ability complete: legendary x3 end combo or legendary + unique x2", () => {
  const nl = SPEC_DATA.classes["나이트로드"].ability; // full 패보상, practical 보상공
  assert.ok(abilityComplete([L(PASSIVE), L(BOSS20), L(STATUS8)], nl));
  assert.ok(abilityComplete([L(STATUS8), L(PASSIVE), L(BOSS20)], nl), "order does not matter");
  assert.ok(!abilityComplete([L(PASSIVE), U(BOSS20), U(STATUS8)], nl), "end combo needs all legendary");
  assert.ok(abilityComplete([L(BOSS20), U(STATUS8), U("공격력 21 증가")], nl));
  assert.ok(abilityComplete([L(BOSS20), U(STATUS8), U("버프 스킬의 지속 시간 38% 증가")], nl), "공 = 벞");
  assert.ok(!abilityComplete([L(BOSS20), U(STATUS8), U("아이템 드롭률 20% 증가")], nl));
});

test("boss preset: fewest drop lines, hyper sum, link overlap, ability match", () => {
  const raw = base();
  assert.deepEqual(bossPresets(raw, SPEC_DATA.classes["나이트로드"]), { eq: 1, hyper: 1, link: 1, ability: 1 });
});

test("a complete character has no misses", () => {
  const r = checkSpec(base(), new Date("2026-11-09T00:00:00+09:00"));
  assert.deepEqual(r.misses, []);
  assert.equal(r.known, true);
});

test("each rule fires", () => {
  const raw = base();
  raw.skill0.character_skill = raw.skill0.character_skill!.filter((s) => !["연합의 의지", "영웅의 메아리", "고급 무기 제련"].includes(s.skill_name));
  raw.skill0.character_skill.find((s) => s.skill_name === "여제의 축복")!.skill_level = 24;
  raw.propensity.charisma_level = 80;
  raw.vmatrix.character_v_core_equipment!.find((c) => c.v_core_name === "에르다 노바")!.v_core_level = 4;
  raw.vmatrix.character_v_core_equipment = raw.vmatrix.character_v_core_equipment!.filter((c) => c.v_core_type !== "특수 코어");
  raw.hyper.hyper_stat_preset_1_remain_point = 7;
  raw.hyperPassive.character_skill![0].skill_level = 0;
  (raw.link.character_link_skill_preset_1 as unknown[]).pop();
  raw.ability.ability_preset_1 = { ability_info: [L(BOSS20), U(STATUS8), U("아이템 드롭률 20% 증가")] };
  raw.pet = {};
  const r = checkSpec(raw, new Date("2026-11-09T00:00:00+09:00"));
  const what = r.misses.map((m) => m.what);
  assert.ok(what.includes("여제의 축복 24 / 30"));
  assert.ok(what.includes("연합의 의지 안 배움"));
  assert.ok(what.includes("영웅의 메아리 안 배움"));
  assert.ok(what.includes("카리스마 80 / 100"));
  assert.ok(what.includes("30레벨 미만 1개"));
  assert.ok(what.includes("보스용 없음"));
  assert.ok(what.includes("7포인트 남음 (1번 프리셋)"));
  assert.ok(what.includes("대부분 찍는 것 1개 안 찍음"));
  assert.ok(what.some((w) => /^대부분 끼는 것 1개 빠짐/.test(w)));
  assert.ok(what.includes("미완성 (1번 프리셋)"));
  assert.ok(what.some((w) => /^대부분 등록하는 것 \d+개 빠짐$/.test(w)));
  assert.ok(r.tips.some((t) => t.cat === "고급 무기 제련"));
});

test("artifact: warn only when a boss effect is short while points sit in a non-boss one", () => {
  const raw = base();
  const fx = raw.artifact.union_artifact_effect!;
  fx.find((e) => /방어율 무시/.test(e.name))!.level = 0;
  let r = checkSpec(raw);
  assert.equal(r.misses.find((m) => m.cat === "유니온 아티팩트")?.what, "보스용 효과 1개 Lv.10 미만");
  // No points in non-boss effects (low-level artifact): nothing to move, no warning.
  raw.artifact.union_artifact_effect = fx.filter((e) => !/메소 획득량/.test(e.name));
  r = checkSpec(raw);
  assert.equal(r.misses.find((m) => m.cat === "유니온 아티팩트"), undefined);
});

test("title: equipped title (title presets do not follow equipment presets), expiry within 14 days", () => {
  const raw = base();
  raw.equipment.title_preset2 = null; // boss equipment preset is 1, but a null title preset must not matter
  raw.equipment.title = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "2026-11-15T00:00+09:00" };
  const r = checkSpec(raw, new Date("2026-11-09T00:00:00+09:00"));
  assert.deepEqual(r.misses.map((m) => m.what), ["옵션 만료 6일 남음"]);
  raw.equipment.title = { title_name: "사냥 칭호", title_description: "경험치 +10%" };
  assert.deepEqual(checkSpec(raw).misses.map((m) => m.what), ["보스 데미지 없음"]);
});

test("Codex review cases: expired title, no title, no links, low-grade practical line", () => {
  const nl = SPEC_DATA.classes["나이트로드"].ability;
  assert.ok(!abilityComplete([L(BOSS20), U(STATUS8), { ability_grade: "레어", ability_value: "공격력 9 증가" }], nl), "practical lines 2 · 3 need unique+");

  let raw = base();
  raw.equipment.title = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "expired" };
  assert.deepEqual(checkSpec(raw).misses.map((m) => m.what), ["옵션 만료"]);

  raw = base();
  raw.equipment.title = null;
  assert.deepEqual(checkSpec(raw).misses.map((m) => m.what), ["미장착"]);

  raw = base();
  raw.link = { character_link_skill_preset_1: [], character_link_skill_preset_2: [], character_link_skill_preset_3: [] };
  assert.deepEqual(checkSpec(raw).misses.map((m) => m.what), ["미장착"]);
});

test("special core: a boss core in any V matrix preset counts (equipped set may be the hunting one)", () => {
  const raw = base();
  raw.vmatrix.character_v_core_equipment = raw.vmatrix.character_v_core_equipment!.map((c) =>
    c.v_core_type === "특수 코어" ? { ...c, v_core_name: "룬의 경험 I" } : c,
  );
  assert.ok(checkSpec(raw).misses.some((m) => m.what === "보스용 없음"));
  (raw.vmatrix as Record<string, unknown>).character_v_core_equipment_preset_2 = [{ v_core_name: "일격필살 I", v_core_type: "특수 코어", v_core_level: 1 }];
  assert.ok(!checkSpec(raw).misses.some((m) => m.what === "보스용 없음"));
});

test("demon avenger: will propensity and HP artifact", () => {
  const raw = base();
  raw.basic.character_class = "데몬어벤져";
  const r = checkSpec(raw);
  assert.ok(r.misses.some((m) => m.what === "의지 40 / 100"));
});

test("unknown class: class rules skipped", () => {
  const raw = base();
  raw.basic.character_class = "새직업";
  const r = checkSpec(raw);
  assert.equal(r.known, false);
  assert.deepEqual(r.misses, []);
});

test("symbols: only levels the collected growth already covers (준민나로12)", () => {
  const gaps = symbolGaps([
    { symbol_name: "아케인심볼 : 소멸의 여로", symbol_level: 20, symbol_growth_count: 0, symbol_luk: "2200" },
    { symbol_name: "어센틱심볼 : 세르니움", symbol_level: 10, symbol_growth_count: 1100, symbol_luk: "2300" },
    { symbol_name: "어센틱심볼 : 아르크스", symbol_level: 7, symbol_growth_count: 1454, symbol_luk: "1700" },
    { symbol_name: "어센틱심볼 : 오디움", symbol_level: 5, symbol_growth_count: 1119, symbol_luk: "1300" },
    { symbol_name: "어센틱심볼 : 도원경", symbol_level: 4, symbol_growth_count: 1520, symbol_luk: "1100" },
    { symbol_name: "어센틱심볼 : 아르테리아", symbol_level: 4, symbol_growth_count: 521, symbol_luk: "1100" },
    { symbol_name: "어센틱심볼 : 카르시온", symbol_level: 1, symbol_growth_count: 10, symbol_luk: "500" },
    { symbol_name: "아케인심볼 : 레헬른", symbol_level: 15, symbol_growth_count: 236 + 267, symbol_hp: "35700" },
  ]);
  assert.deepEqual(gaps.map((g) => [g.region, g.level, g.to]), [
    ["세르니움", 10, 11], ["아르크스", 7, 9], ["오디움", 5, 7], ["도원경", 4, 7], ["아르테리아", 4, 5], ["레헬른", 15, 17],
  ]);
  // Checked: 7.92 · 13.78 · 10.35 · 15.36 · 4.03억, total 51.44억
  const auth = gaps.filter((g) => g.kind === "authentic");
  assert.deepEqual(auth.map((g) => Math.round(g.meso! / 1e6) / 100), [7.92, 13.78, 10.35, 15.36, 4.03]);
  assert.equal(Math.round(auth.reduce((s, g) => s + g.meso!, 0) / 1e6) / 100, 51.44);
  assert.deepEqual(auth[1].stats, [["LUK", 400]]);
  assert.equal(auth[1].force, 20);
  const rehel = gaps.find((g) => g.region === "레헬른")!;
  assert.deepEqual(rehel.stats, [["HP", 4200]], "Demon Avenger HP 35,700 at Lv.15 → 39,900 at Lv.17");
  assert.equal(rehel.meso, 22300000 + 25410000);
  assert.equal(koreanMeso(7920000000), "79억 2,000만");
  assert.equal(koreanMeso(670000), "67만");
});

test("artifact: crit rate counts as a boss effect, non-boss names are short", () => {
  const raw = base();
  raw.artifact.union_artifact_effect!.find((e) => /방어율 무시/.test(e.name))!.level = 0;
  const m = checkSpec(raw).misses.find((x) => x.cat === "유니온 아티팩트")!;
  assert.deepEqual(m.detail, ["부족: 방어율 무시 Lv.0", "보스에 안 쓰는 효과: 메소 획득량 Lv.10"]);
});

test("title: a boss title kept in a title preset counts while a hunting title is on (user, 2026-11-11)", () => {
  const raw = base();
  raw.equipment.title = { title_name: "쑥쑥 새싹", title_description: "경험치 획득량 +10%" };
  raw.equipment.title_preset1 = { title_name: "쑥쑥 새싹", title_description: "경험치 획득량 +10%" };
  raw.equipment.title_preset2 = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%" };
  assert.equal(checkSpec(raw).misses.find((m) => m.cat === "칭호"), undefined);
  // No boss title anywhere: the one equipped now is named.
  raw.equipment.title_preset2 = null;
  const miss = checkSpec(raw).misses.find((m) => m.cat === "칭호")!;
  assert.equal(miss.what, "보스 데미지 없음");
  // The preset title's expiry is the one that matters.
  raw.equipment.title_preset3 = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "expired" };
  assert.deepEqual(checkSpec(raw).misses.filter((m) => m.cat === "칭호").map((m) => m.what), ["옵션 만료"]);
});

test("바디 오브 스틸 is only asked of warriors (user, 2026-11-11)", () => {
  const raw = base();
  raw.vmatrix.character_v_core_equipment = raw.vmatrix.character_v_core_equipment!.filter((c) => c.v_core_name !== "바디 오브 스틸");
  const cores = (cls: string) => {
    raw.basic.character_class = cls;
    return checkSpec(raw).misses.find((m) => m.cat === "5차 공용 코어");
  };
  assert.equal(cores("아크메이지(썬,콜)"), undefined);
  assert.equal(cores("메르세데스"), undefined);
  assert.ok(cores("데몬슬레이어")?.detail?.join(" ").includes("바디 오브 스틸"));
  assert.ok(cores("히어로")?.detail?.join(" ").includes("바디 오브 스틸"));
});

test("title: a usable boss title beats an expired or expiring copy in another preset (Codex review)", () => {
  const raw = base();
  const now = new Date("2026-11-09T00:00:00+09:00");
  raw.equipment.title = { title_name: "쑥쑥 새싹", title_description: "경험치 획득량 +10%" };
  raw.equipment.title_preset1 = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "expired" };
  raw.equipment.title_preset2 = { title_name: "보스 칭호 2", title_description: "보스 몬스터 데미지 +10%" };
  assert.equal(checkSpec(raw, now).misses.find((m) => m.cat === "칭호"), undefined);
  // Expiring soon in one preset, permanent in another: nothing to report.
  raw.equipment.title_preset1 = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "2026-11-12T00:00+09:00" };
  assert.equal(checkSpec(raw, now).misses.find((m) => m.cat === "칭호"), undefined);
  // Only expiring ones: the one that lasts longest is the one reported.
  raw.equipment.title_preset2 = { title_name: "보스 칭호 2", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "2026-11-15T00:00+09:00" };
  assert.deepEqual(checkSpec(raw, now).misses.filter((m) => m.cat === "칭호").map((m) => m.what), ["옵션 만료 6일 남음"]);
});
