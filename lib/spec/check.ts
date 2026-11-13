// 숨은 스펙업 (spec §4-11): find free / cheap spec a character is missing, judged on its boss preset.
// Pure function over NEXON Open API responses (lib/spec/load.ts fetches them) + lib/spec/data/classes.json.
// Wording on screen: short noun phrases + arrows, no "~해요" (user, 2026-11-09).
import classesJson from "./data/classes.json" with { type: "json" };
import { koreanMeso, symbolGaps, type SymbolIn } from "./symbol.ts";

// ---------- API response shapes (only the fields we read) ----------
type Skill = { skill_name: string; skill_level: number };
type Item = {
  item_equipment_slot?: string;
  item_name?: string;
  potential_option_1?: string | null;
  potential_option_2?: string | null;
  potential_option_3?: string | null;
  additional_potential_option_1?: string | null;
  additional_potential_option_2?: string | null;
  additional_potential_option_3?: string | null;
};
type Title = { title_name?: string | null; title_description?: string | null; date_expire?: string | null; date_option_expire?: string | null } | null;
type HyperStat = { stat_type: string; stat_level: number };
type AbilityLine = { ability_grade: string; ability_value: string };
type AutoSkill = { skill_1?: string | null; skill_2?: string | null } | null;

export type SpecRaw = {
  basic: { character_name: string; world_name: string; character_class: string; character_level: number; character_image?: string };
  skill0: { character_skill?: (Skill & { skill_description?: string })[] };
  hyperPassive: { character_skill?: Skill[] };
  vmatrix: {
    character_v_core_equipment?: { v_core_name: string; v_core_type: string; v_core_level: number }[];
    character_v_matrix_remain_slot_upgrade_point?: number;
  };
  propensity: { charisma_level?: number; sensibility_level?: number; insight_level?: number; willingness_level?: number };
  artifact: { union_artifact_effect?: { name: string; level: number }[]; union_artifact_remain_ap?: number };
  equipment: Record<string, unknown> & { preset_no?: number; title?: Title; title_preset1?: Title; title_preset2?: Title; title_preset3?: Title };
  hyper: Record<string, unknown> & { use_preset_no?: string | number };
  link: Record<string, unknown>;
  ability: Record<string, unknown> & { preset_no?: number };
  pet: Record<string, unknown>;
  symbol: { symbol?: SymbolIn[] };
};

// ---------- data file ----------
type ClassRule = {
  atkBuff: string[];
  skills0: { name: string; max: number; effect?: string }[];
  ability: { full: string[]; practical: string; collector?: boolean };
  artifactCooldown: boolean;
  hyperPassive: string[];
  petBuff: string[];
  link: string[];
};
type Data = {
  updated: string;
  common: {
    skills0: { name: string; max: number }[];
    propensity: Record<string, number>;
    propensityHpClass: Record<string, number>;
    vCoreMin: number;
    bossSpecialCores: string[];
  };
  classes: Record<string, ClassRule>;
};
export const SPEC_DATA = classesJson as unknown as Data;

// Boss-relevant 5th job common cores (Claude's pick, 2026-11-09): the damage / bind / survival ones.
// Movement and party-buff cores (로프 커넥트, 쓸만한 …) are left out.
const BOSS_COMMON_CORES = ["스파이더 인 미러", "크레스트 오브 더 솔라", "에르다 노바", "에르다의 의지"];
// 바디 오브 스틸 is a warrior-only core: other classes cannot have it (청운적운 · 귤민 have none, 푸소 does; user, 2026-11-11).
const WARRIOR_CORE = "바디 오브 스틸";
const WARRIOR_CLASSES = new Set(["히어로", "팔라딘", "다크나이트", "소울마스터", "미하일", "블래스터", "데몬슬레이어", "데몬어벤져", "아란", "카이저", "아델", "제로", "렌"]);
const HP_CLASS = "데몬어벤져";
const TITLE_WARN_DAYS = 14;

// ---------- result ----------
/** detail = lines under the subtitle (" · " separated items never break inside); rows = aligned table (symbols). */
export type Miss = { cat: string; what: string; detail: string[]; rows?: string[][] };
export type SpecResult = {
  name: string;
  world: string;
  cls: string;
  level: number;
  image: string | null;
  presets: { eq: number | null; hyper: number | null; link: number | null; ability: number | null };
  misses: Miss[];
  /** Suggestions that cost something or are optional — shown, but not counted as "놓친 스펙". */
  tips: Miss[];
  /** False when the class is not in the data file (new class): class rules were skipped. */
  known: boolean;
};

// ---------- helpers ----------
const preset = <T>(obj: Record<string, unknown>, prefix: string, i: number) => obj[`${prefix}${i}`] as T | undefined;
const list = (names: string[]) => names.join(" · ");

/** Ability line → letter used in the data file (패 보 상 공 재 크 피 벞), or null for anything else. */
export function abilityLetter(value: string): string | null {
  const v = value.trim();
  if (/패시브 스킬 레벨/.test(v)) return "패";
  if (/^보스 몬스터 공격 시 데미지/.test(v)) return "보";
  if (/^상태 이상에 걸린 대상/.test(v)) return "상";
  if (/재사용 대기시간이 미적용/.test(v)) return "재";
  if (/^크리티컬 확률/.test(v)) return "크";
  if (/^버프 스킬의? ?지속 시간/.test(v)) return "벞";
  if (/^최대 HP \d+% 증가/.test(v)) return "피";
  if (/^(공격력|마력) \d+ 증가/.test(v)) return "공";
  return null;
}
/** 공 = 마 = 버프 지속 (user table note), order does not matter. */
const comboKey = (letters: string[]) => letters.map((c) => (c === "벞" ? "공" : c)).sort().join("");
const LETTER_LABEL: Record<string, string> = { 패: "패시브", 보: "보공", 상: "상추뎀", 공: "공/마", 재: "재사용", 크: "크확", 피: "HP%", 벞: "벞지" };
const comboLabel = (combo: string) => [...combo].map((c) => LETTER_LABEL[c] ?? c).join(" · ");

/** Is this ability (3 lines) complete for the class? full = all legendary, practical = any grades. */
export function abilityComplete(lines: AbilityLine[], rule: ClassRule["ability"]): boolean {
  if (lines.length < 3) return false;
  const letters = lines.map((l) => abilityLetter(l.ability_value));
  if (letters.some((l) => l === null)) return false;
  const key = comboKey(letters as string[]);
  const allLegendary = lines.every((l) => l.ability_grade === "레전드리");
  if (allLegendary && rule.full.some((c) => comboKey([...c]) === key)) return true;
  const uniqueUp = (g: string) => g === "레전드리" || g === "유니크";
  return comboKey([...rule.practical]) === key && lines[0].ability_grade === "레전드리" && uniqueUp(lines[1].ability_grade) && uniqueUp(lines[2].ability_grade);
}

function abilityScore(lines: AbilityLine[], rule: ClassRule["ability"] | undefined): [number, number] {
  const letters = lines.map((l) => abilityLetter(l.ability_value)).filter((x): x is string => !!x);
  const have = comboKey(letters);
  let best = 0;
  for (const c of [...(rule?.full ?? []), rule?.practical ?? "보"]) {
    const want = [...comboKey([...c])];
    const pool = [...have];
    let hit = 0;
    for (const w of want) {
      const i = pool.indexOf(w);
      if (i >= 0) {
        hit++;
        pool.splice(i, 1);
      }
    }
    best = Math.max(best, hit);
  }
  const boss = lines.reduce((s, l) => s + (/^보스 몬스터/.test(l.ability_value) ? Number(l.ability_value.match(/(\d+)%/)?.[1] ?? 0) : 0), 0);
  return [best, boss];
}

/** Highest score wins; ties keep the lower preset number. */
function pickBest(scores: { i: number; s: number[] }[]): number | null {
  if (!scores.length) return null;
  return scores.reduce((a, b) => {
    for (let k = 0; k < a.s.length; k++) {
      if (b.s[k] > a.s[k]) return b;
      if (b.s[k] < a.s[k]) return a;
    }
    return a;
  }).i;
}

// ---------- boss preset (rules: spec §4-11 "대조 결과") ----------
export function bossPresets(raw: SpecRaw, rule: ClassRule | undefined) {
  const eqScores = [1, 2, 3].flatMap((i) => {
    const items = preset<Item[]>(raw.equipment, "item_equipment_preset_", i) ?? [];
    if (!items.length) return [];
    const text = items
      .flatMap((it) => [it.potential_option_1, it.potential_option_2, it.potential_option_3, it.additional_potential_option_1, it.additional_potential_option_2, it.additional_potential_option_3])
      .join("\n");
    const hunt = text.match(/아이템 드롭률|메소 획득량/g)?.length ?? 0;
    const bossRing = items.some((it) => /리스트레인트 링|컨티뉴어스 링/.test(it.item_name ?? "")) ? 1 : 0;
    return [{ i, s: [-hunt, bossRing] }];
  });
  const hyperScores = [1, 2, 3].map((i) => {
    const stats = preset<HyperStat[]>(raw.hyper, "hyper_stat_preset_", i) ?? [];
    const lv = (t: string) => stats.find((s) => s.stat_type === t)?.stat_level ?? 0;
    return { i, s: [lv("보스 몬스터 공격 시 데미지 증가") + lv("방어율 무시") + lv("데미지")] };
  });
  const std = new Set(rule?.link ?? []);
  const linkScores = [1, 2, 3].flatMap((i) => {
    const skills = preset<Skill[]>(raw.link, "character_link_skill_preset_", i) ?? [];
    return skills.length ? [{ i, s: [skills.filter((s) => std.has(s.skill_name)).length, skills.length] }] : [];
  });
  const abilityScores = [1, 2, 3].flatMap((i) => {
    const lines = preset<{ ability_info?: AbilityLine[] }>(raw.ability, "ability_preset_", i)?.ability_info ?? [];
    return lines.length ? [{ i, s: abilityScore(lines, rule?.ability) }] : [];
  });
  return { eq: pickBest(eqScores), hyper: pickBest(hyperScores), link: pickBest(linkScores), ability: pickBest(abilityScores) };
}

// ---------- the check ----------
// Wording (user, 2026-11-09): title = category, subtitle = what is missing, detail lines only when they add something
// (no obvious "how": core shards, spend points, ...).
/** `eventSkills` = the running event's skill ("보약"), by name: see event-skill.ts. */
export function checkSpec(raw: SpecRaw, now: Date = new Date(), data: Data = SPEC_DATA, eventSkills: readonly string[] = []): SpecResult {
  const cls = raw.basic.character_class;
  const rule = data.classes[cls];
  const misses: Miss[] = [];
  const tips: Miss[] = [];
  const presets = bossPresets(raw, rule);
  const add = (cat: string, what: string, ...detail: (string | false | undefined)[]) =>
    misses.push({ cat, what, detail: detail.filter((d): d is string => !!d) });

  // 0th-job skills
  const skills = raw.skill0.character_skill ?? [];
  const skillLv = (name: string) => skills.find((s) => s.skill_name === name)?.skill_level;
  const COMMON_HINT: Record<string, string> = { "여제의 축복": "시그너스 기사단 캐릭터 육성", "정령의 축복": "같은 월드 다른 캐릭터 육성" };
  for (const s of data.common.skills0) {
    const lv = skillLv(s.name);
    if (lv === undefined) add("공용 스킬", `${s.name} 안 배움`);
    else if (lv < s.max) add("공용 스킬", `${s.name} ${lv} / ${s.max}`, COMMON_HINT[s.name]);
  }
  // 보약: only whether it was taken (the API does not say how its points were spent).
  for (const name of eventSkills) if (!skillLv(name)) add("보약", `${name} 안 배움`);
  if (rule) {
    if (rule.atkBuff.length && !rule.atkBuff.some((n) => skillLv(n) !== undefined))
      add("공용 스킬", `${rule.atkBuff.join(" / ")} 안 배움`, "공격력 · 마력 4%");
    for (const s of rule.skills0) {
      const lv = skillLv(s.name);
      if (lv === undefined) add("직업 0차 스킬", `${s.name} 안 배움`, s.effect);
      else if (lv < s.max) add("직업 0차 스킬", `${s.name} ${lv} / ${s.max}`, s.effect);
    }
  }
  if (skillLv("고급 무기 제련") === undefined) tips.push({ cat: "고급 무기 제련", what: "안 배움", detail: ["전문기술 → 장비제작 명장"] });

  // propensity
  const p = raw.propensity;
  const prop: [string, number | undefined, string][] = [
    ["통찰력", p.insight_level, "속성 내성 무시 5%"],
    ["감성", p.sensibility_level, "버프 지속 10%"],
    ["카리스마", p.charisma_level, "방어율 무시 10%"],
  ];
  if (cls === HP_CLASS) prop.push(["의지", p.willingness_level, "최대 HP"]);
  for (const [name, lv, effect] of prop) {
    if ((lv ?? 0) < 100) add("성향", `${name} ${lv ?? 0} / 100`, `100레벨 → ${effect}`);
  }

  // union artifact
  const kinds: Record<string, RegExp> = {
    boss: /^보스 몬스터 공격 시 데미지/,
    dmg: /^데미지 [\d.]+% 증가/,
    cd: /^크리티컬 데미지/,
    ied: /방어율 무시/,
    atk: /^공격력 \d+, 마력/,
    stat: /^올스탯/,
    hp: /^최대 HP/,
    cool: /^재사용 대기시간 미적용/,
    buff: /^버프 지속시간/,
    crit: /^크리티컬 확률/,
  };
  const KIND_LABEL: Record<string, string> = {
    boss: "보스 데미지", dmg: "데미지", cd: "크리티컬 데미지", ied: "방어율 무시", atk: "공격력/마력", stat: "올스탯", hp: "최대 HP", cool: "재사용", buff: "버프 지속", crit: "크리티컬 확률",
  };
  // Target order (spec §4-11 table): boss ≈ dmg ≈ cd ≈ stat > ied > atk > buff.
  // Crit rate counts too (user, 2026-11-09: "유효 확률").
  const targets = ["boss", "dmg", "cd", cls === HP_CLASS ? "hp" : "stat", ...(rule?.artifactCooldown ? ["cool"] : []), "ied", "atk", "buff", "crit"];
  const effects = raw.artifact.union_artifact_effect ?? [];
  const kindOf = (name: string) => Object.keys(kinds).find((k) => kinds[k].test(name)) ?? null;
  // "메소 획득량 12% 증가" → "메소 획득량", "재사용 대기시간 미적용 확률 6.75% 증가" → "재사용 대기시간 미적용".
  const effectName = (name: string) =>
    /^최대 HP/.test(name) ? "최대 HP/MP" : /^재사용 대기시간 미적용/.test(name) ? "재사용 대기시간 미적용" : name.split(/\s*\d/)[0].trim();
  // A Lv.60 artifact has 14 effects, so non-boss effects are unavoidable once every boss effect is Lv.10.
  // Warn only when a boss effect is below Lv.10 while points sit in a non-boss effect (could be moved).
  const wasted = effects.filter((e) => e.level > 0 && !targets.includes(kindOf(e.name) ?? ""));
  const levelOf = (k: string) => Math.max(0, ...effects.filter((e) => kindOf(e.name) === k).map((e) => e.level));
  const short = targets.filter((k) => levelOf(k) < 10);
  if (wasted.length && short.length) {
    add(
      "유니온 아티팩트",
      `보스용 효과 ${short.length}개 Lv.10 미만`,
      `부족: ${short.map((k) => `${KIND_LABEL[k]} Lv.${levelOf(k)}`).join(" · ")}`,
      `보스에 안 쓰는 효과: ${wasted.map((e) => `${effectName(e.name)} Lv.${e.level}`).join(" · ")}`,
    );
  }
  if ((raw.artifact.union_artifact_remain_ap ?? 0) > 0) add("유니온 아티팩트", `AP ${raw.artifact.union_artifact_remain_ap} 남음`);

  // Title: title_preset1~3 do not follow equipment presets (2026-11-09: 흑소 · 광선 · 청운적운 · 데몬10세기 keep it in
  // title_preset1 whatever equipment preset they use), so the boss title may sit in any of them while a hunting title
  // (e.g. 쑥쑥 새싹) is on right now. A boss title in any title preset counts; otherwise the one equipped now is reported.
  const titles = [raw.equipment.title, raw.equipment.title_preset1, raw.equipment.title_preset2, raw.equipment.title_preset3].filter(
    (t): t is NonNullable<Title> => !!t?.title_name,
  );
  // Days left before the title (or its option) runs out; Infinity = no expiry. The boss title that lasts longest wins,
  // so an expired copy in one preset does not hide a good one in another.
  const daysLeft = (t: NonNullable<Title>) =>
    Math.min(
      ...[t.date_expire, t.date_option_expire].map((at) =>
        !at ? Infinity : at === "expired" ? -1 : Math.ceil((new Date(at).getTime() - now.getTime()) / 86_400_000),
      ),
    );
  const bossTitles = titles.filter((t) => /보스 몬스터/.test(t.title_description ?? ""));
  const title = bossTitles.sort((a, b) => daysLeft(b) - daysLeft(a))[0] ?? titles[0] ?? null;
  if (!title?.title_name) {
    add("칭호", "미장착");
  } else {
    if (!/보스 몬스터/.test(title.title_description ?? "")) add("칭호", "보스 데미지 없음", title.title_name);
    for (const [label, at] of [["기간", title.date_expire], ["옵션", title.date_option_expire]] as const) {
      if (!at) continue;
      const days = at === "expired" ? -1 : Math.ceil((new Date(at).getTime() - now.getTime()) / 86_400_000);
      if (days <= TITLE_WARN_DAYS) add("칭호", days < 0 ? `${label} 만료` : `${label} 만료 ${days}일 남음`, title.title_name);
    }
  }

  // 5th job (V matrix)
  const cores = raw.vmatrix.character_v_core_equipment ?? [];
  const coreLv = (name: string) => cores.find((c) => c.v_core_name === name)?.v_core_level ?? 0;
  const commonCores = WARRIOR_CLASSES.has(cls) ? [...BOSS_COMMON_CORES.slice(0, 2), WARRIOR_CORE, ...BOSS_COMMON_CORES.slice(2)] : BOSS_COMMON_CORES;
  // Every 공용 코어 the character has is looked at (user, 2026-11-13: there are far more than the few named here —
  // the class-group ones, the 쓸만한 ones, 블링크 …). The named ones are asked for even when they are missing.
  const ownedCommon = cores.filter((c) => c.v_core_type === "공용 코어").map((c) => c.v_core_name);
  const lowCommon = [...new Set([...commonCores, ...ownedCommon])].filter((n) => coreLv(n) < data.common.vCoreMin);
  if (lowCommon.length) add("5차 공용 코어", `${data.common.vCoreMin}레벨 미만 ${lowCommon.length}개`, lowCommon.map((n) => `${n} ${coreLv(n)}`).join(" · "));
  const zeroBoost = cores.filter((c) => c.v_core_type === "강화 코어" && c.v_core_level === 0);
  if (zeroBoost.length) add("5차 강화 코어", `0레벨 ${zeroBoost.length}개`, zeroBoost.map((c) => c.v_core_name).join(" · "));
  const slotPt = raw.vmatrix.character_v_matrix_remain_slot_upgrade_point ?? 0;
  if (slotPt > 0) add("5차 슬롯 강화", `포인트 ${slotPt} 남음`);
  // Special cores: the equipped set may be the hunting one (흑소: 룬의 경험 now, 일격필살 in presets 2 · 3), so look at presets too.
  const specials = [
    ...cores,
    ...[1, 2, 3, 4, 5].flatMap((i) => preset<typeof cores>(raw.vmatrix as Record<string, unknown>, "character_v_core_equipment_preset_", i) ?? []),
  ]
    .filter((c) => c.v_core_type === "특수 코어")
    .map((c) => c.v_core_name);
  if (!specials.some((n) => data.common.bossSpecialCores.includes(n)))
    add("5차 특수 코어", "보스용 없음", `보스용: ${list(data.common.bossSpecialCores.map((n) => n.replace(/ I$/, "")))}`);

  // hyper stat (boss preset)
  if (presets.hyper) {
    const left = Number(raw.hyper[`hyper_stat_preset_${presets.hyper}_remain_point`] ?? 0);
    if (left > 0) add("하이퍼 스탯", `${left}포인트 남음 (${presets.hyper}번 프리셋)`);
  }

  if (rule) {
    const picked = new Set((raw.hyperPassive.character_skill ?? []).filter((s) => s.skill_level > 0).map((s) => s.skill_name));
    const hpMiss = rule.hyperPassive.filter((n) => !picked.has(n));
    if (hpMiss.length) add("하이퍼 패시브", `대부분 찍는 것 ${hpMiss.length}개 안 찍음`, list(hpMiss));

    // pet buffs (own pets + world shared pets)
    const auto = [1, 2, 3].flatMap((i) =>
      [`pet_${i}_auto_skill`, `world_share_pet_${i}_auto_skill`].flatMap((k) => {
        const a = raw.pet[k] as AutoSkill;
        return a ? [a.skill_1, a.skill_2] : [];
      }),
    );
    const petSet = new Set(auto.filter((x): x is string => !!x));
    const petMiss = rule.petBuff.filter((n) => !petSet.has(n));
    if (petMiss.length) add("펫 버프", `대부분 등록하는 것 ${petMiss.length}개 빠짐`, list(petMiss));

    // links (boss preset; the class's own link comes separately and is not in the standard list)
    // All three presets empty → nothing equipped: every standard link counts as missing.
    const have = new Set((presets.link ? preset<Skill[]>(raw.link, "character_link_skill_preset_", presets.link) ?? [] : []).map((s) => s.skill_name));
    const linkMiss = rule.link.filter((n) => !have.has(n));
    if (linkMiss.length)
      add("링크 스킬", presets.link ? `대부분 끼는 것 ${linkMiss.length}개 빠짐 (${presets.link}번 프리셋)` : "미장착", list(linkMiss));

    if (presets.ability) {
      const lines = preset<{ ability_info?: AbilityLine[] }>(raw.ability, "ability_preset_", presets.ability)?.ability_info ?? [];
      if (!abilityComplete(lines, rule.ability))
        add(
          "어빌리티",
          `미완성 (${presets.ability}번 프리셋)`,
          `종결: ${rule.ability.full.map(comboLabel).join(" 또는 ")} (레전드리 3줄)`,
          `실전: ${comboLabel(rule.ability.practical)} (레전드리 + 유니크 2줄)`,
        );
    }
  }

  // symbols: growth already collected but meso not paid (tip, not counted — it costs meso)
  const gaps = symbolGaps(raw.symbol.symbol ?? []);
  if (gaps.length) {
    const totalMeso = gaps.reduce((s, g) => s + (g.meso ?? 0), 0);
    const statSum = new Map<string, number>();
    for (const g of gaps) {
      for (const [k, v] of g.stats) statSum.set(k, (statSum.get(k) ?? 0) + v);
      statSum.set(g.forceName, (statSum.get(g.forceName) ?? 0) + g.force);
    }
    tips.push({
      cat: "심볼",
      what: `메소만 내면 올릴 수 있음 · ${koreanMeso(totalMeso)}`,
      detail: [`늘어나는 스탯: ${[...statSum].map(([k, v]) => `${k} +${v.toLocaleString("ko-KR")}`).join(" · ")}`],
      rows: gaps.map((g) => [
        g.region,
        `Lv.${g.level} → ${g.to}`,
        g.meso === null ? "-" : koreanMeso(g.meso),
        g.stats.map(([k, v]) => `${k} +${v.toLocaleString("ko-KR")}`).join(" · ") || "-",
      ]),
    });
  }

  return {
    name: raw.basic.character_name,
    world: raw.basic.world_name,
    cls,
    level: raw.basic.character_level,
    image: raw.basic.character_image ?? null,
    presets,
    misses,
    tips,
    known: !!rule,
  };
}
