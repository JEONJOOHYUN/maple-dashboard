"use client";

// 숨은 스펙업 · 길드 (시안 C, user 2026-11-20): guild name → its members in a table, one column a skill, the members
// who missed the most first; the order can be changed (레벨 · 이름 · 직업, or a column = who missed that skill).
// One line a player (시안 A, user 2026-11-20 night): the main, its other characters folded under it, opened at the
// line's right end.
import { asOfLabel } from "@/lib/spec/as-of";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CornerDownRight, Search, X } from "lucide-react";
import { Chip } from "@/components/ev/ui";
import { PageHeader } from "@/components/page-header";
import { Message, Pieces, RECENT_DROP, RECENT_NAME, RECENT_PILL, RECENT_PILL_OFF, RECENT_PILL_ON, SPEC_DESCRIPTION, whatText } from "@/components/spec/spec-check";
import { SpecTabs } from "@/components/spec/spec-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { SwapLabel } from "@/components/ui/swap-icon";
import type { Tier } from "@/lib/spec/check";
import {
  CLASS_COLUMNS,
  GUILD_COLUMNS,
  MAX_GUILD_NAME,
  SORTS,
  columnCounts,
  groupPeople,
  matchPeople,
  sortPeople,
  subMatches,
  type Cell,
  type MemberRow,
  type Person,
  type SortBy,
} from "@/lib/spec/guild-table";
import { useStored } from "@/lib/use-stored";
import { Reveal, useReveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/** count = characters; users = accounts (the in-game member count), null when NEXON gives none. */
/** asOf = the day the member list is of, when NEXON was under maintenance. */
export type GuildInfo = { world: string; name: string; level: number; master: string; count: number; users: number | null; asOf?: string };

export type GuildView =
  | { kind: "empty" }
  | { kind: "notFound" | "limit" | "busy" | "quota" | "maintenance" | "failed"; name: string }
  | { kind: "pick"; name: string; guilds: GuildInfo[] }
  /** pieces = the members, a few at a time, as the server finishes them; others = guilds of the name in other worlds. */
  | { kind: "guild"; guild: GuildInfo; pieces: Promise<MemberRow[]>[]; others: number };

// Recent guilds (this browser only), like the recent characters of the 개인 tab.
type Recent = { name: string; world: string };
const RECENT_KEY = "spec-guild-recent";
const RECENT_MAX = 8;
const isRecent = (x: unknown): x is Recent =>
  !!x && typeof x === "object" && typeof (x as Recent).name === "string" && typeof (x as Recent).world === "string";

/** Rows shown at first and added by each "더 보기". */
const PAGE = 50;

const guildHref = (name: string, world?: string) =>
  `/spec?guild=${encodeURIComponent(name)}${world ? `&world=${encodeURIComponent(world)}` : ""}`;
const n = (v: number) => v.toLocaleString("ko-KR");

// A miss is orange whatever it takes, except what cannot be filled right away (여제 under 24 = raising other
// characters, pet buffs with no free place): outlined.
const TONE: Record<Tier, string> = {
  urgent: "bg-primary-soft text-primary-text",
  now: "bg-primary-soft text-primary-text",
  quest: "bg-primary-soft text-primary-text",
  long: "tile-edge text-muted-foreground",
};

/**
 * A missed line as a pill; the whole line (what is missing, then its details) in the site's own bubble on hover or
 * focus (user, 2026-11-20: "테마에 맞춰서", the browser's title box before). Details break only between " · " items.
 */
function Pill({ cell }: { cell: Cell }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        // No ring of its own: the site's focus outline keeps the outlined pill's shadow edge under it.
        className={cn("inline-block cursor-default rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", TONE[cell.tier])}
      >
        {cell.text}
      </TooltipTrigger>
      <TooltipContent className="max-w-[min(18rem,calc(100vw-2rem))] flex-col items-start gap-1 py-2 text-left leading-snug">
        <b className="break-keep">{whatText(cell.what)}</b>
        {cell.detail.map((d, i) => (
          <Pieces key={i} text={d} className="text-xs opacity-80" />
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 tile px-4 py-3.5", className)}>
      <span className="text-xs break-keep text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function WorldPick({ name, guilds }: { name: string; guilds: GuildInfo[] }) {
  return (
    <section className="flex flex-col gap-3 tile p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <b className="text-[15px] break-keep">
          &quot;{name}&quot; 길드 {guilds.length}곳 → 월드 고르기
        </b>
        <span className="text-xs text-muted-foreground">캐릭터 많은 순</span>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {guilds.map((g) => (
          <li key={g.world}>
            <Link
              href={guildHref(g.name, g.world)}
              prefetch={false}
              className="flex flex-col gap-1 rounded-lg tile-edge bg-background px-3.5 py-3 transition-[background-color,scale] active:scale-[0.96]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <b className="text-[15px]">{g.world}</b>
                <span className="text-xs text-muted-foreground">Lv.{g.level}</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                {g.users ? `계정 ${n(g.users)} · ` : ""}캐릭터 <b className="text-foreground">{n(g.count)}</b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a member has in one column: the misses as pills, ✓ when none, - when the class has no rules yet. */
function CellView({ row, col }: { row: Extract<MemberRow, { ok: true }>; col: string }) {
  if (!row.known && CLASS_COLUMNS.includes(col)) return <span className="text-muted-foreground">-</span>;
  const cells = row.cells.filter((c) => c.key === col);
  if (!cells.length)
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">다 배움</span>
      </span>
    );
  return (
    <span className="inline-flex flex-col items-center gap-1">
      {cells.map((c, i) => (
        <Pill key={i} cell={c} />
      ))}
    </span>
  );
}

/**
 * The button at the end of a player's line (user, 2026-11-20: "열고 닫는건 오른쪽에"): how many other characters it
 * has here, and how many of them missed something (orange then).
 */
function SubsToggle({ person, open, onToggle }: { person: Person; open: boolean; onToggle: () => void }) {
  const count = person.subs.length;
  if (!count)
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">-</span>
        <span className="sr-only">부캐 없음</span>
      </span>
    );
  const missed = person.subs.filter((r) => r.ok && r.cells.length > 0).length;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`부캐 ${count}명${missed ? ` 중 ${missed}명 놓침` : " 다 챙김"} ${open ? "접기" : "펼치기"}`}
      // One width down the column (user, 2026-11-20: "부캐 글자가 정렬이 안되어있어"), the count and the arrow together in
      // its middle ("너무 쏠려있다" when they sat at the two ends). after: the press area reaches 6px past the 32px
      // button, inside its own cell.
      className={cn(
        "relative inline-flex h-8 min-w-[3.25rem] items-center justify-center gap-1 rounded-full border pr-2 pl-2.5 text-xs font-bold whitespace-nowrap transition-[color,background-color,border-color,scale] after:absolute after:-inset-1.5 sm:min-w-[7.5rem]",
        missed ? "border-transparent bg-primary-soft text-primary-text hover:bg-primary/20" : "tile-edge text-muted-foreground hover:text-foreground",
      )}
    >
      {/* A phone keeps this column narrow: the count only, the colour still telling whether one missed. */}
      <span className="sm:hidden">{count}</span>
      <span className="hidden sm:inline">
        {count}명{missed ? ` · 놓침 ${missed}` : " ✓"}
      </span>
      {/* 2px of the icon box's own blank goes back on each side, so the arrow sits by the count. */}
      <ChevronDown className={cn("-mx-0.5 size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
    </button>
  );
}

/**
 * One character's line. A player's main heads it, the open / close button at its end (end); the player's other
 * characters (sub) come under it, set in, on the page's own ground. Both ends stay put while the columns scroll.
 */
type RevealAttrs = ReturnType<typeof useReveal>["attrs"];

/** The other characters of a player: they fade out before they leave when the line is folded. */
function SubLines({ open, subs, cols }: { open: boolean; subs: MemberRow[]; cols: readonly string[] }) {
  const { shown, attrs } = useReveal(open);
  if (!shown) return null;
  return subs.map((r) => <MemberLine key={r.name} row={r} cols={cols} sub reveal={attrs} />);
}

function MemberLine({
  row,
  cols,
  sub = false,
  away = null,
  end = null,
  reveal,
}: {
  row: MemberRow;
  cols: readonly string[];
  sub?: boolean;
  away?: string | null;
  end?: ReactNode;
  reveal?: RevealAttrs;
}) {
  const ground = sub ? "bg-background" : "bg-card";
  return (
    <tr {...reveal} className={cn("border-t border-border", sub && "border-dashed", ground, reveal && "reveal-row")}>
      <th scope="row" className={cn("sticky left-0 z-[1] py-2 pr-3.5 text-left font-normal", sub ? "pl-4" : "pl-3.5", ground)}>
        <span className="flex items-center gap-1.5">
          {sub && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="flex flex-col">
            {/* Not prefetched: a guild has hundreds of these, and opening one asks NEXON for the whole character. The
                name alone is the way in (user, 2026-11-20: a › beside it was "굳이 — 클릭하면 들어가지니까"). */}
            <Link
              href={`/spec?name=${encodeURIComponent(row.name)}`}
              prefetch={false}
              className={cn("self-start whitespace-nowrap hover:text-primary-text hover:underline", sub ? "text-[12.5px] font-semibold" : "font-bold")}
            >
              {row.name}
              <span className="sr-only"> 자세히 보기</span>
            </Link>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">
              {row.ok ? `Lv.${row.level} ${row.cls}` : row.reason === "notFound" ? "넥슨 정보 없음" : "확인 실패"}
            </span>
            {away && <span className="text-[11px] whitespace-nowrap text-muted-foreground">본캐 {away} · 길드 밖</span>}
          </span>
        </span>
      </th>
      {row.ok ? (
        cols.map((c) => (
          <td key={c} className="px-1.5 py-2 text-center">
            <CellView row={row} col={c} />
          </td>
        ))
      ) : (
        <td colSpan={cols.length} className="px-3.5 py-2 text-xs text-muted-foreground">
          {row.reason === "notFound" ? "2023년 12월 이후 접속 기록이 없어 조회 안 됨" : "넥슨 응답 오류"}
        </td>
      )}
      <td className={cn("sticky right-0 z-[1] px-2 py-2 text-center shadow-[inset_1px_0_0_var(--border)] sm:px-3", ground)}>{end}</td>
    </tr>
  );
}

/** A player counts as recent when any of its characters logged in within 7 days (NEXON's flag). */
const recentPlayer = (p: Person) => [p.head, ...p.subs].some((r) => r.ok && r.recent);

/**
 * What the table showed, kept for this browser tab (user, 2026-11-20: a member's whole check, then back to the guild):
 * the order, the filter, the search, the lines opened and how far "더 보기" went. Another tab starts fresh.
 * Players' lines start closed and "부캐 모두 펼치기" opens them all; flipped = the players (by key) opened or closed by
 * hand against that, and against a search that opens a line to show another character's name.
 */
type View = { sortBy: SortBy; recentOnly: boolean; query: string; limit: number; openAll: boolean; flipped: string[] };
const NEW_VIEW: View = { sortBy: "miss", recentOnly: false, query: "", limit: PAGE, openAll: false, flipped: [] };
const viewKey = (g: GuildInfo) => `spec-guild-view:${g.world}:${g.name}`;
const isSort = (v: unknown): v is SortBy =>
  typeof v === "string" && (SORTS.some((s) => s.id === v) || (v.startsWith("col:") && GUILD_COLUMNS.includes(v.slice(4))));

/** A stored view as far as it can be trusted (an older or edited one falls back field by field). */
function viewOf(stored: unknown): View {
  if (!stored || typeof stored !== "object") return NEW_VIEW;
  const v = stored as Partial<Record<keyof View, unknown>>;
  return {
    sortBy: isSort(v.sortBy) ? v.sortBy : NEW_VIEW.sortBy,
    recentOnly: v.recentOnly === true,
    query: typeof v.query === "string" ? v.query : "",
    limit: typeof v.limit === "number" && Number.isFinite(v.limit) && v.limit > PAGE ? Math.floor(v.limit) : PAGE,
    openAll: v.openAll === true,
    flipped: Array.isArray(v.flipped) ? v.flipped.filter((k): k is string => typeof k === "string") : [],
  };
}

function GuildResult({ guild, pieces, others }: { guild: GuildInfo; pieces: Promise<MemberRow[]>[]; others: number }) {
  const cols = GUILD_COLUMNS;
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  // Rows as the pieces arrive. A new set of pieces (다시 확인) starts over: state is set aside per set.
  const [got, setGot] = useState<{ from: Promise<MemberRow[]>[]; rows: MemberRow[]; eta: number | null }>({ from: pieces, rows: [], eta: null });
  if (got.from !== pieces) setGot({ from: pieces, rows: [], eta: null });
  // The view (order, filter, search, lines open, rows shown) lives in this tab's storage: the server renders it new,
  // the browser brings back what this tab last had of the guild.
  const [stored, setStored] = useStored<unknown>(viewKey(guild), NEW_VIEW, "session");
  const { sortBy, recentOnly, query, limit, openAll, flipped: flippedKeys } = useMemo(() => viewOf(stored), [stored]);
  const flipped = useMemo(() => new Set(flippedKeys), [flippedKeys]);
  const change = (next: (v: View) => Partial<View>) =>
    setStored((prev: unknown) => {
      const v = viewOf(prev);
      return { ...v, ...next(v) };
    });

  useEffect(() => {
    let live = true;
    let done = 0;
    const started = performance.now();
    for (const piece of pieces)
      piece.then((more) => {
        if (!live) return;
        done += more.length;
        const left = guild.count - done;
        const eta = left > 0 ? ((performance.now() - started) / done) * left : 0;
        setGot((g) => (g.from === pieces ? { ...g, rows: [...g.rows, ...more], eta } : g));
      });
    return () => {
      live = false;
    };
  }, [pieces, guild.count]);

  // (A render with older rows is thrown away: the reset above makes React render again before it shows anything.)
  const rows = got.rows;
  const done = rows.length;
  const loading = done < guild.count;
  const people = useMemo(() => groupPeople(rows), [rows]);
  // The columns, the counts and "많이 놓친 순" go by the mains; the other characters are under them.
  const mains = useMemo(() => people.map((p) => p.head), [people]);
  const counts = useMemo(() => columnCounts(mains, cols), [mains, cols]);
  const missingMains = mains.filter((r) => r.ok && r.cells.length > 0).length;
  const missingAll = rows.filter((r) => r.ok && r.cells.length > 0).length;
  const top = cols.filter((c) => counts[c] > 0).sort((a, b) => counts[b] - counts[a]).slice(0, 2);
  const unchecked = rows.filter((r) => !r.ok);
  const failed = unchecked.filter((r) => !r.ok && r.reason === "failed").length;
  // A member list or rows made from a past day's data: NEXON under maintenance. (Either can be dated alone: the
  // rows may come from the live cache while the list does not, and the other way round.)
  const asOf = guild.asOf ?? rows.flatMap((r) => (r.ok && r.asOf ? [r.asOf] : []))[0];
  const recentCount = people.filter(recentPlayer).length;
  const visible = useMemo(
    () => sortPeople(matchPeople(recentOnly ? people.filter(recentPlayer) : people, query), sortBy),
    [people, sortBy, recentOnly, query],
  );
  const shown = visible.slice(0, limit);
  const isOpen = (p: Person) => (openAll || subMatches(p, query)) !== flipped.has(p.key);
  const flip = (key: string) => change((v) => ({ flipped: v.flipped.includes(key) ? v.flipped.filter((k) => k !== key) : [...v.flipped, key] }));
  const search = (q: string) => change(() => ({ query: q, flipped: [] }));

  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={`${guild.name} · ${guild.world} Lv.${guild.level}`} className="col-span-2 sm:col-span-1">
          <span className="flex items-baseline justify-between gap-2">
            {/* Players; the in-game member count is accounts, and one player can hold several (가몽: 122 · 137 · 366). */}
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <b className="text-[22px] leading-tight">{n(people.length)}명</b>
              <span className="text-[13px] text-muted-foreground">
                {guild.users ? `계정 ${n(guild.users)} · ` : ""}캐릭터 {n(guild.count)}
              </span>
            </span>
            {others > 0 && (
              <Link href={guildHref(guild.name)} prefetch={false} className="text-xs font-semibold whitespace-nowrap text-primary-text hover:underline">
                다른 월드 {others}곳
              </Link>
            )}
          </span>
        </Stat>
        <Stat label="놓친 스킬 있는 본캐">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-[22px] leading-tight text-primary-text">{n(missingMains)}명</b>
            <span className="text-[13px] text-muted-foreground">부캐 포함 {n(missingAll)}캐릭</span>
          </span>
        </Stat>
        <Stat label="본캐가 가장 많이 놓침">
          <b className="text-[15px] leading-snug break-keep">{top.length ? top.map((c) => `${c} ${n(counts[c])}`).join(" · ") : "없음"}</b>
        </Stat>
      </div>

      {asOf && <p className="px-0.5 text-xs font-semibold text-primary-text">{asOfLabel(asOf)}</p>}

      {/* It fades out before it leaves, so the table under it does not jump the moment the last member arrives. */}
      <Reveal open={loading} className="flex flex-col gap-2 tile px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <b>
            길드원 확인 중 · {n(done)} / {n(guild.count)}명
          </b>
          {got.eta !== null && got.eta >= 1000 && <span className="shrink-0 text-xs text-muted-foreground">약 {Math.ceil(got.eta / 1000)}초 남음</span>}
        </div>
        <div
          role="progressbar"
          aria-label="길드원 확인"
          aria-valuemin={0}
          aria-valuemax={guild.count}
          aria-valuenow={done}
          className="h-2.5 overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(done / guild.count) * 100}%` }} />
        </div>
      </Reveal>

      <div className="flex flex-wrap items-center gap-1.5">
        {SORTS.map((s) => (
          <Chip key={s.id} on={sortBy === s.id} onClick={() => change(() => ({ sortBy: s.id }))}>
            {s.label}
          </Chip>
        ))}
        {/* On a phone the filter goes to the next line, where a divider would hang at the end of the first. */}
        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <Chip on={recentOnly} soft onClick={() => change((v) => ({ recentOnly: !v.recentOnly }))}>
          최근 7일 접속만{recentOnly ? ` ${n(recentCount)}명` : ""}
        </Chip>
        <Chip
          on={openAll}
          soft
          onClick={() => change((v) => ({ openAll: !v.openAll, flipped: [] }))}
        >
          부캐 모두 펼치기
        </Chip>
        {/* A member by name (user, 2026-11-20): its own line on a phone, the right end on a wider screen. */}
        <label className="order-first flex h-9 w-full items-center gap-2 rounded-lg tile-edge bg-card pr-1 pl-3 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:order-none sm:ml-auto sm:w-56">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">길드원 이름으로 찾기</span>
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="길드원 찾기"
            autoComplete="off"
            spellCheck={false}
            className="h-8 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[13px]"
          />
          {query && (
            <button type="button" onClick={() => search("")} aria-label="길드원 찾기 지우기" className="flex size-7 shrink-0 items-center justify-center rounded-md opacity-60 transition-[opacity,scale] hover:opacity-100">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      {/* relative: the hidden "다 배움" labels (absolute) stay inside the scroll box instead of widening the page on a phone */}
      <div className="relative overflow-x-auto tile">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-secondary">
              <th scope="col" className="sticky left-0 z-[1] bg-secondary px-3.5 py-2.5 text-left font-bold whitespace-nowrap">
                본캐
              </th>
              {cols.map((c) => {
                const on = sortBy === `col:${c}`;
                return (
                  <th key={c} scope="col" aria-sort={on ? "descending" : undefined} className="px-1.5 py-1.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => change(() => ({ sortBy: on ? "miss" : `col:${c}` }))}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex flex-col items-center gap-0.5 rounded-md px-2 py-1 font-bold transition-[color,background-color,box-shadow,scale] hover:bg-card",
                        on && "bg-card text-primary-text ring-1 ring-primary/60",
                      )}
                    >
                      {c}
                      <span className={cn("text-xs", counts[c] ? "text-primary-text" : "font-semibold text-muted-foreground")}>{n(counts[c])}명</span>
                    </button>
                  </th>
                );
              })}
              {/* w-px: as narrow as its buttons, the room left to the skill columns */}
              <th scope="col" className="sticky right-0 z-[1] w-px bg-secondary px-2 py-2.5 text-center font-bold whitespace-nowrap shadow-[inset_1px_0_0_var(--border)] sm:px-3">
                부캐
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const open = isOpen(p);
              return (
                <Fragment key={p.key}>
                  <MemberLine row={p.head} cols={cols} away={p.away} end={<SubsToggle person={p} open={open} onToggle={() => flip(p.key)} />} />
                  <SubLines open={open} subs={p.subs} cols={cols} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">{loading ? "확인된 길드원부터 여기에 나옴" : "해당하는 길드원 없음"}</p>
        )}
      </div>

      {visible.length > limit && (
        <button
          type="button"
          onClick={() => change((v) => ({ limit: v.limit + PAGE }))}
          className="press-static h-11 rounded-lg tile-edge text-sm font-bold"
        >
          더 보기 · {n(visible.length - limit)}명 남음
        </button>
      )}

      {!loading && unchecked.length > 0 && (
        <p className="px-0.5 text-xs text-muted-foreground">
          확인 못 한 길드원 {n(unchecked.length)}명 → 표 맨 아래
          {failed > 0 && (
            <>
              {" · "}
              {/* Inside a sentence: the words stay at the left of the box the two states share (underline per state: it
                  does not pass into the stacked boxes by itself). */}
              <button
                type="button"
                onClick={() => startRetry(() => router.refresh())}
                disabled={retrying}
                className="inline-flex items-center font-semibold text-primary-text disabled:opacity-50 hover:[&>span>span]:underline"
              >
                <SwapLabel
                  on={retrying}
                  from="다시 확인"
                  to={
                    <>
                      <Spinner size={12} />
                      다시 확인 중
                    </>
                  }
                  className="[&>span]:justify-start [&>span]:gap-1"
                />
              </button>
            </>
          )}
        </p>
      )}
    </section>
  );
}

export function GuildCheck({ name, view }: { name: string; view: GuildView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(name);
  const [recent, setRecent] = useStored<Recent[]>(RECENT_KEY, []);

  // Only guilds that were opened are remembered, newest first.
  const foundName = view.kind === "guild" ? view.guild.name : null;
  const foundWorld = view.kind === "guild" ? view.guild.world : null;
  useEffect(() => {
    if (!foundName || !foundWorld) return;
    setRecent((prev) =>
      [{ name: foundName, world: foundWorld }, ...(Array.isArray(prev) ? prev.filter(isRecent) : []).filter((g) => g.name !== foundName || g.world !== foundWorld)].slice(
        0,
        RECENT_MAX,
      ),
    );
  }, [foundName, foundWorld, setRecent]);
  const recentList = (Array.isArray(recent) ? recent : []).filter(isRecent);

  const go = (href: string) => startTransition(() => router.push(href));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q) go(guildHref(q));
  };

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="숨은 스펙업" description={SPEC_DESCRIPTION} aside={<SpecTabs on="guild" />} />

      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-lg tile-edge bg-card px-4 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">길드 이름</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="길드 이름"
            maxLength={MAX_GUILD_NAME}
            autoComplete="off"
            spellCheck={false}
            className="h-[46px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="flex h-[50px] shrink-0 items-center justify-center rounded-lg bg-primary px-[22px] text-[15px] font-bold text-primary-foreground disabled:opacity-50"
        >
          <SwapLabel
            on={pending}
            from="검색"
            to={
              <>
                <Spinner />
                조회 중
              </>
            }
          />
        </button>
      </form>

      <Reveal open={recentList.length > 0} className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs text-muted-foreground">최근 길드</span>
        {recentList.map((g) => {
          const on = g.name === foundName && g.world === foundWorld;
          return (
            <span key={`${g.name}@${g.world}`} className={cn(RECENT_PILL, on ? RECENT_PILL_ON : RECENT_PILL_OFF)}>
              <button
                type="button"
                onClick={() => {
                  setText(g.name);
                  go(guildHref(g.name, g.world));
                }}
                disabled={pending}
                className={RECENT_NAME}
              >
                {g.name}
                <span className="font-normal opacity-70"> · {g.world}</span>
              </button>
              <button
                type="button"
                onClick={() => setRecent((prev) => (Array.isArray(prev) ? prev.filter(isRecent) : []).filter((x) => x.name !== g.name || x.world !== g.world))}
                aria-label={`${g.name} ${g.world} 최근 길드에서 지우기`}
                className={RECENT_DROP}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          );
        })}
      </Reveal>

      <div className={cn("transition-opacity", pending && "opacity-50")} aria-busy={pending}>
        {view.kind === "guild" && <GuildResult guild={view.guild} pieces={view.pieces} others={view.others} />}
        {view.kind === "pick" && <WorldPick name={view.name} guilds={view.guilds} />}
        {view.kind === "empty" && <Message title="길드 검색" sub="길드원마다 놓친 0차 스킬 · 연합의 의지 · 하이퍼 패시브 · 링크 · 펫 버프를 표 하나로" />}
        {view.kind === "notFound" && <Message title={`"${view.name}" 길드 없음`} sub="길드 이름 확인 · 영문은 대소문자까지 같아야 함" />}
        {view.kind === "limit" && <Message title="길드 검색 잠시 멈춤" sub="짧은 시간에 너무 많이 검색 → 1시간 안에 다시 됨" />}
        {view.kind === "busy" && <Message title="오늘 길드 검색 한도 다 씀" sub="넥슨 API 하루 한도 보호 → 내일 다시 · 개인 검색은 그대로 됨" />}
        {view.kind === "quota" && <Message title="오늘 조회 한도 다 씀" sub="넥슨 API 하루 한도 → 내일 다시" />}
        {view.kind === "maintenance" && <Message title="넥슨 점검 중" sub="점검이 끝나면 다시 검색" />}
        {view.kind === "failed" && <Message title="조회 실패" sub="넥슨 API 응답 오류 → 잠시 뒤 다시" />}
      </div>

      <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <span className="text-pretty break-keep">확인하는 것: 0차 스킬(이벤트 중엔 보약도) · 연합의 의지 · 여제의 축복 · 하이퍼 패시브 · 링크 · 펫 버프 → 나머지는 이름을 누르면 개인 탭에서</span>
        <span className="text-pretty break-keep">본캐 · 부캐는 넥슨 유니온 랭킹(어제 기준)으로 묶음</span>
        <span>Data based on NEXON Open API</span>
      </div>
    </div>
  );
}
