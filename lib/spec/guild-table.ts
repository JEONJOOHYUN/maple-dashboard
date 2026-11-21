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

/**
 * known = the class is in the data file; a new class gets only the common checks (its own columns show "-").
 * main = the main of the character's account group (lib/nexon/api.ts nexonUnionMain), null when NEXON has none.
 */
export type MemberRow =
  | { ok: true; name: string; level: number; cls: string; known: boolean; recent: boolean; main: string | null; cells: Cell[]; /** The day the data is of ("2026-11-19") when it is not live: NEXON under maintenance. */ asOf?: string }
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
  return [...ok.sort(order(by)), ...rest];
}

function order(by: SortBy): (a: Ok, b: Ok) => number {
  if (by === "level") return byLevel;
  if (by === "name") return (a, b) => ko(a.name, b.name);
  if (by === "class") return (a, b) => ko(a.cls, b.cls) || byLevel(a, b);
  if (by.startsWith("col:")) {
    const key = by.slice(4);
    return (a, b) => missed(b, key) - missed(a, key) || byMisses(a, b) || byLevel(a, b);
  }
  return (a, b) => byMisses(a, b) || byLevel(a, b);
}

/** Members whose name holds the words typed (user, 2026-11-20: "길드 내에서도 특정 인원을 검색"); case is ignored. */
export function matchName(rows: readonly MemberRow[], query: string): MemberRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows];
}

/**
 * One player (user, 2026-11-20: "계정 그룹 캐릭들은 따로 묶어서 · 메인캐릭이 있고 서브 캐릭이 있는거잖아"): the
 * guild's characters of one account group as one line, its main on the line and the others folded under it. The
 * in-game member count counts accounts, and one player can hold several accounts of one union: 가몽 2026-11-20 =
 * 366 characters, 137 accounts, 122 players.
 */
export type Person = {
  /** Stays the same while members stream in: the main's name, or a member's own name when NEXON gave no main. */
  key: string;
  /** The row on the line: the main, or the highest of the others when the main is not in this guild. */
  head: MemberRow;
  subs: MemberRow[];
  /** The main's name when the main is not in this guild (the head is then one of the others). */
  away: string | null;
};

/** Members → players, by the main NEXON gave each one; a member with none (or not checked) is a player of its own. */
export function groupPeople(rows: readonly MemberRow[]): Person[] {
  const byMain = new Map<string, MemberRow[]>();
  for (const r of rows) if (r.ok && r.main) byMain.set(r.main, [...(byMain.get(r.main) ?? []), r]);
  const people: Person[] = [];
  for (const r of rows) {
    if (r.ok && r.main) continue;
    // The main itself could not be checked (or got no row) while its other characters name it: it heads them.
    const group = byMain.get(r.name);
    if (group) group.push(r);
    else people.push({ key: r.name, head: r, subs: [], away: null });
  }
  for (const [main, group] of byMain) {
    const head = group.find((r) => r.name === main) ?? [...group].sort((a, b) => (a.ok && b.ok ? byLevel(a, b) : 0))[0];
    people.push({ key: main, head, subs: group.filter((r) => r !== head), away: head.name === main ? null : main });
  }
  return people;
}

/**
 * Players in the order asked, by their mains as sortRows orders members. Under "많이 놓친 순" and a column, mains that
 * missed as much go by their other characters (who missed more there first); each player's others are in the same
 * order. Players whose main could not be checked come last, by name.
 */
export function sortPeople(people: readonly Person[], by: SortBy): Person[] {
  const col = by.startsWith("col:") ? by.slice(4) : null;
  const others = new Map(people.map((p) => [p, p.subs.filter((r) => r.ok && (col ? missed(r, col) : r.cells.length > 0)).length]));
  const tie = (a: Person, b: Person) => others.get(b)! - others.get(a)!;
  const head = (p: Person) => p.head as Ok;
  let cmp: (a: Person, b: Person) => number;
  if (by === "level" || by === "name" || by === "class") {
    const rows = order(by);
    cmp = (a, b) => rows(head(a), head(b));
  } else if (col) cmp = (a, b) => missed(head(b), col) - missed(head(a), col) || tie(a, b) || byMisses(head(a), head(b)) || byLevel(head(a), head(b));
  else cmp = (a, b) => byMisses(head(a), head(b)) || tie(a, b) || byLevel(head(a), head(b));
  const ok = people.filter((p) => p.head.ok).sort(cmp);
  const rest = people.filter((p) => !p.head.ok).sort((a, b) => ko(a.head.name, b.head.name));
  return [...ok, ...rest].map((p) => ({ ...p, subs: sortRows(p.subs, by) }));
}

/** Players with a character whose name holds the words typed (the main's or another's). */
export function matchPeople(people: readonly Person[], query: string): Person[] {
  return query.trim() ? people.filter((p) => matchName([p.head, ...p.subs], query).length > 0) : [...people];
}

/** Whether one of the player's other characters holds the words typed: the line opens to show it. */
export const subMatches = (p: Person, query: string) => !!query.trim() && matchName(p.subs, query).length > 0;

/** How many checked members missed each column. */
export function columnCounts(rows: readonly MemberRow[], cols: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(cols.map((c) => [c, 0]));
  for (const r of rows) if (r.ok) for (const key of new Set(r.cells.map((c) => c.key))) if (key in out) out[key]++;
  return out;
}
