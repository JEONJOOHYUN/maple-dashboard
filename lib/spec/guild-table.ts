// 숨은 스펙업 · 길드 표 (user, 2026-11-20: 시안 C "사람 × 스킬 표", 가장 많이 놓친 사람부터 · 정렬은 고를 수 있게).
// Pure and light (types only from check.ts, so the page does not pull in the class data): the server turns a member's
// skill lines into cells (lib/spec/guild.ts), the page lays them out in columns, sorts and counts them.
import type { Miss, Tier } from "./check.ts";

/** Longer input is not looked up (a guild name is short; this only keeps junk away from the API). */
export const MAX_GUILD_NAME = 20;

/** Keys of the skill lines that are not one common skill (those are keyed by their own name, e.g. "연합의 의지"). */
export const SKILL_KEY = { skill0: "직업 0차", atkBuff: "공격 버프", hyperPassive: "하이퍼 패시브", event: "보약" } as const;

/**
 * One line a member missed: short text under the column of its key; note = the whole line, for a hover; n = how many
 * things it is (a hyper passive line names several: "4개" = 4), what "많이 놓친 순" adds up.
 */
export type Cell = { key: string; text: string; tier: Tier; note: string; n: number };

/** known = the class is in the data file; a new class gets only the common checks (its own columns show "-"). */
export type MemberRow =
  | { ok: true; name: string; level: number; cls: string; known: boolean; recent: boolean; cells: Cell[] }
  | { ok: false; name: string; reason: "notFound" | "failed" };

/** Columns judged by the class's own rules: nothing to show for a class the data does not know yet. */
export const CLASS_COLUMNS: readonly string[] = [SKILL_KEY.skill0, SKILL_KEY.atkBuff, SKILL_KEY.hyperPassive];

/** A skill line as its cell. Lines without a key (not a skill line) have none. */
export function cellOf(m: Miss): Cell | null {
  const key = m.key;
  if (!key) return null;
  const note = [m.what, ...m.detail].join(" · ");
  // "대부분 찍는 것 2개 안 찍음" → "2개", two things
  if (key === SKILL_KEY.hyperPassive) {
    const count = m.what.match(/(\d+)개/);
    return { key, text: count?.[0] ?? m.what, tier: m.tier, note, n: Math.max(1, Number(count?.[1] ?? 1)) };
  }
  let text: string;
  // Columns of several skills name the one missing: "계승된 의지", "엘리멘탈 하모니 3 / 10".
  if (key === SKILL_KEY.skill0 || key === SKILL_KEY.atkBuff) text = m.what.replace(/ 안 배움$/, "");
  // A column of one skill (연합 · 여제 · 정령 · 보약) says how far: "안 배움", "24 / 30".
  else text = m.what.match(/(안 배움|\d+ \/ \d+)$/)?.[0] ?? m.what;
  return { key, text, tier: m.tier, note, n: 1 };
}

/** Everything a member missed, counted thing by thing (4 hyper passives = 4). */
export const missCount = (r: MemberRow) => (r.ok ? r.cells.reduce((s, c) => s + c.n, 0) : 0);

// 연합의 의지 first: a quest, the one most often missed (2 guilds measured 2026-11-19).
const COMMON_FIRST = ["연합의 의지", "여제의 축복", "정령의 축복"];

/** The table's columns, left to right: the class's own skills, the common ones, hyper passives, 보약 while it runs. */
export function guildColumns(common: readonly string[], event: boolean): string[] {
  const rank = (n: string) => (COMMON_FIRST.includes(n) ? COMMON_FIRST.indexOf(n) : COMMON_FIRST.length);
  const shared = [...common].sort((a, b) => rank(a) - rank(b));
  return [SKILL_KEY.skill0, SKILL_KEY.atkBuff, ...shared, SKILL_KEY.hyperPassive, ...(event ? [SKILL_KEY.event] : [])];
}

export type SortBy = "miss" | "level" | "name" | "class" | `col:${string}`;
export const SORTS: { id: Exclude<SortBy, `col:${string}`>; label: string }[] = [
  { id: "miss", label: "많이 놓친 순" },
  { id: "level", label: "레벨순" },
  { id: "name", label: "이름순" },
  { id: "class", label: "직업순" },
];

const ko = (a: string, b: string) => a.localeCompare(b, "ko");
type Ok = Extract<MemberRow, { ok: true }>;
const byLevel = (a: Ok, b: Ok) => b.level - a.level || ko(a.name, b.name);
const missed = (r: Ok, key: string) => (r.cells.some((c) => c.key === key) ? 1 : 0);

/**
 * Members in the order asked. Ties go to the higher level (it should have these by now), then the name. A column
 * ("col:연합의 의지") = whoever missed that first. Members that could not be checked always come last, by name.
 */
export function sortRows(rows: readonly MemberRow[], by: SortBy): MemberRow[] {
  const ok = rows.filter((r): r is Ok => r.ok);
  const rest = rows.filter((r) => !r.ok).sort((a, b) => ko(a.name, b.name));
  let cmp: (a: Ok, b: Ok) => number;
  if (by === "level") cmp = byLevel;
  else if (by === "name") cmp = (a, b) => ko(a.name, b.name);
  else if (by === "class") cmp = (a, b) => ko(a.cls, b.cls) || byLevel(a, b);
  else if (by.startsWith("col:")) {
    const key = by.slice(4);
    cmp = (a, b) => missed(b, key) - missed(a, key) || missCount(b) - missCount(a) || byLevel(a, b);
  } else cmp = (a, b) => missCount(b) - missCount(a) || byLevel(a, b);
  return [...ok.sort(cmp), ...rest];
}

/** How many checked members missed each column. */
export function columnCounts(rows: readonly MemberRow[], cols: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(cols.map((c) => [c, 0]));
  for (const r of rows) if (r.ok) for (const key of new Set(r.cells.map((c) => c.key))) if (key in out) out[key]++;
  return out;
}
