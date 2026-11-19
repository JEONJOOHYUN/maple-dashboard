"use client";

// 숨은 스펙업 · 길드 (시안 C, user 2026-11-20): guild name → its members in a table, one column a skill, the members
// who missed the most first; the order can be changed (레벨 · 이름 · 직업, or a column = who missed that skill).
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Chip } from "@/components/ev/ui";
import { PageHeader } from "@/components/page-header";
import { Message, Pieces, SPEC_DESCRIPTION, whatText } from "@/components/spec/spec-check";
import { SpecTabs } from "@/components/spec/spec-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tier } from "@/lib/spec/check";
import {
  CLASS_COLUMNS,
  GUILD_COLUMNS,
  MAX_GUILD_NAME,
  SORTS,
  columnCounts,
  matchName,
  sortRows,
  type Cell,
  type MemberRow,
  type SortBy,
} from "@/lib/spec/guild-table";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

export type GuildInfo = { world: string; name: string; level: number; master: string; count: number };

export type GuildView =
  | { kind: "empty" }
  | { kind: "notFound" | "limit" | "busy" | "quota" | "failed"; name: string }
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
  long: "border border-border text-muted-foreground",
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
        className={cn("inline-block cursor-default rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary", TONE[cell.tier])}
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
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3.5", className)}>
      <span className="text-xs break-keep text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function WorldPick({ name, guilds }: { name: string; guilds: GuildInfo[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <b className="text-[15px] break-keep">
          &quot;{name}&quot; 길드 {guilds.length}곳 → 월드 고르기
        </b>
        <span className="text-xs text-muted-foreground">길드원 많은 순</span>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {guilds.map((g) => (
          <li key={g.world}>
            <Link
              href={guildHref(g.name, g.world)}
              prefetch={false}
              className="flex flex-col gap-1 rounded-lg border border-border bg-background px-3.5 py-3 transition-colors hover:border-primary/60"
            >
              <span className="flex items-baseline justify-between gap-2">
                <b className="text-[15px]">{g.world}</b>
                <span className="text-xs text-muted-foreground">Lv.{g.level}</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                길드원 <b className="text-foreground">{n(g.count)}명</b>
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

function MemberLine({ row, cols }: { row: MemberRow; cols: readonly string[] }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="sticky left-0 z-[1] bg-card px-3.5 py-2 text-left font-normal">
        {/* Not prefetched: a guild has hundreds of these, and opening one asks NEXON for the whole character. */}
        <Link href={`/spec?name=${encodeURIComponent(row.name)}`} prefetch={false} className="font-bold whitespace-nowrap hover:text-primary-text hover:underline">
          {row.name}
        </Link>
        <span className="block text-[11px] whitespace-nowrap text-muted-foreground">
          {row.ok ? `Lv.${row.level} ${row.cls}` : row.reason === "notFound" ? "넥슨 정보 없음" : "확인 실패"}
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
    </tr>
  );
}

function GuildResult({ guild, pieces, others }: { guild: GuildInfo; pieces: Promise<MemberRow[]>[]; others: number }) {
  const cols = GUILD_COLUMNS;
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [query, setQuery] = useState("");
  // Rows as the pieces arrive. A new set of pieces (다시 확인) starts over: state is set aside per set.
  const [got, setGot] = useState<{ from: Promise<MemberRow[]>[]; rows: MemberRow[]; eta: number | null }>({ from: pieces, rows: [], eta: null });
  if (got.from !== pieces) setGot({ from: pieces, rows: [], eta: null });
  const [sortBy, setSortBy] = useState<SortBy>("miss");
  const [recentOnly, setRecentOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

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
  const counts = useMemo(() => columnCounts(rows, cols), [rows, cols]);
  const missing = rows.filter((r) => r.ok && r.cells.length > 0).length;
  const top = cols.filter((c) => counts[c] > 0).sort((a, b) => counts[b] - counts[a]).slice(0, 2);
  const unchecked = rows.filter((r) => !r.ok);
  const failed = unchecked.filter((r) => !r.ok && r.reason === "failed").length;
  const recentCount = rows.filter((r) => r.ok && r.recent).length;
  const visible = useMemo(
    () => sortRows(matchName(recentOnly ? rows.filter((r) => r.ok && r.recent) : rows, query), sortBy),
    [rows, sortBy, recentOnly, query],
  );
  const shown = visible.slice(0, limit);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label={`${guild.name} · ${guild.world} Lv.${guild.level}`} className="col-span-2 sm:col-span-1">
          <span className="flex items-baseline justify-between gap-2">
            <b className="text-[22px] leading-tight">{n(guild.count)}명</b>
            {others > 0 && (
              <Link href={guildHref(guild.name)} prefetch={false} className="text-xs font-semibold whitespace-nowrap text-primary-text hover:underline">
                다른 월드 {others}곳
              </Link>
            )}
          </span>
        </Stat>
        <Stat label="놓친 스킬 있음">
          <b className="text-[22px] leading-tight text-primary-text">{n(missing)}명</b>
        </Stat>
        <Stat label="가장 많이 놓침">
          <b className="text-[15px] leading-snug break-keep">{top.length ? top.map((c) => `${c} ${n(counts[c])}`).join(" · ") : "없음"}</b>
        </Stat>
      </div>

      {loading && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3.5">
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
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {SORTS.map((s) => (
          <Chip key={s.id} on={sortBy === s.id} onClick={() => setSortBy(s.id)}>
            {s.label}
          </Chip>
        ))}
        {/* On a phone the filter goes to the next line, where a divider would hang at the end of the first. */}
        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <Chip on={recentOnly} soft onClick={() => setRecentOnly((v) => !v)}>
          최근 7일 접속만{recentOnly ? ` ${n(recentCount)}명` : ""}
        </Chip>
        {/* A member by name (user, 2026-11-20): its own line on a phone, the right end on a wider screen. */}
        <label className="order-first flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card pr-1 pl-3 focus-within:border-primary sm:order-none sm:ml-auto sm:w-56">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">길드원 이름으로 찾기</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="길드원 찾기"
            autoComplete="off"
            spellCheck={false}
            className="h-8 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[13px]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="길드원 찾기 지우기" className="flex size-7 shrink-0 items-center justify-center rounded-md opacity-60 hover:opacity-100">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      {/* relative: the hidden "다 배움" labels (absolute) stay inside the scroll box instead of widening the page on a phone */}
      <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-secondary">
              <th scope="col" className="sticky left-0 z-[1] bg-secondary px-3.5 py-2.5 text-left font-bold whitespace-nowrap">
                길드원
              </th>
              {cols.map((c) => {
                const on = sortBy === `col:${c}`;
                return (
                  <th key={c} scope="col" aria-sort={on ? "descending" : undefined} className="px-1.5 py-1.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSortBy(on ? "miss" : `col:${c}`)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex flex-col items-center gap-0.5 rounded-md px-2 py-1 font-bold transition-colors hover:bg-card",
                        on && "bg-card text-primary-text ring-1 ring-primary/60",
                      )}
                    >
                      {c}
                      <span className={cn("text-xs", counts[c] ? "text-primary-text" : "font-semibold text-muted-foreground")}>{n(counts[c])}명</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <MemberLine key={r.name} row={r} cols={cols} />
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">{loading ? "확인된 길드원부터 여기에 나옴" : "해당하는 길드원 없음"}</p>
        )}
      </div>

      {visible.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="h-11 rounded-lg border border-border text-sm font-bold transition-colors hover:bg-secondary"
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
              <button type="button" onClick={() => startRetry(() => router.refresh())} disabled={retrying} className="font-semibold text-primary-text hover:underline disabled:opacity-60">
                {retrying ? "다시 확인 중" : "다시 확인"}
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
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader title="숨은 스펙업" description={SPEC_DESCRIPTION} aside={<SpecTabs on="guild" />} />

      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-card px-4 focus-within:border-primary">
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
          className="flex h-[50px] shrink-0 items-center gap-1.5 rounded-lg bg-primary px-[22px] text-[15px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "조회 중" : "검색"}
        </button>
      </form>

      {recentList.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-muted-foreground">최근 길드</span>
          {recentList.map((g) => {
            const on = g.name === foundName && g.world === foundWorld;
            return (
              <span
                key={`${g.name}@${g.world}`}
                className={cn("inline-flex items-center rounded-full border text-[13px]", on ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-card")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setText(g.name);
                    go(guildHref(g.name, g.world));
                  }}
                  disabled={pending}
                  className="py-1.5 pr-1 pl-3 font-semibold"
                >
                  {g.name}
                  <span className="font-normal opacity-70"> · {g.world}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecent((prev) => (Array.isArray(prev) ? prev.filter(isRecent) : []).filter((x) => x.name !== g.name || x.world !== g.world))}
                  aria-label={`${g.name} ${g.world} 최근 길드에서 지우기`}
                  className="py-1.5 pr-2.5 pl-1 opacity-60 hover:opacity-100"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className={cn("transition-opacity", pending && "opacity-50")} aria-busy={pending}>
        {view.kind === "guild" && <GuildResult guild={view.guild} pieces={view.pieces} others={view.others} />}
        {view.kind === "pick" && <WorldPick name={view.name} guilds={view.guilds} />}
        {view.kind === "empty" && <Message title="길드 검색" sub="길드원마다 놓친 0차 스킬 · 연합의 의지 · 하이퍼 패시브 · 링크 · 펫 버프를 표 하나로" />}
        {view.kind === "notFound" && <Message title={`"${view.name}" 길드 없음`} sub="길드 이름 확인 · 영문은 대소문자까지 같아야 함" />}
        {view.kind === "limit" && <Message title="길드 검색 잠시 멈춤" sub="짧은 시간에 너무 많이 검색 → 1시간 안에 다시 됨" />}
        {view.kind === "busy" && <Message title="오늘 길드 검색 한도 다 씀" sub="넥슨 API 하루 한도 보호 → 내일 다시 · 개인 검색은 그대로 됨" />}
        {view.kind === "quota" && <Message title="오늘 조회 한도 다 씀" sub="넥슨 API 하루 한도 → 내일 다시" />}
        {view.kind === "failed" && <Message title="조회 실패" sub="넥슨 API 응답 오류 → 잠시 뒤 다시" />}
      </div>

      <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <span className="break-keep">확인하는 것: 0차 스킬(이벤트 중엔 보약도) · 연합의 의지 · 여제의 축복 · 하이퍼 패시브 · 링크 · 펫 버프 → 나머지는 이름을 누르면 개인 탭에서</span>
        <span>Data based on NEXON Open API</span>
      </div>
    </div>
  );
}
