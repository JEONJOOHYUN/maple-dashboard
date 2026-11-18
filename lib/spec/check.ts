// 숨은 스펙업 (spec §4-11): find free / cheap spec a character is missing, judged on its boss preset.
// Pure function over NEXON Open API responses (lib/spec/load.ts fetches them) + lib/spec/data/classes.json.
// Wording on screen: short noun phrases + arrows, no "~해요" (user, 2026-11-09).
import classesJson from "./data/classes.json" with { type: "json" };
import iconsJson from "./data/icons.json" with { type: "json" };
import { PERIOD_WARN_DAYS } from "./period-rows.ts";
import { koreanMeso, symbolGaps, type SymbolIn } from "./symbol.ts";

// ---------- API response shapes (only the fields we read) ----------
type Skill = { skill_name: string; skill_level: number; skill_icon?: string | null };
type Item = {
  item_equipment_slot?: string;
  item_name?: string;
  item_icon?: string | null;
  /** Upgrade slots not used yet (the API sends it as text). */
  scroll_upgradeable_count?: string | number | null;
  potential_option_1?: string | null;
  potential_option_2?: string | null;
  potential_option_3?: string | null;
  additional_potential_option_1?: string | null;
  additional_potential_option_2?: string | null;
  additional_potential_option_3?: string | null;
};
type Title = { title_name?: string | null; title_icon?: string | null; title_description?: string | null; date_expire?: string | null; date_option_expire?: string | null } | null;
type HyperStat = { stat_type: string; stat_level: number };
type AbilityLine = { ability_grade: string; ability_value: string };
type AutoSkill = { skill_1?: string | null; skill_2?: string | null } | null;
type CashItem = {
  cash_item_equipment_slot?: string;
  cash_item_name?: string;
  cash_item_label?: string | null;
  cash_item_icon?: string | null;
  cash_item_option?: { option_type: string; option_value: string }[];
  /** The item itself (기간제), null = permanent. */
  date_expire?: string | null;
  /** Its stats (마스터라벨 = 능력치 유효 기간 190 days). The API drops the stats once they run out. */
  date_option_expire?: string | null;
};
type OtherStat = { other_stat_type?: string; stat_info?: { stat_name: string; stat_value: string }[] };

export type SpecRaw = {
  basic: { character_name: string; world_name: string; character_class: string; character_level: number; character_image?: string };
  skill0: { character_skill?: (Skill & { skill_description?: string })[] };
  hyperPassive: { character_skill?: Skill[] };
  vmatrix: {
    character_v_core_equipment?: { v_core_name: string; v_core_type: string; v_core_level: number }[];
    character_v_matrix_remain_slot_upgrade_point?: number;
  };
  propensity: { charisma_level?: number; sensibility_level?: number; insight_level?: number; willingness_level?: number };
  artifact: {
    union_artifact_effect?: { name: string; level: number }[];
    union_artifact_crystal?: { name: string; level: number }[];
    union_artifact_remain_ap?: number;
  };
  equipment: Record<string, unknown> & { preset_no?: number; title?: Title; title_preset1?: Title; title_preset2?: Title; title_preset3?: Title };
  hyper: Record<string, unknown> & { use_preset_no?: string | number };
  link: Record<string, unknown>;
  ability: Record<string, unknown> & { preset_no?: number };
  pet: Record<string, unknown>;
  symbol: { symbol?: SymbolIn[] };
  /** character/cashitem-equipment (optional: older saved shapes and tests have none). */
  cash?: Record<string, unknown> & { world_share_master_label_activate_flag?: string | null };
  /** character/other-stat: 마스터라벨 플러스 shows up here while it runs (its end date is not in the API). */
  otherStat?: { other_stat?: OtherStat[] };
};

// ---------- data file ----------
type ClassRule = {
  atkBuff: string[];
  skills0: { name: string; max: number; effect?: string }[];
  ability: { full: string[]; practical: string; collector?: boolean };
  artifactCooldown: boolean;
  hyperPassive: string[];
  /** The five hyper passives most taken, most first: what a character puts its five points in. */
  hyperPassiveTop: string[];
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
  /** Link skill → the class (or 모험가 전사 · 시그너스 … group) that gives it, from the API (2026-11-17). */
  linkOwners?: Record<string, string>;
  classes: Record<string, ClassRule>;
};
export const SPEC_DATA = classesJson as unknown as Data;

// Boss-relevant 5th job common cores (Claude's pick, 2026-11-09): the damage / bind / survival ones.
// Movement and party-buff cores (로프 커넥트, 쓸만한 …) are left out.
const BOSS_COMMON_CORES = ["스파이더 인 미러", "크레스트 오브 더 솔라", "에르다 노바", "에르다의 의지"];
// 바디 오브 스틸 is a warrior-only core: other classes cannot have it (청운적운 · 귤민 have none, 푸소 does; user, 2026-11-11).
// Hunting-only common cores are not asked for even when the character has them at a low level (user, 2026-11-17:
// "보스에서 안 쓰니까"): 에르다 샤워 clears mobs, 쓸만한 홀리 심볼 is experience · drop rate.
const HUNTING_COMMON_CORES = new Set(["에르다 샤워", "쓸만한 홀리 심볼"]);
const WARRIOR_CORE = "바디 오브 스틸";
const DECENT_HOLY_SYMBOL = "쓸만한 홀리 심볼";
const HOLY_SYMBOL_CLASS = "비숍";
const WARRIOR_CLASSES = new Set(["히어로", "팔라딘", "다크나이트", "소울마스터", "미하일", "블래스터", "데몬슬레이어", "데몬어벤져", "아란", "카이저", "아델", "제로", "렌"]);
const HP_CLASS = "데몬어벤져";
// Title warnings: the title and its option alike, only under 7 days (user, 2026-11-16).
const TITLE_WARN_DAYS = 7;
// Hyper stat points left: a few spare points are normal, warn from 10 (user, 2026-11-16).
const HYPER_WARN_POINTS = 10;
export { PERIOD_WARN_DAYS };
/** A character keeps up to three pets out, and each pet holds two pet buffs. */
const PET_SLOTS = 3;
const BUFFS_PER_PET = 2;
// 마스터라벨 플러스 by master labels worn (official notice 2026-08-20): 전투 = 공격력, 성장 = 추가 경험치.
const PLUS_COUNT: Record<string, Record<string, number>> = {
  "전투 플러스": { "10": 1, "20": 2, "30": 3, "40": 4, "60": 5 },
  "성장 플러스": { "25": 1, "40": 2, "55": 3, "70": 4, "100": 5 },
};
/** 전투 플러스 by master labels worn (1 ~ 5): [공격력 · 마력, 올스탯]. Same notice. */
const COMBAT_PLUS: [number, number][] = [
  [10, 15],
  [20, 40],
  [30, 65],
  [40, 90],
  [60, 140],
];

/** Whole days until `at`, rounded up ("6.5일" → 7); anything already past (even an hour) or "expired" = −1. */
function daysTo(at: string, now: Date): number {
  const ms = at === "expired" ? -1 : new Date(at).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : -1;
}

/**
 * Stat cash items and pets that run out. Stats come from the cash items worn (base; presets only change the look —
 * 귤민 shows its 마스터라벨 stats from base while wearing preset 3) and, when the character uses it, the world's shared
 * 마스터라벨 set. Pets = own + the world's shared pets, the same pet once.
 */
export function periodsOf(raw: SpecRaw, now: Date): Period[] {
  const out: Period[] = [];
  const seen = new Set<string>();
  const push = (p: Period) => {
    const key = `${p.kind}|${p.slot}|${p.name}|${p.at}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  const cash = raw.cash;
  const lists = [cash?.cash_item_equipment_base, cash?.additional_cash_item_equipment_base];
  if (cash?.world_share_master_label_activate_flag === "1") lists.push(cash.world_share_master_label_base);
  for (const list of lists) {
    for (const it of (Array.isArray(list) ? list : []) as CashItem[]) {
      if (!it.cash_item_option?.length) continue;
      const base = { name: it.cash_item_name ?? "", slot: it.cash_item_equipment_slot ?? "" };
      if (it.date_option_expire)
        push({ ...base, kind: it.cash_item_label === "마스터라벨" ? "label" : "cashStat", days: daysTo(it.date_option_expire, now), at: it.date_option_expire.slice(0, 10) });
      if (it.date_expire) push({ ...base, kind: "cashItem", days: daysTo(it.date_expire, now), at: it.date_expire.slice(0, 10) });
    }
  }
  // The same place (1 ~ 3) as own and as the world's shared pet is one pet; two pets of one name in two places are two.
  for (const prefix of ["pet", "world_share_pet"])
    for (const i of [1, 2, 3]) {
      const name = raw.pet[`${prefix}_${i}_name`];
      const at = raw.pet[`${prefix}_${i}_date_expire`];
      if (typeof name === "string" && name && typeof at === "string" && at)
        push({ kind: "pet", name, slot: `${i}`, days: daysTo(at, now), at: at === "expired" ? "" : at.slice(0, 10) });
    }
  return out.sort((a, b) => a.days - b.days);
}

/** The five places a master label set fills (every full set worn on 2026-11-18: 언현 · 준민나로12 · 흑소 · 귀심 · 귤민). */
const LABEL_SET = ["모자", "상의", "신발", "망토", "무기"];

/**
 * Master labels in effect, one per place: those worn (base) and, when the world's shared set is on, that set. days =
 * days of stats left, null = none (run out — the API drops them). A place with stats in either list counts as having them.
 */
export function labelPieces(raw: SpecRaw, now: Date): { slot: string; name: string; icon: string | null; days: number | null }[] {
  const cash = raw.cash;
  const lists = [cash?.cash_item_equipment_base, cash?.additional_cash_item_equipment_base];
  if (cash?.world_share_master_label_activate_flag === "1") lists.push(cash.world_share_master_label_base);
  const bySlot = new Map<string, { slot: string; name: string; icon: string | null; days: number | null }>();
  for (const list of lists)
    for (const it of (Array.isArray(list) ? list : []) as CashItem[]) {
      if (it.cash_item_label !== "마스터라벨") continue;
      const slot = it.cash_item_equipment_slot ?? "";
      // Stats past their date (or "expired") count as none, like stats the API already dropped.
      const left = it.cash_item_option?.length && it.date_option_expire ? daysTo(it.date_option_expire, now) : -1;
      const days = left >= 0 ? left : null;
      const had = bySlot.get(slot);
      if (!had || (had.days === null && days !== null) || (had.days !== null && days !== null && days > had.days))
        bySlot.set(slot, { slot, name: it.cash_item_name ?? "", icon: apiIcon(it.cash_item_icon), days });
    }
  return [...bySlot.values()].sort((a, b) => LABEL_SET.indexOf(a.slot) - LABEL_SET.indexOf(b.slot));
}

/** "전투 플러스 · 마라벨 5개" for each 마스터라벨 플러스 running now. */
export function labelPlusOf(raw: SpecRaw): string[] {
  return (raw.otherStat?.other_stat ?? []).flatMap((o) => {
    const kind = o.other_stat_type?.match(/^\[마스터라벨 플러스\]\s*(.+)$/)?.[1]?.trim();
    if (!kind) return [];
    const key = kind === "전투 플러스" ? "공격력" : "추가 경험치 획득";
    const value = o.stat_info?.find((s) => s.stat_name === key)?.stat_value ?? "";
    const n = PLUS_COUNT[kind]?.[value];
    return [n ? `${kind} · 마라벨 ${n}개` : kind];
  });
}

// ---------- result ----------
/**
 * How much it takes to fill a miss (user, 2026-11-17): the list is ordered by it and each line carries it as a chip.
 * urgent = runs out within days · now = a few clicks · quest = a quest or a setting · long = raising characters, meso.
 */
export type Tier = "urgent" | "now" | "quest" | "long";
/**
 * One thing of a miss drawn as an icon tile (5th job cores, links, gear …); icon null = no picture for it.
 * icon2 = a second picture sharing the tile: a boost core is drawn as its two skills split along the diagonal.
 */
export type Tile = { name: string; sub?: string; icon: string | null; icon2?: string | null; done?: boolean };
/**
 * detail = lines under the subtitle (" · " separated items never break inside); rows = aligned table (symbols),
 * rowIcons = its picture per row; icon = the one picture of a single-thing miss; tiles = the things as icon tiles.
 */
export type Miss = { cat: string; what: string; detail: string[]; tier: Tier; icon?: string | null; tiles?: Tile[]; rows?: string[][]; rowIcons?: (string | null)[] };
const TIER_ORDER: Record<Tier, number> = { urgent: 0, now: 1, quest: 2, long: 3 };
/**
 * Something that runs out (user, 2026-11-17): stat cash items and pets. days = whole days left, rounded up like
 * titles (−1 = over); at = the end, "YYYY-MM-DD" in KST.
 */
export type Period = { kind: "label" | "cashStat" | "cashItem" | "pet"; name: string; slot: string; days: number; at: string };
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
  /** Stat cash items and pets with an end, soonest first (pets already over are in misses too). */
  periods: Period[];
  /** 마스터라벨 플러스 running now, e.g. ["성장 플러스 · 마라벨 5개", "전투 플러스 · 마라벨 5개"]; null = other-stat did not come back. */
  labelPlus: string[] | null;
  /** False when the class is not in the data file (new class): class rules were skipped. */
  known: boolean;
};

// ---------- icons ----------
// The API has no icon for a skill the character lacks and none for V cores, so those come from a table built from
// ranked characters (lib/spec/data/icons.json: name → the last part of the address).
const SKILL_ICON_BASE = "https://open.api.nexon.com/static/maplestory/skill/icon/";
const ICON_CODES = (iconsJson as { skill: Record<string, string> }).skill;
const tableIcon = (name: string): string | null => (Object.hasOwn(ICON_CODES, name) ? SKILL_ICON_BASE + ICON_CODES[name] : null);
/** Only addresses on the official API host are passed on to the page. */
const apiIcon = (url: unknown): string | null => (typeof url === "string" && url.startsWith("https://open.api.nexon.com/") ? url : null);

// ---------- helpers ----------
const preset = <T>(obj: Record<string, unknown>, prefix: string, i: number) => obj[`${prefix}${i}`] as T | undefined;
const list = (names: string[]) => names.join(" · ");

// AP to raise a crystal Lv.1→2, 2→3, 3→4, 4→5 (official guide, 2026-11-18). The game hands out the crystals with the
// artifact level (3 at Lv.1, one more every 10 levels, 9 at Lv.60), so the API's list is every slot there is.
const CRYSTAL_STEP_AP = [1, 2, 2, 3];

/** The most of `remain` AP that can go into these crystals (each raised a step at a time, up to Lv.5). */
export function artifactSpendable(remain: number, levels: number[]): number {
  let can = new Set([0]);
  for (const lv of levels) {
    const steps = [0];
    for (let s = Math.max(1, lv); s < 5; s++) steps.push(steps[steps.length - 1] + CRYSTAL_STEP_AP[s - 1]);
    const next = new Set<number>();
    for (const a of can) for (const b of steps) if (a + b <= remain) next.add(a + b);
    can = next;
  }
  return Math.max(...can);
}

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
  const add = (tier: Tier, cat: string, what: string, ...detail: (string | false | undefined)[]) => {
    const miss: Miss = { cat, what, detail: detail.filter((d): d is string => !!d), tier };
    misses.push(miss);
    return miss;
  };

  // 0th-job skills
  const skills = raw.skill0.character_skill ?? [];
  const skillLv = (name: string) => skills.find((s) => s.skill_name === name)?.skill_level;
  const skillIcon = (name: string) => apiIcon(skills.find((s) => s.skill_name === name)?.skill_icon) ?? tableIcon(name);
  // How to fill each one (user, 2026-11-17). 여제의 축복 goes to 24 by raising Cygnus / Mihile characters and from
  // there to 30 only through their 고귀한 정신 (NEXON's skill text), so the hint changes at 24.
  const EMPRESS_BY_LEVEL = 24;
  const commonHint = (name: string, lv: number | undefined): string | undefined => {
    if (name === "연합의 의지") return lv === undefined ? "[연합] 퀘스트 미완료" : undefined;
    if (name === "정령의 축복") return "같은 월드 다른 캐릭터 육성";
    if (name === "여제의 축복") return (lv ?? 0) >= EMPRESS_BY_LEVEL ? "고귀한 정신 퀘스트 미완료" : "시그너스 · 미하일 캐릭터 육성";
    return undefined;
  };
  for (const s of data.common.skills0) {
    const lv = skillLv(s.name);
    if (lv !== undefined && lv >= s.max) continue;
    // A quest: 연합의 의지, and 여제의 축복 once it sits at 24. The rest is raising other characters.
    const quest = s.name === "연합의 의지" || (s.name === "여제의 축복" && (lv ?? 0) >= EMPRESS_BY_LEVEL);
    add(quest ? "quest" : "long", "공용 스킬", lv === undefined ? `${s.name} 안 배움` : `${s.name} ${lv} / ${s.max}`, commonHint(s.name, lv)).icon = skillIcon(s.name);
  }
  // 보약: only whether it was taken (the API does not say how its points were spent).
  for (const name of eventSkills) if (!skillLv(name)) add("quest", "보약", `${name} 안 배움`).icon = tableIcon(name);
  if (rule) {
    if (rule.atkBuff.length && !rule.atkBuff.some((n) => skillLv(n) !== undefined))
      add("quest", "공용 스킬", `${rule.atkBuff.join(" / ")} 안 배움`, "공격력 · 마력 4%").icon = tableIcon(rule.atkBuff[0]);
    for (const s of rule.skills0) {
      const lv = skillLv(s.name);
      if (lv === undefined) add("quest", "직업 0차 스킬", `${s.name} 안 배움`, s.effect).icon = skillIcon(s.name);
      else if (lv < s.max) add("quest", "직업 0차 스킬", `${s.name} ${lv} / ${s.max}`, s.effect).icon = skillIcon(s.name);
    }
  }
  if (skillLv("고급 무기 제련") === undefined) tips.push({ cat: "고급 무기 제련", what: "안 배움", detail: ["전문기술 → 장비제작 명장"], tier: "long", icon: tableIcon("고급 무기 제련") });

  // propensity
  const p = raw.propensity;
  const prop: [string, number | undefined, string][] = [
    ["통찰력", p.insight_level, "속성 내성 무시 5%"],
    ["감성", p.sensibility_level, "버프 지속 10%"],
    ["카리스마", p.charisma_level, "방어율 무시 10%"],
  ];
  if (cls === HP_CLASS) prop.push(["의지", p.willingness_level, "최대 HP"]);
  for (const [name, lv, effect] of prop) {
    if ((lv ?? 0) < 100) add("long", "성향", `${name} ${lv ?? 0} / 100`, `100레벨 → ${effect}`);
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
      "now",
      "유니온 아티팩트",
      `보스용 효과 ${short.length}개 Lv.10 미만`,
      `부족: ${short.map((k) => `${KIND_LABEL[k]} Lv.${levelOf(k)}`).join(" · ")}`,
      `보스에 안 쓰는 효과: ${wasted.map((e) => `${effectName(e.name)} Lv.${e.level}`).join(" · ")}`,
    );
  }
  // Left AP counts only as far as it can go into a crystal (user, 2026-11-18): at Lv.58 eight crystals at Lv.5 leave
  // nothing to raise until the ninth opens. Without the crystal list (older saved shape) every point counts as before.
  const remainAp = raw.artifact.union_artifact_remain_ap ?? 0;
  const crystals = raw.artifact.union_artifact_crystal;
  const spendAp = crystals?.length ? artifactSpendable(remainAp, crystals.map((c) => c.level)) : remainAp;
  if (spendAp > 0) add("now", "유니온 아티팩트", spendAp < remainAp ? `AP ${remainAp} 남음 · ${spendAp} 쓸 수 있음` : `AP ${remainAp} 남음`);

  // Title: title_preset1~3 do not follow equipment presets (2026-11-09: 흑소 · 광선 · 청운적운 · 데몬10세기 keep it in
  // title_preset1 whatever equipment preset they use), so the boss title may sit in any of them while a hunting title
  // (e.g. 쑥쑥 새싹) is on right now. A boss title in any title preset counts; otherwise the one equipped now is reported.
  const titles = [raw.equipment.title, raw.equipment.title_preset1, raw.equipment.title_preset2, raw.equipment.title_preset3].filter(
    (t): t is NonNullable<Title> => !!t?.title_name,
  );
  // Days left before the title (or its option) runs out; Infinity = no expiry. The boss title that lasts longest wins,
  // so an expired copy in one preset does not hide a good one in another.
  const daysLeft = (t: NonNullable<Title>) => Math.min(...[t.date_expire, t.date_option_expire].map((at) => (!at ? Infinity : daysTo(at, now))));
  const bossTitles = titles.filter((t) => /보스 몬스터/.test(t.title_description ?? ""));
  const title = bossTitles.sort((a, b) => daysLeft(b) - daysLeft(a))[0] ?? titles[0] ?? null;
  if (!title?.title_name) {
    add("now", "칭호", "미장착");
  } else {
    if (!/보스 몬스터/.test(title.title_description ?? "")) add("quest", "칭호", "보스 데미지 없음", title.title_name).icon = apiIcon(title.title_icon);
    for (const [label, at] of [
      ["기간", title.date_expire],
      ["옵션", title.date_option_expire],
    ] as const) {
      if (!at) continue;
      const days = daysTo(at, now);
      if (days < TITLE_WARN_DAYS) add("urgent", "칭호", days < 0 ? `${label} 만료` : `${label} 만료 ${days}일 남음`, title.title_name).icon = apiIcon(title.title_icon);
    }
  }

  // Upgrade slots never used, on the gear of the boss preset (user, 2026-11-17): scrolls cost meso, so it is "long".
  const gear = (presets.eq ? preset<Item[]>(raw.equipment, "item_equipment_preset_", presets.eq) : undefined) ?? (raw.equipment.item_equipment as Item[] | undefined) ?? [];
  const slotsLeft = gear
    .map((it) => ({ name: it.item_name ?? "", left: Number(it.scroll_upgradeable_count ?? 0), icon: apiIcon(it.item_icon) }))
    .filter((it) => it.name && it.left > 0);
  if (slotsLeft.length)
    add("long", "주문서 강화", `횟수 남은 장비 ${slotsLeft.length}개${presets.eq ? ` (${presets.eq}번 프리셋)` : ""}`, list(slotsLeft.map((it) => `${it.name} ${it.left}회`))).tiles = slotsLeft.map(
      (it) => ({ name: it.name, sub: `${it.left}회 남음`, icon: it.icon }),
    );

  // Stat cash items under 7 days, pets already over (an expired pet cannot be called out: no pet buffs or pet gear).
  const periods = periodsOf(raw, now);
  const CASH_WHAT: Record<string, string> = { label: "마스터라벨 능력치", cashStat: "능력치", cashItem: "기간" };
  const soon = new Map<string, string[]>();
  for (const p of periods)
    if (p.kind !== "pet" && p.days < PERIOD_WARN_DAYS) {
      const what = `${CASH_WHAT[p.kind]} 만료${p.days < 0 ? "" : ` ${p.days}일 남음`}`;
      soon.set(what, [...(soon.get(what) ?? []), p.name]);
    }
  for (const [what, names] of soon) add("urgent", "캐시 장비", what, list(names));
  const petsOver = periods.filter((p) => p.kind === "pet" && p.days < 0);
  if (petsOver.length) add("urgent", "펫", `기간 만료 ${petsOver.length}마리`, list(petsOver.map((p) => p.name)));

  // Pets by place (1 ~ 3). The API sends the world's shared pets as a second copy of the same places (pet_1 =
  // world_share_pet_1: 10 of 10 characters on 2026-11-18), so one place = one pet; two pets of the same name in two
  // places are still two pets (review 2026-11-18 — they were merged by name before).
  const petPlaces = [1, 2, 3].flatMap((i) => {
    const copies = ["pet", "world_share_pet"].filter((prefix) => {
      const name = raw.pet[`${prefix}_${i}_name`];
      return typeof name === "string" && !!name;
    });
    if (!copies.length) return [];
    const name = raw.pet[`${copies[0]}_${i}_name`] as string;
    // A place is over only when every copy of it is over; geared when either copy wears something.
    const over = copies.every((prefix) => {
      const at = raw.pet[`${prefix}_${i}_date_expire`];
      return typeof at === "string" && !!at && daysTo(at, now) < 0;
    });
    const geared = copies.some((prefix) => !!(raw.pet[`${prefix}_${i}_equipment`] as { item_name?: string | null } | null | undefined)?.item_name);
    const icon = copies.map((prefix) => apiIcon(raw.pet[`${prefix}_${i}_icon`])).find(Boolean) ?? null;
    return [{ name, over, geared, icon }];
  });
  // Pets wearing no pet gear (new, user 2026-11-17); pets already over cannot wear anything (the line above has them).
  const livePets = petPlaces.filter((p) => !p.over);
  // Fewer than three pets (user, 2026-11-17: "펫 1마리면 2마리 빠진 거"). A pet that is over still takes its place and
  // is reported as over, so every named place counts here.
  const petSlotsEmpty = PET_SLOTS - Math.min(PET_SLOTS, petPlaces.length);
  // Tests and older saved shapes have pet buffs but no pet names: without any name the count is unknown.
  if (petPlaces.length && petSlotsEmpty)
    add("long", "펫", `${petSlotsEmpty}자리 비어 있음`, `지금 ${petPlaces.length}마리 · ${PET_SLOTS}마리까지 · 한 마리에 펫 버프 ${BUFFS_PER_PET}개`);
  const bare = livePets.filter((p) => !p.geared);
  if (bare.length)
    add("long", "펫 장비", `장비 없는 펫 ${bare.length}마리`, list(bare.map((p) => p.name))).tiles = bare.map((p) => ({ name: p.name, sub: "장비 없음", icon: p.icon }));

  // Master labels with stats left but no 전투 플러스 (user, 2026-11-17): the plus only works on labels whose stats run,
  // and it is the boss half (성장 플러스 is experience). Skipped when other-stat did not come back.
  const labelPlus = raw.otherStat ? labelPlusOf(raw) : null;
  const labelsLeft = periods.filter((p) => p.kind === "label" && p.days >= 0);
  const labelSlots = Math.min(5, new Set(labelsLeft.map((p) => p.slot)).size);
  if (labelPlus && labelSlots && !labelPlus.some((x) => x.startsWith("전투 플러스"))) {
    const [atk, stat] = COMBAT_PLUS[labelSlots - 1];
    add(
      "long",
      "마스터라벨 플러스",
      "전투 플러스 꺼짐",
      `마라벨 ${labelSlots}개 능력치 ${Math.min(...labelsLeft.map((p) => p.days))}일 남음${labelPlus.length ? " · 성장 플러스만 켜짐" : ""}`,
      `켜면 공격력 · 마력 +${atk} · 올스탯 +${stat} (4만 캐시 · 90일)`,
    );
  }

  // Master labels worn whose stats are gone (user, 2026-11-18: "낀 사람이거나 기간이 몇 개만 남은 사람은 알려줘야"): the API
  // keeps a worn label but drops its stats once they run out, so periodsOf never sees it. Nobody wearing one: no line.
  const labels = labelPieces(raw, now);
  const withStats = labels.filter((l) => l.days !== null).length;
  if (labels.length && withStats < LABEL_SET.length) {
    const bare = labels.filter((l) => l.days === null);
    const lines = [
      // The first line is what the tiles show (an opened line shows the tiles in its place), so it is always there.
      bare.length ? `능력치 없음: ${list(bare.map((l) => `${l.slot} ${l.name}`))}` : `낀 마라벨: ${list(labels.map((l) => `${l.slot} ${l.name}`))}`,
      ...(labels.length < LABEL_SET.length ? [`마라벨 안 낀 부위: ${list(LABEL_SET.filter((s) => !labels.some((l) => l.slot === s)))}`] : []),
    ];
    add("long", "마스터라벨", `능력치 있는 마라벨 ${withStats} / ${LABEL_SET.length}부위`, ...lines).tiles = labels.map((l) =>
      l.days === null
        ? { name: l.name, sub: "능력치 없음", icon: l.icon }
        : { name: l.name, sub: `${l.days}일 남음`, icon: l.icon, done: true },
    );
  }

  // 5th job (V matrix)
  const cores = raw.vmatrix.character_v_core_equipment ?? [];
  const coreLv = (name: string) => cores.find((c) => c.v_core_name === name)?.v_core_level ?? 0;
  const commonCores = WARRIOR_CLASSES.has(cls) ? [...BOSS_COMMON_CORES.slice(0, 2), WARRIOR_CORE, ...BOSS_COMMON_CORES.slice(2)] : BOSS_COMMON_CORES;
  // Every 공용 코어 the character has is looked at (user, 2026-11-13: there are far more than the few named here —
  // the class-group ones, the 쓸만한 ones, 블링크 …). The named ones are asked for even when they are missing.
  const ownedCommon = cores.filter((c) => c.v_core_type === "공용 코어" && !HUNTING_COMMON_CORES.has(c.v_core_name)).map((c) => c.v_core_name);
  const lowCommon = [...new Set([...commonCores, ...ownedCommon])].filter((n) => coreLv(n) < data.common.vCoreMin);
  if (lowCommon.length)
    add("long", "5차 공용 코어", `${data.common.vCoreMin}레벨 미만 ${lowCommon.length}개`, lowCommon.map((n) => `${n} ${coreLv(n)}`).join(" · ")).tiles = lowCommon.map((n) => ({
      name: n,
      sub: `Lv.${coreLv(n)} / ${data.common.vCoreMin}`,
      icon: tableIcon(n),
    }));
  const zeroBoost = cores.filter((c) => c.v_core_type === "강화 코어" && c.v_core_level === 0);
  // "A/B 강화" has no picture of its own: the class skills it boosts stand in (icons.json), the first two the table
  // knows — the game draws the core as those two split along the diagonal (user, 2026-11-18).
  const boostIcons = (core: string) =>
    core
      .replace(/ 강화$/, "")
      .split("/")
      .map((n) => tableIcon(n.trim()))
      .filter((icon): icon is string => !!icon);
  if (zeroBoost.length)
    add("long", "5차 강화 코어", `0레벨 ${zeroBoost.length}개`, zeroBoost.map((c) => c.v_core_name).join(" · ")).tiles = zeroBoost.map((c) => {
      const [icon = null, icon2 = null] = boostIcons(c.v_core_name);
      return { name: c.v_core_name, sub: "0레벨", icon, icon2 };
    });
  const slotPt = raw.vmatrix.character_v_matrix_remain_slot_upgrade_point ?? 0;
  if (slotPt > 0) add("now", "5차 슬롯 강화", `포인트 ${slotPt} 남음`);
  // Special cores: the equipped set may be the hunting one (흑소: 룬의 경험 now, 일격필살 in presets 2 · 3), so look at presets too.
  const specials = [
    ...cores,
    ...[1, 2, 3, 4, 5].flatMap((i) => preset<typeof cores>(raw.vmatrix as Record<string, unknown>, "character_v_core_equipment_preset_", i) ?? []),
  ]
    .filter((c) => c.v_core_type === "특수 코어")
    .map((c) => c.v_core_name);
  if (!specials.some((n) => data.common.bossSpecialCores.includes(n)))
    add("quest", "5차 특수 코어", "보스용 없음", `보스용: ${list(data.common.bossSpecialCores.map((n) => n.replace(/ I$/, "")))}`);

  // hyper stat (boss preset)
  if (presets.hyper) {
    const left = Number(raw.hyper[`hyper_stat_preset_${presets.hyper}_remain_point`] ?? 0);
    if (left >= HYPER_WARN_POINTS) add("now", "하이퍼 스탯", `${left}포인트 남음 (${presets.hyper}번 프리셋)`);
  }

  if (rule) {
    const picked = new Set((raw.hyperPassive.character_skill ?? []).filter((s) => s.skill_level > 0).map((s) => s.skill_name));
    const hpMiss = rule.hyperPassive.filter((n) => !picked.has(n));
    // The API lists a hyper passive (with its icon) even at level 0.
    const hpIcon = (n: string) => apiIcon((raw.hyperPassive.character_skill ?? []).find((s) => s.skill_name === n)?.skill_icon) ?? tableIcon(n);
    // Opened, the line shows the five most taken with what this character has (user, 2026-11-18), not only the misses.
    const hpShown = [...rule.hyperPassiveTop, ...hpMiss.filter((n) => !rule.hyperPassiveTop.includes(n))];
    if (hpMiss.length)
      add("now", "하이퍼 패시브", `대부분 찍는 것 ${hpMiss.length}개 안 찍음`, list(hpMiss)).tiles = hpShown.map((n) =>
        picked.has(n) ? { name: n, sub: "찍음", icon: hpIcon(n), done: true } : { name: n, sub: "안 찍음", icon: hpIcon(n) },
      );

    // pet buffs (own pets + world shared pets)
    const auto = [1, 2, 3].flatMap((i) =>
      [`pet_${i}_auto_skill`, `world_share_pet_${i}_auto_skill`].flatMap((k) => {
        const a = raw.pet[k] as AutoSkill;
        return a ? [a.skill_1, a.skill_2] : [];
      }),
    );
    const petSet = new Set(auto.filter((x): x is string => !!x));
    // 쓸만한 홀리 심볼 is asked of every class but 비숍, which has its own 홀리 심볼 (user, 2026-11-17).
    const petStd = cls === HOLY_SYMBOL_CLASS || rule.petBuff.includes(DECENT_HOLY_SYMBOL) ? rule.petBuff : [...rule.petBuff, DECENT_HOLY_SYMBOL];
    const petMiss = petStd.filter((n) => !petSet.has(n));
    // With every buff place of the pets taken, nothing can be added before another pet is (데몬10세기: one pet, both
    // of its places used, four buffs missing). Unknown pet count → as before.
    const buffPlaces = Math.min(PET_SLOTS, livePets.length) * BUFFS_PER_PET;
    const noPlace = petPlaces.length > 0 && petSet.size >= buffPlaces;
    if (petMiss.length)
      add(noPlace ? "long" : "now", "펫 버프", `대부분 등록하는 것 ${petMiss.length}개 빠짐${noPlace ? " · 넣을 자리 없음" : ""}`, list(petMiss)).tiles = petMiss.map((n) => ({
        name: n,
        sub: "빠짐",
        icon: tableIcon(n),
      }));

    // links (boss preset; the class's own link comes separately and is not in the standard list)
    // All three presets empty → nothing equipped: every standard link counts as missing.
    const have = new Set((presets.link ? preset<Skill[]>(raw.link, "character_link_skill_preset_", presets.link) ?? [] : []).map((s) => s.skill_name));
    const linkMiss = rule.link.filter((n) => !have.has(n));
    // With the class that gives it (user, 2026-11-17: "프라이어 프리퍼레이션 is 카인's").
    const owner = (n: string) => (data.linkOwners?.[n] ? `${n} (${data.linkOwners[n]})` : n);
    if (linkMiss.length)
      add("now", "링크 스킬", presets.link ? `대부분 끼는 것 ${linkMiss.length}개 빠짐 (${presets.link}번 프리셋)` : "미장착", list(linkMiss.map(owner))).tiles = linkMiss.map((n) => ({
        name: n,
        sub: data.linkOwners?.[n],
        icon: tableIcon(n),
      }));

    if (presets.ability) {
      const lines = preset<{ ability_info?: AbilityLine[] }>(raw.ability, "ability_preset_", presets.ability)?.ability_info ?? [];
      if (!abilityComplete(lines, rule.ability))
        add(
          "long",
          "어빌리티",
          `미완성 (${presets.ability}번 프리셋)`,
          `종결: ${rule.ability.full.map(comboLabel).join(" 또는 ")} (레전드리 3줄)`,
          `실전: ${comboLabel(rule.ability.practical)} (레전드리 + 유니크 2줄)`,
        );
    }
  }

  // symbols: growth already collected but meso not paid (tip, not counted — it costs meso)
  const gaps = symbolGaps(raw.symbol.symbol ?? []);
  // "아케인심볼 : 레헬른" → 레헬른, to find the picture of the region of a gap
  const symbolIcons = new Map(
    (raw.symbol.symbol ?? []).map((s) => {
      const sym = s as { symbol_name?: string; symbol_icon?: string };
      return [String(sym.symbol_name ?? "").split(":").pop()!.trim(), sym.symbol_icon] as const;
    }),
  );
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
      tier: "long",
      rowIcons: gaps.map((g) => apiIcon(symbolIcons.get(g.region))),
      rows: gaps.map((g) => [
        g.region,
        `Lv.${g.level} → ${g.to}`,
        g.meso === null ? "-" : koreanMeso(g.meso),
        g.stats.map(([k, v]) => `${k} +${v.toLocaleString("ko-KR")}`).join(" · ") || "-",
      ]),
    });
  }

  // Easiest first; inside one tier the check order stays (sort is stable).
  misses.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  return {
    name: raw.basic.character_name,
    world: raw.basic.world_name,
    cls,
    level: raw.basic.character_level,
    image: raw.basic.character_image ?? null,
    presets,
    misses,
    tips,
    periods,
    labelPlus,
    known: !!rule,
  };
}
