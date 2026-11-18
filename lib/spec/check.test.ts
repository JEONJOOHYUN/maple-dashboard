import assert from "node:assert/strict";
import { test } from "node:test";
import { koreanMeso, symbolGaps } from "./symbol.ts";
import { SPEC_DATA, abilityComplete, abilityLetter, artifactSpendable, bossPresets, checkSpec, labelPieces, labelPlusOf, periodsOf, type SpecRaw } from "./check.ts";

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
  raw.hyper.hyper_stat_preset_1_remain_point = 12;
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
  assert.ok(what.includes("12포인트 남음 (1번 프리셋)"));
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

test("hyper stat: a few spare points are fine, warn from 10", () => {
  const raw = base();
  raw.hyper.hyper_stat_preset_1_remain_point = 9;
  assert.equal(checkSpec(raw).misses.find((m) => m.cat === "하이퍼 스탯"), undefined);
  raw.hyper.hyper_stat_preset_1_remain_point = 10;
  assert.equal(checkSpec(raw).misses.find((m) => m.cat === "하이퍼 스탯")?.what, "10포인트 남음 (1번 프리셋)");
});

test("title: the title and its option warned only under 7 days", () => {
  const raw = base();
  const now = new Date("2026-11-09T00:00:00+09:00");
  const boss = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%" };
  for (const [key, label] of [["date_option_expire", "옵션"], ["date_expire", "기간"]] as const) {
    raw.equipment.title = { ...boss, [key]: "2026-11-20T00:00+09:00" };
    assert.equal(checkSpec(raw, now).misses.find((m) => m.cat === "칭호"), undefined, `${label}: 11 days left, no warning`);
    raw.equipment.title = { ...boss, [key]: "2026-11-16T00:00+09:00" };
    assert.equal(checkSpec(raw, now).misses.find((m) => m.cat === "칭호"), undefined, `${label}: 7 days left, no warning`);
    raw.equipment.title = { ...boss, [key]: "2026-11-15T12:00+09:00" };
    assert.equal(checkSpec(raw, now).misses.find((m) => m.cat === "칭호"), undefined, `${label}: 6.5 days shows as 7, no warning`);
    raw.equipment.title = { ...boss, [key]: "2026-11-15T00:00+09:00" };
    assert.deepEqual(checkSpec(raw, now).misses.map((m) => m.what), [`${label} 만료 6일 남음`]);
  }
});

test("title: equipped title (title presets do not follow equipment presets), expiry under 7 days", () => {
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

test("5th job: every 공용 코어 the character has is looked at, the named ones even when missing", () => {
  const raw = base();
  const cores = raw.vmatrix.character_v_core_equipment!;
  // Ones that are not in the named list: a class-group one, a 쓸만한 one, a movement one.
  cores.push({ v_core_name: "메이플월드 여신의 축복", v_core_type: "공용 코어", v_core_level: 30 });
  cores.push({ v_core_name: "쓸만한 샤프 아이즈", v_core_type: "공용 코어", v_core_level: 25 });
  cores.push({ v_core_name: "블링크", v_core_type: "공용 코어", v_core_level: 1 });
  // A skill core of the job itself is not a 공용 코어.
  cores.push({ v_core_name: "스프레드 스로우", v_core_type: "직업 코어", v_core_level: 20 });
  // A named one that is missing altogether.
  raw.vmatrix.character_v_core_equipment = cores.filter((c) => c.v_core_name !== "에르다의 의지");
  const miss = checkSpec(raw).misses.find((m) => m.cat === "5차 공용 코어")!;
  assert.equal(miss.what, "30레벨 미만 3개");
  assert.deepEqual(miss.detail, ["에르다의 의지 0 · 쓸만한 샤프 아이즈 25 · 블링크 1"]);
});

test("보약: the running event's skill is asked for by name, nothing when no event skill is running", () => {
  const now = new Date("2026-11-13T12:00:00+09:00");
  const find = (raw: SpecRaw, skills: string[]) => checkSpec(raw, now, SPEC_DATA, skills).misses.filter((m) => m.cat === "보약").map((m) => m.what);
  assert.deepEqual(find(base(), ["아르고 호의 가호"]), ["아르고 호의 가호 안 배움"]);
  const has = base();
  has.skill0.character_skill!.push({ skill_name: "아르고 호의 가호", skill_level: 1 });
  assert.deepEqual(find(has, ["아르고 호의 가호"]), []);
  assert.deepEqual(find(base(), []), []);
  assert.deepEqual(checkSpec(base(), now).misses.filter((m) => m.cat === "보약"), []);
});

// Shapes from the API (2026-11-17 probes: 흑소 uses the world's 마스터라벨 set, 귤민 its own; 먹음쟁이 기간제 rings).
const ML = (slot: string, name: string, at: string, opt = [{ option_type: "STR", option_value: "30" }]) => ({
  cash_item_equipment_slot: slot,
  cash_item_name: name,
  cash_item_label: "마스터라벨",
  cash_item_option: opt,
  date_expire: null,
  date_option_expire: at,
});

test("periods: stat cash items worn + the world's 마스터라벨 set when used, pets once each (user, 2026-11-17)", () => {
  const now = new Date("2026-11-17T12:00:00+09:00");
  const raw = base();
  raw.cash = {
    world_share_master_label_activate_flag: "1",
    cash_item_equipment_base: [
      { cash_item_equipment_slot: "반지1", cash_item_name: "오로라 반지", cash_item_label: null, cash_item_option: [{ option_type: "STR", option_value: "1" }], date_expire: "2026-11-20T01:51+09:00", date_option_expire: null },
      { cash_item_equipment_slot: "반지2", cash_item_name: "혈맹의 반지", cash_item_label: null, cash_item_option: [], date_expire: "2026-11-18T20:17+09:00", date_option_expire: null },
      { cash_item_equipment_slot: "무기", cash_item_name: "달걀 마라카스", cash_item_label: "블랙라벨", cash_item_option: [{ option_type: "공격력", option_value: "22" }], date_expire: null, date_option_expire: "2026-12-20T00:00+09:00" },
      { cash_item_equipment_slot: "모자", cash_item_name: "피의 서약", cash_item_label: "마스터라벨", cash_item_option: [], date_expire: null, date_option_expire: null },
    ],
    // Looks only: a preset item's stats are not counted.
    cash_item_equipment_preset_1: [ML("모자", "프리셋 모자", "2026-11-18T00:00+09:00")],
    world_share_master_label_base: [ML("모자", "청몽잠", "2027-08-20T01:00+09:00"), ML("상의", "청몽선율", "2027-05-14T17:00+09:00")],
  };
  raw.pet = {
    ...raw.pet,
    pet_1_name: "쁘띠 플로라",
    pet_1_date_expire: "2026-11-17T00:00+09:00",
    world_share_pet_1_name: "쁘띠 플로라",
    world_share_pet_1_date_expire: "2026-11-17T00:00+09:00",
    pet_2_name: "카이",
    pet_2_date_expire: "2027-05-29T23:00+09:00",
    pet_3_name: null,
    pet_3_date_expire: null,
  };
  const p = periodsOf(raw, now);
  assert.deepEqual(
    p.map((x) => [x.kind, x.name, x.days, x.at]),
    [
      ["pet", "쁘띠 플로라", -1, "2026-11-17"],
      ["cashItem", "오로라 반지", 3, "2026-11-20"],
      ["cashStat", "달걀 마라카스", 33, "2026-12-20"],
      ["label", "청몽선율", 179, "2027-05-14"],
      ["pet", "카이", 194, "2027-05-29"],
      ["label", "청몽잠", 276, "2027-08-20"],
    ],
  );
  const misses = checkSpec(raw, now).misses.filter((m) => m.cat === "캐시 장비" || m.cat === "펫");
  assert.deepEqual(misses, [
    { cat: "캐시 장비", what: "기간 만료 3일 남음", detail: ["오로라 반지"], tier: "urgent" },
    { cat: "펫", what: "기간 만료 1마리", detail: ["쁘띠 플로라"], tier: "urgent" },
    // two pets out of three (the one that is over still takes its place)
    { cat: "펫", what: "1자리 비어 있음", detail: ["지금 2마리 · 3마리까지 · 한 마리에 펫 버프 2개"], tier: "long" },
  ]);
  // The world's set is ignored when the character does not use it (귤민: its own set counts).
  raw.cash.world_share_master_label_activate_flag = "0";
  assert.ok(!periodsOf(raw, now).some((x) => x.kind === "label"));
  // Nothing fetched (older saved shapes): no periods, no misses.
  assert.deepEqual(periodsOf(base(), now), []);
});

test("마스터라벨 플러스: running ones and how many labels they count (official 2026-08-20 table)", () => {
  const raw = base();
  raw.otherStat = {
    other_stat: [
      { other_stat_type: "[마스터라벨 플러스] 성장 플러스", stat_info: [{ stat_name: "추가 경험치 획득", stat_value: "100" }] },
      { other_stat_type: "[마스터라벨 플러스] 전투 플러스", stat_info: [{ stat_name: "공격력", stat_value: "40" }, { stat_name: "STR", stat_value: "90" }] },
      { other_stat_type: "다른 효과", stat_info: [] },
    ],
  };
  assert.deepEqual(labelPlusOf(raw), ["성장 플러스 · 마라벨 5개", "전투 플러스 · 마라벨 4개"]);
  assert.deepEqual(labelPlusOf(base()), []);
});

test("title: one hour past the end is 만료, not 0일 남음", () => {
  const raw = base();
  raw.equipment.title = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_option_expire: "2026-11-17T11:00+09:00" };
  const what = checkSpec(raw, new Date("2026-11-17T12:00:00+09:00")).misses.filter((m) => m.cat === "칭호").map((m) => m.what);
  assert.deepEqual(what, ["옵션 만료"]);
});

test("links: a missing link shows the class that gives it, and every standard link has one (user, 2026-11-17)", () => {
  const raw = base();
  const links = raw.link.character_link_skill_preset_1 as { skill_name: string }[];
  raw.link.character_link_skill_preset_1 = links.filter((l) => l.skill_name !== "프라이어 프리퍼레이션" && l.skill_name !== "임피리컬 널리지");
  const miss = checkSpec(raw, new Date("2026-11-09T00:00:00+09:00")).misses.find((m) => m.cat === "링크 스킬")!;
  assert.deepEqual(miss.detail, ["임피리컬 널리지 (모험가 마법사) · 프라이어 프리퍼레이션 (카인)"]);
  for (const [job, rule] of Object.entries(SPEC_DATA.classes))
    for (const l of rule.link) assert.ok(SPEC_DATA.linkOwners?.[l], `${job}: ${l}`);
  assert.equal(SPEC_DATA.linkOwners?.["판단"], "키네시스");
  assert.equal(SPEC_DATA.linkOwners?.["커버넌트"], "레테");
});

test("마스터라벨 플러스: labels with stats left but no 전투 플러스 → warned (user, 2026-11-17)", () => {
  const now = new Date("2026-11-17T12:00:00+09:00");
  const raw = base();
  raw.cash = {
    world_share_master_label_activate_flag: "1",
    cash_item_equipment_base: [],
    world_share_master_label_base: [
      ML("모자", "청몽잠", "2027-08-20T01:00+09:00"),
      ML("상의", "청몽선율", "2027-05-14T17:00+09:00"),
      ML("신발", "청몽운", "2027-05-14T17:00+09:00"),
      ML("망토", "달빛 눈물", "2027-05-20T19:00+09:00"),
      ML("무기", "환호지선", "2027-05-14T23:00+09:00"),
    ],
  };
  const plusMiss = () => checkSpec(raw, now).misses.filter((m) => m.cat === "마스터라벨 플러스");
  const growth = { other_stat_type: "[마스터라벨 플러스] 성장 플러스", stat_info: [{ stat_name: "추가 경험치 획득", stat_value: "100" }] };
  const combat = { other_stat_type: "[마스터라벨 플러스] 전투 플러스", stat_info: [{ stat_name: "공격력", stat_value: "60" }] };
  raw.otherStat = { other_stat: [growth] };
  assert.deepEqual(plusMiss(), [
    {
      cat: "마스터라벨 플러스",
      tier: "long",
      what: "전투 플러스 꺼짐",
      detail: ["마라벨 5개 능력치 179일 남음 · 성장 플러스만 켜짐", "켜면 공격력 · 마력 +60 · 올스탯 +140 (4만 캐시 · 90일)"],
    },
  ]);
  raw.otherStat = { other_stat: [] };
  assert.equal(plusMiss()[0].detail[0], "마라벨 5개 능력치 179일 남음");
  raw.otherStat = { other_stat: [growth, combat] };
  assert.deepEqual(plusMiss(), []);
  // No master label worn (the world set not used): nothing to warn.
  raw.otherStat = { other_stat: [] };
  raw.cash.world_share_master_label_activate_flag = "0";
  assert.deepEqual(plusMiss(), []);
  // other-stat did not come back: skipped.
  raw.cash.world_share_master_label_activate_flag = "1";
  raw.otherStat = undefined;
  assert.deepEqual(plusMiss(), []);
});

test("class skills that only come with the liberated secondary weapon are not asked for (user, 2026-11-17)", () => {
  // 아스트라 인퓨전 is learned by wearing the liberated secondary (24 ranked demons: all 22 with it have the skill,
  // the 2 without do not), so it is not something to "fill in for almost nothing".
  for (const [cls, rule] of Object.entries(SPEC_DATA.classes)) {
    assert.ok(!rule.skills0.some((s) => s.name === "아스트라 인퓨전"), cls);
  }
});

test("common skills say how to fill them: 여제의 축복 changes at 24, 연합의 의지 is a quest (user, 2026-11-17)", () => {
  const hintAt = (lv: number) => {
    const raw = base();
    raw.skill0.character_skill!.find((s) => s.skill_name === "여제의 축복")!.skill_level = lv;
    return checkSpec(raw, new Date("2026-11-09T00:00:00+09:00")).misses.find((m) => m.what.startsWith("여제의 축복"))?.detail;
  };
  assert.deepEqual(hintAt(23), ["시그너스 · 미하일 캐릭터 육성"]);
  // from 24 on, raising characters no longer helps: only 고귀한 정신 lifts the cap
  assert.deepEqual(hintAt(24), ["고귀한 정신 퀘스트 미완료"]);
  assert.deepEqual(hintAt(29), ["고귀한 정신 퀘스트 미완료"]);
  assert.equal(hintAt(30), undefined);

  const raw = base();
  raw.skill0.character_skill = raw.skill0.character_skill!.filter((s) => s.skill_name !== "연합의 의지");
  const will = checkSpec(raw, new Date("2026-11-09T00:00:00+09:00")).misses.find((m) => m.what === "연합의 의지 안 배움");
  assert.deepEqual(will?.detail, ["[연합] 퀘스트 미완료"]);
});

test("5th job: hunting-only common cores are not asked for (user, 2026-11-17)", () => {
  const raw = base();
  const cores = raw.vmatrix.character_v_core_equipment!;
  cores.push({ v_core_name: "에르다 샤워", v_core_type: "공용 코어", v_core_level: 0 });
  cores.push({ v_core_name: "쓸만한 홀리 심볼", v_core_type: "공용 코어", v_core_level: 10 });
  assert.equal(checkSpec(raw).misses.find((m) => m.cat === "5차 공용 코어"), undefined);
  // a boss-side one at the same level is still asked for
  cores.push({ v_core_name: "쓸만한 샤프 아이즈", v_core_type: "공용 코어", v_core_level: 10 });
  const miss = checkSpec(raw).misses.find((m) => m.cat === "5차 공용 코어");
  assert.equal(miss?.what, "30레벨 미만 1개");
  assert.deepEqual(miss?.detail, ["쓸만한 샤프 아이즈 10"]);
});

// ---------- order · pictures · the two checks added with the C layout (user, 2026-11-17) ----------
const AT = new Date("2026-11-09T00:00:00+09:00");

test("order: what runs out, then a few clicks, then quests, then what takes time or meso", () => {
  const raw = base();
  raw.propensity.charisma_level = 80; // long (checked early)
  raw.skill0.character_skill = raw.skill0.character_skill!.filter((s) => s.skill_name !== "연합의 의지"); // quest
  raw.hyper.hyper_stat_preset_1_remain_point = 12; // now (checked late)
  raw.equipment.title = { title_name: "보스 칭호", title_description: "보스 몬스터 데미지 +10%", date_expire: "2026-11-11T00:00+09:00" }; // urgent
  const r = checkSpec(raw, AT);
  assert.deepEqual(
    r.misses.map((m) => [m.tier, m.cat]),
    [
      ["urgent", "칭호"],
      ["now", "하이퍼 스탯"],
      ["quest", "공용 스킬"],
      ["long", "성향"],
    ],
  );
});

test("여제의 축복 is a quest from 24 and raising characters below it; 정령의 축복 is raising characters", () => {
  const tierAt = (name: string, lv: number) => {
    const raw = base();
    raw.skill0.character_skill!.find((s) => s.skill_name === name)!.skill_level = lv;
    return checkSpec(raw, AT).misses.find((m) => m.what.startsWith(name))?.tier;
  };
  assert.equal(tierAt("여제의 축복", 23), "long");
  assert.equal(tierAt("여제의 축복", 24), "quest");
  assert.equal(tierAt("정령의 축복", 19), "long");
});

test("gear with upgrade slots left on the boss preset is listed with how many (new)", () => {
  const raw = base();
  // preset 1 is the boss one (the ring); preset 2 is the hunting one and is not looked at
  (raw.equipment.item_equipment_preset_1 as Record<string, unknown>[]).push(
    { item_name: "페어리 하트", scroll_upgradeable_count: "10", item_icon: "https://open.api.nexon.com/static/maplestory/item/icon/HEART" },
    { item_name: "다 쓴 모자", scroll_upgradeable_count: "0" },
  );
  (raw.equipment.item_equipment_preset_2 as Record<string, unknown>[]).push({ item_name: "사냥 벨트", scroll_upgradeable_count: "3" });
  const miss = checkSpec(raw, AT).misses.find((m) => m.cat === "주문서 강화");
  assert.equal(miss?.what, "횟수 남은 장비 1개 (1번 프리셋)");
  assert.equal(miss?.tier, "long");
  assert.deepEqual(miss?.detail, ["페어리 하트 10회"]);
  assert.deepEqual(miss?.tiles, [{ name: "페어리 하트", sub: "10회 남음", icon: "https://open.api.nexon.com/static/maplestory/item/icon/HEART" }]);
  // nothing left anywhere → no line
  assert.equal(checkSpec(base(), AT).misses.find((m) => m.cat === "주문서 강화"), undefined);
});

test("a pet wearing no pet gear is listed; geared, shared-and-geared and expired pets are not (new)", () => {
  const raw = base();
  Object.assign(raw.pet, {
    pet_1_name: "글로리",
    pet_1_icon: "https://open.api.nexon.com/static/maplestory/item/icon/PET",
    pet_1_equipment: { item_name: null },
    pet_2_name: "쁘띠 데스",
    pet_2_equipment: { item_name: "펫 장비" },
    // the same pet as the shared one of the world, where it does wear gear
    pet_3_name: "벨라",
    pet_3_equipment: null,
    world_share_pet_1_name: "벨라",
    world_share_pet_1_equipment: { item_name: "펫 장비" },
    // over: cannot wear anything
    world_share_pet_2_name: "쁘띠 플로라",
    world_share_pet_2_date_expire: "2026-11-01T00:00+09:00",
    world_share_pet_2_equipment: null,
  });
  const miss = checkSpec(raw, AT).misses.find((m) => m.cat === "펫 장비");
  assert.equal(miss?.what, "장비 없는 펫 1마리");
  assert.equal(miss?.tier, "long");
  assert.deepEqual(miss?.tiles, [{ name: "글로리", sub: "장비 없음", icon: "https://open.api.nexon.com/static/maplestory/item/icon/PET" }]);
  // no pets in the response → no line
  assert.equal(checkSpec(base(), AT).misses.find((m) => m.cat === "펫 장비"), undefined);
});

test("pet buffs: 쓸만한 홀리 심볼 is asked of every class but 비숍 (user, 2026-11-17)", () => {
  for (const cls of Object.keys(SPEC_DATA.classes)) {
    const raw = base();
    raw.basic.character_class = cls;
    raw.pet = {};
    const miss = checkSpec(raw, AT).misses.find((m) => m.cat === "펫 버프");
    const asked = (miss?.tiles ?? []).some((t) => t.name === "쓸만한 홀리 심볼");
    assert.equal(asked, cls !== "비숍", cls);
  }
});

test("pictures: every 5th job common core, link, pet buff and class skill we may list has one in the table", () => {
  // A character with nothing: all the lists come out, and none of their tiles is left without a picture.
  for (const cls of Object.keys(SPEC_DATA.classes)) {
    const raw = base();
    raw.basic.character_class = cls;
    raw.pet = {};
    raw.link = {};
    raw.skill0.character_skill = [];
    for (const c of raw.vmatrix.character_v_core_equipment!) c.v_core_level = 1;
    const r = checkSpec(raw, AT);
    for (const m of r.misses) {
      if (["펫 버프", "링크 스킬", "5차 공용 코어"].includes(m.cat)) for (const t of m.tiles ?? []) assert.ok(t.icon, `${cls} · ${m.cat} · ${t.name}`);
      if (["공용 스킬", "직업 0차 스킬"].includes(m.cat)) assert.ok(m.icon, `${cls} · ${m.what}`);
    }
  }
  // addresses stay on the official host
  const raw = base();
  raw.skill0.character_skill!.find((s) => s.skill_name === "여제의 축복")!.skill_level = 24;
  Object.assign(raw.skill0.character_skill!.find((s) => s.skill_name === "여제의 축복")!, { skill_icon: "https://example.com/x.png" });
  const icon = checkSpec(raw, AT).misses.find((m) => m.what.startsWith("여제의 축복"))?.icon;
  assert.ok(icon?.startsWith("https://open.api.nexon.com/static/maplestory/skill/icon/"));
});

test("fewer than three pets: the empty places are listed, and missing pet buffs are no longer 'a few clicks' (user, 2026-11-17)", () => {
  const nl = SPEC_DATA.classes["나이트로드"];
  // one pet (listed as the shared one of the world too), both of its buff places used
  const raw = base();
  raw.pet = {
    pet_1_name: "글로리",
    pet_1_auto_skill: { skill_1: nl.petBuff[0], skill_2: nl.petBuff[1] },
    world_share_pet_1_name: "글로리",
    world_share_pet_1_auto_skill: { skill_1: nl.petBuff[0], skill_2: nl.petBuff[1] },
  };
  const r = checkSpec(raw, AT);
  const slots = r.misses.find((m) => m.cat === "펫");
  assert.equal(slots?.what, "2자리 비어 있음");
  assert.equal(slots?.tier, "long");
  assert.deepEqual(slots?.detail, ["지금 1마리 · 3마리까지 · 한 마리에 펫 버프 2개"]);
  const buffs = r.misses.find((m) => m.cat === "펫 버프");
  assert.ok(buffs?.what.endsWith("빠짐 · 넣을 자리 없음"), buffs?.what);
  assert.equal(buffs?.tier, "long");

  // the same pet with one buff place still free → adding a buff is a few clicks
  (raw.pet.pet_1_auto_skill as { skill_2: string | null }).skill_2 = null;
  (raw.pet.world_share_pet_1_auto_skill as { skill_2: string | null }).skill_2 = null;
  const free = checkSpec(raw, AT).misses.find((m) => m.cat === "펫 버프");
  assert.equal(free?.tier, "now");
  assert.ok(!free?.what.includes("넣을 자리 없음"));

  // three pets → no line about places; no pet names at all (older saved shapes) → nothing is guessed
  Object.assign(raw.pet, { pet_2_name: "쁘띠 데스", pet_3_name: "벨라" });
  assert.equal(checkSpec(raw, AT).misses.find((m) => m.cat === "펫"), undefined);
  assert.equal(checkSpec(base(), AT).misses.find((m) => m.cat === "펫"), undefined);
});

test("5th job boost cores at level 0 come as tiles with the picture of the first skill they boost", () => {
  const raw = base();
  raw.vmatrix.character_v_core_equipment!.push(
    { v_core_name: "쿼드러플 스로우/다크 플레어 강화", v_core_type: "강화 코어", v_core_level: 0 },
    { v_core_name: "이름 없는 스킬 강화", v_core_type: "강화 코어", v_core_level: 0 },
    { v_core_name: "써든레이드 강화", v_core_type: "강화 코어", v_core_level: 25 },
  );
  const miss = checkSpec(raw, AT).misses.find((m) => m.cat === "5차 강화 코어");
  assert.equal(miss?.what, "0레벨 2개");
  assert.deepEqual(
    miss?.tiles?.map((t) => [t.name, t.sub]),
    [
      ["쿼드러플 스로우/다크 플레어 강화", "0레벨"],
      ["이름 없는 스킬 강화", "0레벨"],
    ],
  );
  // two skills the table knows → both pictures, to be drawn split along the diagonal like the core in the game
  const [both, none] = miss!.tiles!;
  assert.ok(both.icon && both.icon2 && both.icon !== both.icon2);
  // a skill the table does not know simply has no picture (the page draws a plain icon)
  assert.equal(none.icon, null);
  assert.equal(none.icon2, null);
});

test("hyper passive line opens on the five most taken, marking what the character has", () => {
  const nl = SPEC_DATA.classes["나이트로드"];
  assert.equal(nl.hyperPassiveTop.length, 5);
  // every class's standard picks are among its five most taken (the line shows them all)
  for (const [job, c] of Object.entries(SPEC_DATA.classes))
    assert.ok(c.hyperPassive.every((n) => c.hyperPassiveTop.includes(n)), job);
  const raw = base();
  raw.hyperPassive.character_skill![0].skill_level = 0;
  const hp = checkSpec(raw, new Date("2026-11-09T00:00:00+09:00")).misses.find((m) => m.cat === "하이퍼 패시브")!;
  assert.equal(hp.what, "대부분 찍는 것 1개 안 찍음");
  assert.deepEqual(hp.tiles!.map((t) => t.name), nl.hyperPassiveTop);
  const missed = nl.hyperPassive[0];
  for (const t of hp.tiles!) {
    const has = t.name !== missed && nl.hyperPassive.includes(t.name);
    assert.equal(!!t.done, has, t.name);
    assert.equal(t.sub, has ? "찍음" : "안 찍음");
  }
});

test("artifact AP: only what can still go into a crystal counts", () => {
  // the real characters of 2026-11-18 (crystal levels · left AP → spendable)
  assert.equal(artifactSpendable(5, [5, 5, 5, 5, 5, 5, 5, 5]), 0); // Lv.58: all eight at Lv.5, the ninth opens at Lv.60
  assert.equal(artifactSpendable(8, [5, 5, 5, 4, 5, 5, 3]), 8);
  assert.equal(artifactSpendable(1, [5, 5, 5, 5, 5, 5, 1]), 1);
  assert.equal(artifactSpendable(5, [5, 5, 5, 5, 5, 4, 4]), 3); // Lv.4 → 5 is 3 AP: one of the two, 2 left over
  // a step costs 1 · 2 · 2 · 3: one point cannot take a Lv.2 crystal to Lv.3
  assert.equal(artifactSpendable(1, [5, 2]), 0);
  assert.equal(artifactSpendable(4, [5, 4]), 3);

  const ap = (remain: number, levels?: number[]) => {
    const raw = base();
    raw.artifact.union_artifact_remain_ap = remain;
    if (levels) raw.artifact.union_artifact_crystal = levels.map((level, i) => ({ name: `크리스탈 ${i}`, level }));
    return checkSpec(raw, new Date("2026-11-09T00:00:00+09:00")).misses.filter((m) => /^AP /.test(m.what)).map((m) => m.what);
  };
  assert.deepEqual(ap(5, [5, 5, 5, 5, 5, 5, 5, 5]), []);
  assert.deepEqual(ap(5, [5, 5, 5, 5, 5, 5, 5, 4]), ["AP 5 남음 · 3 쓸 수 있음"]);
  assert.deepEqual(ap(8, [5, 5, 5, 4, 5, 5, 3]), ["AP 8 남음"]);
  assert.deepEqual(ap(5), ["AP 5 남음"]); // no crystal list: as before
});

test("master labels: a worn set with places whose stats ran out is called out, nobody wearing one is not (user, 2026-11-18)", () => {
  const now = new Date("2026-11-18T12:00:00+09:00");
  const gone = (slot: string, name: string) => ({ ...ML(slot, name, "x", []), date_option_expire: null });
  const line = (raw: SpecRaw) => checkSpec(raw, now).misses.find((m) => m.cat === "마스터라벨");
  // nobody wearing one
  assert.equal(line(base()), undefined);
  // 언현 (2026-11-18): the whole set worn, every stat run out
  const all = base();
  all.cash = { cash_item_equipment_base: ["모자", "상의", "신발", "망토", "무기"].map((s) => gone(s, `${s} 마라벨`)) } as SpecRaw["cash"];
  const a = line(all)!;
  assert.equal(a.what, "능력치 있는 마라벨 0 / 5부위");
  assert.equal(a.detail[0], "능력치 없음: 모자 모자 마라벨 · 상의 상의 마라벨 · 신발 신발 마라벨 · 망토 망토 마라벨 · 무기 무기 마라벨");
  assert.equal(a.detail.length, 1);
  // 데몬10세기: one weapon, run out → the four places without one are named too
  const one = base();
  one.cash = { cash_item_equipment_base: [gone("무기", "피의 서약")] } as SpecRaw["cash"];
  assert.deepEqual(line(one)!.detail, ["능력치 없음: 무기 피의 서약", "마라벨 안 낀 부위: 모자 · 상의 · 신발 · 망토"]);
  // some left: those show their days (gray), the rest "능력치 없음"
  const some = base();
  some.cash = {
    cash_item_equipment_base: [ML("모자", "A", "2027-01-01T00:00+09:00"), ML("상의", "B", "2026-11-23T12:00+09:00"), gone("신발", "C"), gone("망토", "D"), gone("무기", "E")],
  } as SpecRaw["cash"];
  const s = line(some)!;
  assert.equal(s.what, "능력치 있는 마라벨 2 / 5부위");
  assert.deepEqual(s.tiles!.map((t) => [t.name, t.sub, !!t.done]), [["A", "44일 남음", true], ["B", "5일 남음", true], ["C", "능력치 없음", false], ["D", "능력치 없음", false], ["E", "능력치 없음", false]]);
  // 흑소 · 귀심: the world's shared set, all five with stats → nothing here
  const shared = base();
  shared.cash = { world_share_master_label_activate_flag: "1", world_share_master_label_base: ["모자", "상의", "신발", "망토", "무기"].map((p) => ML(p, p, "2027-05-01T00:00+09:00")) } as SpecRaw["cash"];
  assert.equal(line(shared), undefined);
  assert.equal(labelPieces(shared, now).length, 5);
  // the shared set when it is off does not count (귤민 wears its own)
  shared.cash!.world_share_master_label_activate_flag = "0";
  assert.equal(labelPieces(shared, now).length, 0);
});

test("master labels: stats past their date count as none; a partial set keeps the places without one (review, 2026-11-18)", () => {
  const now = new Date("2026-11-18T12:00:00+09:00");
  const line = (raw: SpecRaw) => checkSpec(raw, now).misses.find((m) => m.cat === "마스터라벨");
  // options still there but the date passed (or "expired") → no stats
  const past = base();
  past.cash = {
    cash_item_equipment_base: [ML("모자", "A", "2026-11-17T00:00+09:00"), ML("상의", "B", "expired"), ML("신발", "C", "2027-01-01T00:00+09:00")],
  } as SpecRaw["cash"];
  const p = line(past)!;
  assert.equal(p.what, "능력치 있는 마라벨 1 / 5부위");
  assert.deepEqual(p.tiles!.map((t) => [t.name, t.sub]), [["A", "능력치 없음"], ["B", "능력치 없음"], ["C", "44일 남음"]]);
  // three worn, all with stats: the first line names them (the tiles' line), the second the two places left
  const three = base();
  three.cash = { cash_item_equipment_base: ["모자", "상의", "신발"].map((s) => ML(s, s, "2027-01-01T00:00+09:00")) } as SpecRaw["cash"];
  assert.deepEqual(line(three)!.detail, ["낀 마라벨: 모자 모자 · 상의 상의 · 신발 신발", "마라벨 안 낀 부위: 망토 · 무기"]);
});
