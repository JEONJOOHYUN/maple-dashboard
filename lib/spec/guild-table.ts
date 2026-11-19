// 숨은 스펙업 · 길드 표 (user, 2026-11-20: 시안 C "사람 × 스킬 표", 가장 많이 놓친 사람부터 · 정렬은 고를 수 있게).
// Pure and light (types only from check.ts, so the page does not pull in the class data): the server turns a member's
// lines into cells (lib/spec/guild.ts), the page lays them out in columns, sorts and counts them.
import type { Miss, Tier } from "./check.ts";

/** Longer input is not looked up (a guild name is short; this only keeps junk away from the API). */
export const MAX_GUILD_NAME = 20;

/** Keys of the lines that are not one common skill (those are keyed by their own name, e.g. "연합의 의지"). */
export const SKILL_KEY = {
  skill0: "0차 스킬",
  atkBuff: "영웅의 메아리",
  hyperPassive: "하이퍼 패시브",
  event: "보약",
  link: "링크",
  petBuff: "펫 버프",
} as const;

/**
 * The table's six columns (user, 2026-11-20): what guild members miss most that takes a few clicks or a quest
 * (measured over two guilds: 링크 42% · 25%, 펫 버프 31% · 14%, 하이퍼 패시브 19% · 16%, 연합의 의지 15% · 14%).
 * Left out: 정령의 축복 (0% in both) and 영웅의 메아리 (1 ~ 3%). 보약 is a 0th-grade skill too: while an event runs it
 * shows in the 0차 스킬 column, so the table keeps its six columns.
 */
export const GUILD_COLUMNS: readonly string[] = [SKILL_KEY.skill0, "연합의 의지", "여제의 축복", SKILL_KEY.hyperPassive, SKILL_KEY.link, SKILL_KEY.petBuff];

/** Columns judged by the class's own rules: nothing to show for a class the data does not know yet. */
export const CLASS_COLUMNS: readonly string[] = [SKILL_KEY.skill0, SKILL_KEY.hyperPassive, SKILL_KEY.link, SKILL_KEY.petBuff];

/**
 * One line a member missed: short text in its column (key); what · detail = the whole line, for the hover bubble;
 * n = how many things it is (a line of several: "4개" = 4), what "많이 놓친 순" adds up.
 */
export type Cell = { key: string; text: string; tier: Tier; what: string; detail: string[]; n: number };

/** known = the class is in the data file; a new class gets only the common checks (its own columns show "-"). */
export type MemberRow =
  | { ok: true; name: string; level: number; cls: string; known: boolean; recent: boolean; cells: Cell[] }
  | { ok: false; name: string; reason: "notFound" | "failed" };

/** Lines of several things, shown as their count: "대부분 찍는 것 2개 안 찍음" → "2개". */
const COUNTED: readonly string[] = [SKILL_KEY.hyperPassive, SKILL_KEY.link, SKILL_KEY.petBuff];

/** A line as its cell; null when its column is not in the table (or it is not a skill line). */
export function cellOf(m: Miss): Cell | null {
  if (!m.key) return null;
  const key = m.key === SKILL_KEY.event ? SKILL_KEY.skill0 : m.key;
  if (!GUILD_COLUMNS.includes(key)) return null;
  const base = { key, tier: m.tier, what: m.what, detail: m.detail };
  if (COUNTED.includes(key)) {
    const count = m.what.match(/(\d+)개/);
    // "미장착" (no link at all) is every link on its tiles
    const n = Number(count?.[1] ?? 0) || (m.tiles?.filter((t) => !t.done).length ?? 0) || 1;
    return { ...base, text: count?.[0] ?? m.what, n };
  }
  // The 0차 스킬 column names the skill missing: "계승된 의지", "엘리멘탈 하모니 3 / 10", 보약's skill.
  if (key === SKILL_KEY.skill0) return { ...base, text: m.what.replace(/ 안 배움$/, ""), n: 1 };
  // A column of one skill (연합 · 여제) says how far: "안 배움", "24 / 30".
  return { ...base, text: m.what.match(/(안 배움|\d+ \/ \d+)$/)?.[0] ?? m.what, n: 1 };
}

/** Everything a member missed, counted thing by thing (4 hyper passives = 4). */
export const missCount = (r: MemberRow) => (r.ok ? r.cells.reduce((s, c) => s + c.n, 0) : 0);
/**
 * How many columns a member missed. "많이 놓친 순" goes by this first, then by missCount: a character wearing no link
 * at all (a link-holder alt, 2026-11-20 가몽) is 12 links, and by things alone such alts filled the top of the table.
 */
export const missColumns = (r: MemberRow) => (r.ok ? new Set(r.cells.map((c) => c.key)).size : 0);
const byMisses = (a: MemberRow, b: MemberRow) => missColumns(b) - missColumns(a) || missCount(b) - missCount(a);

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
 * Members in the order asked. "많이 놓친 순" = most columns missed, then most things; ties go to the higher level (it
 * should have these by now), then the name. A column ("col:연합의 의지") = whoever missed that first. Members that could
 * not be checked always come last, by name.
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
    cmp = (a, b) => missed(b, key) - missed(a, key) || byMisses(a, b) || byLevel(a, b);
  } else cmp = (a, b) => byMisses(a, b) || byLevel(a, b);
  return [...ok.sort(cmp), ...rest];
}

/** Members whose name holds the words typed (user, 2026-11-20: "길드 내에서도 특정 인원을 검색"); case is ignored. */
export function matchName(rows: readonly MemberRow[], query: string): MemberRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows];
}

/** How many checked members missed each column. */
export function columnCounts(rows: readonly MemberRow[], cols: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(cols.map((c) => [c, 0]));
  for (const r of rows) if (r.ok) for (const key of new Set(r.cells.map((c) => c.key))) if (key in out) out[key]++;
  return out;
}
