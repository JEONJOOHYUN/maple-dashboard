"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, Package } from "lucide-react";
import { eok } from "@/components/ev/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Digits } from "@/components/ui/digits";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Reveal } from "@/components/ui/reveal";
import { roundDates, roundName, type EventGroup, type EventRound } from "@/lib/enhance/events";
import type { ItemInfo } from "@/lib/enhance/items";
import type { SkipReason } from "@/lib/enhance/judge";
import type { SfRow } from "@/lib/enhance/parse";
import { cn } from "@/lib/utils";

/** "+9억 8,000만" / "−1.1억" / "0". */
export const signed = (meso: number) => (meso > 0 ? "+" : meso < 0 ? "−" : "") + eok(Math.abs(meso));
/** For calendar cells: "+106억" · "+4.3억" · "−199만". */
export function signedShort(meso: number): string {
  const abs = Math.abs(meso);
  const sign = meso > 0 ? "+" : meso < 0 ? "−" : "";
  if (abs >= 1e12) return sign + eok(abs);
  if (abs >= 99.95e8) return `${sign}${Math.round(abs / 1e8).toLocaleString("ko-KR")}억`;
  if (abs >= 0.995e8) return `${sign}${(abs / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4)}만`;
  return sign + Math.round(abs).toLocaleString("ko-KR");
}
export const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-muted-foreground");

export const SKIP_LABEL: Record<SkipReason, string> = {
  old: "개편 전",
  superior: "슈페리얼",
  item: "강화 아이템",
  level: "레벨 모름",
  range: "레벨 확인 필요",
};

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 tile", className)}>{children}</section>;
}

/** How many rows a ranking card shows; the rest are in its window. */
const RANK_TOP = 3;

/**
 * A ranking card's title, with "더보기" on the right when the list is longer than the card shows (user, 2026-11-14).
 * In the title row so the button sits at the same height on every card of a row, whatever their lengths.
 */
function RankHead({ title, more, onMore }: { title: string; more: boolean; onMore: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {more && (
        <button type="button" onClick={onMore} className="relative rounded-sm text-xs font-semibold text-primary-text outline-none after:absolute after:-inset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          더보기
        </button>
      )}
    </div>
  );
}

/** The whole ranking a card shows the top of, in a window like an item's; a row opens that item (user, 2026-11-14). */
function RankDialog({ title, count, open, onClose, children }: { title: string; count: number; open: boolean; onClose: () => void; children: ReactNode }) {
  // Focus goes to the list, not to its first row.
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent initialFocus={listRef} className="flex max-h-[86dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" data-clarity-mask="true">
        <div className="flex flex-col gap-1 border-b border-border p-4 pr-12">
          <DialogTitle className="text-base leading-tight font-bold">{title}</DialogTitle>
          <DialogDescription className="text-xs">{count.toLocaleString("ko-KR")}개 · 누르면 그 아이템의 내역</DialogDescription>
        </div>
        <div ref={listRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [&>*:first-child]:border-t-0">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One ranking, best first: the card shows the top three, "더보기" opens the whole list in a window (user, 2026-11-14).
 * Generic over what a row is; the caller says how to read one.
 */
export function RankCard<T>({
  title,
  empty,
  rows,
  rowKey,
  name,
  sub,
  cutSub = false,
  value,
  color,
  info,
  onOpen,
}: {
  title: string;
  empty: string;
  /** The whole ranking, best first. */
  rows: T[];
  rowKey: (row: T) => string;
  name: (row: T) => string;
  /** The line under the name. */
  sub: (row: T) => string;
  /** Keeps that line on one line, with the whole of it as its tooltip. */
  cutSub?: boolean;
  /** The text on the right, in `color`. */
  value: (row: T) => string;
  color?: string;
  info: (row: T) => ItemInfo;
  onOpen: (key: string) => void;
}) {
  const [all, setAll] = useState(false);
  // The window's list runs past 9: room for two digits there.
  const line = (row: T, i: number, wide = false) => {
    const key = rowKey(row);
    const under = sub(row);
    return (
      <button
        key={key}
        type="button"
        onClick={() => (setAll(false), onOpen(key))}
        className={cn(
          // The ring is drawn inside: the card and the window's list would cut one drawn outside.
          "press-static grid w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          wide ? "grid-cols-[30px_minmax(0,1fr)_auto]" : "grid-cols-[18px_minmax(0,1fr)_auto]"
        )}
      >
        <b className="font-num text-[15px] text-muted-foreground">
          <Digits>{i + 1}</Digits>
        </b>
        <span className="flex min-w-0 items-center gap-2.5">
          <ItemIcon info={info(row)} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="truncate text-sm" title={name(row)}>
              {name(row)}
            </b>
            <span className={cutSub ? "truncate text-xs text-muted-foreground" : "text-xs text-muted-foreground"} title={cutSub ? under : undefined}>
              {under}
            </span>
          </span>
        </span>
        <b className={cn("font-num text-sm whitespace-nowrap", color)}><Digits>{value(row)}</Digits></b>
      </button>
    );
  };
  return (
    <Card className="overflow-hidden">
      <RankHead title={title} more={rows.length > RANK_TOP} onMore={() => setAll(true)} />
      {rows.length === 0 && <p className="border-t border-border px-4 py-6 text-center text-[13px] text-muted-foreground">{empty}</p>}
      {rows.slice(0, RANK_TOP).map((row, i) => line(row, i))}
      <RankDialog title={title} count={rows.length} open={all} onClose={() => setAll(false)}>
        {rows.map((row, i) => line(row, i, true))}
      </RankDialog>
    </Card>
  );
}

export function Delta({ v, className }: { v: number; className?: string }) {
  return (
    <b className={cn("font-num whitespace-nowrap", tone(v), className)}>
      <Digits>{signed(v)}</Digits>
    </b>
  );
}

/**
 * One line over the 모아보기 cards when a single item is picked (user, 2026-11-13): what the cards of that item add up
 * to. `delta` = null when none of them has a profit to add.
 */
export function PickedTotal({ spent, delta }: { spent: number; delta: number | null }) {
  return (
    <Card className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
      <b>이 아이템 합계</b>
      <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>
          <span className="text-muted-foreground">사용 메소</span> <b className="font-num whitespace-nowrap">{eok(spent)}</b>
        </span>
        <span>
          <span className="text-muted-foreground">손익</span> {delta === null ? <b className="text-muted-foreground">제외</b> : <Delta v={delta} />}
        </span>
      </span>
    </Card>
  );
}

/**
 * Small label on a card or a try (a count, a streak, an event). A plain one adds `tile-edge`, a coloured one its own
 * border colour: `tile-edge` makes the border transparent, so the two never go on one label.
 */
export const CHIP = "rounded border px-1.5 text-[11px] leading-[calc(18/11)] font-semibold whitespace-nowrap";

/** One small box of a card: a label and a number on one line (the number drops under the label when it does not fit). */
export function Tile({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 rounded-md bg-muted px-1 py-[7px]", className)}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** What was used against the average: the bar is what was used, the tick is the average. Past the tick = worse than average. */
export function Gauge({ label, title, used, mean, children }: { label: ReactNode; /** The label in words, when it is not a plain string. */ title?: string; used: number; mean: number; children: ReactNode }) {
  const scale = Math.max(used, mean) * 1.15 || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground" title={title ?? (typeof label === "string" ? label : undefined)}>
          {label}
        </span>
        <span className="whitespace-nowrap">{children}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted" aria-hidden="true">
        <span className={cn("block h-2 min-w-1 rounded-full", used > mean ? "bg-loss" : "bg-gain")} style={{ width: pct(used) }} />
        <span className="absolute -top-[3px] h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: pct(mean) }} />
      </div>
    </div>
  );
}

/** Item picture straight from NEXON's icon host, or a box when the item is not in the account's equipment. */
export function ItemIcon({ info, size = 36 }: { info: ItemInfo; size?: number }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-lg", info.icon ? "bg-muted" : "border border-dashed border-border text-muted-foreground")}
      style={{ width: size, height: size }}
    >
      {info.icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- NEXON icon host, shown as is (never stored or resized by us)
        <img src={info.icon} alt="" loading="lazy" className="max-h-[78%] max-w-[78%] object-contain" />
      ) : (
        <Package className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

const NONE = "\u0000none";
/**
 * Menus of a long list stay under their field, shorter and scrolling when the room below runs out: by default they
 * flipped above it once the list was taller than that room (user, 2026-11-14).
 */
export const BELOW = { side: "none" } as const;

/** What a set of records added up to, for a date row and the strip: `delta` = null when none had a profit to count. */
export type EventTally = { count: number; spent: number; delta: number | null };

/**
 * 모아보기 event fields (A안, user 2026-11-16): the event, then the dates of one of its rounds. The second field
 * shows once an event is picked; each of its rows says what that round added up to. The event field names the event
 * only: how many rounds it had is in the dates field next to it ("전체 13회", user 2026-11-16). Both are menus like
 * the item list (open below, scroll): two years of rounds were taller than the room under the field.
 */
export function EventFields({
  groups,
  group,
  round,
  onPick,
  tallies,
  unit,
  className,
}: {
  groups: EventGroup[];
  group?: EventGroup;
  round?: EventRound;
  /** `label` = the group label ("" = 모든 기록), `round` = a round id ("" = every round of it). */
  onPick: (label: string, round: string) => void;
  /** The whole group first, then each round in `group.rounds` order. */
  tallies: EventTally[];
  unit: string;
  className?: string;
}) {
  if (groups.length === 0) return null;
  const sub = (t: EventTally | undefined) => (t ? `${unit} ${t.count.toLocaleString("ko-KR")}번 · ${eok(t.spent)}` : "");
  const rows = group ? [{ id: NONE, name: `전체 ${group.rounds.length}회` }, ...group.rounds.map((r) => ({ id: r.id, name: roundName(group, r) }))] : [];
  return (
    <>
      <DropdownMenu>
        {/* Picked = the orange border alone: with the shadow edge under it the field had two edges. */}
        <DropdownMenuTrigger aria-label="이벤트" title={group ? group.label : undefined} className={cn(MENU_TRIGGER, group && "border-primary/60 font-semibold shadow-none", className)}>
          <span className="truncate">{group ? group.label : "모든 기록"}</span>
          <ChevronDown className={MENU_ARROW} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" collisionAvoidance={BELOW} className="max-h-[min(16rem,var(--available-height))] w-56">
          <DropdownMenuRadioGroup value={group ? group.label : NONE} onValueChange={(next) => onPick(next === NONE ? "" : String(next), "")}>
            <DropdownMenuRadioItem value={NONE} closeOnClick>
              모든 기록
            </DropdownMenuRadioItem>
            {groups.map((g) => (
              <DropdownMenuRadioItem key={g.label} value={g.label} closeOnClick>
                <span className="truncate" title={g.label}>
                  {g.label}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The widths of the row go on the box that comes and goes; the field fills it. */}
      <Reveal open={!!group} className={cn("flex min-w-0", className)}>
        {group && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="세부 날짜" title={round ? roundName(group, round) : rows[0].name} className={cn(MENU_TRIGGER, "flex-1")}>
              <span className="truncate">{round ? roundName(group, round) : rows[0].name}</span>
              <ChevronDown className={MENU_ARROW} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" collisionAvoidance={BELOW} className="max-h-[min(20rem,var(--available-height))] w-72">
              <DropdownMenuRadioGroup value={round ? round.id : NONE} onValueChange={(next) => onPick(group.label, next === NONE ? "" : String(next))}>
                {rows.map((r, i) => {
                  const t = tallies[i];
                  return (
                    <DropdownMenuRadioItem key={r.id} value={r.id} closeOnClick className="gap-3 py-1.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate", i === 0 && "font-semibold")} title={r.name}>
                          {r.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground" title={sub(t)}>
                          {sub(t)}
                        </span>
                      </span>
                      {t && t.delta !== null && <Delta v={t.delta} className="text-[13px]" />}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Reveal>
    </>
  );
}

/**
 * One line under the 모아보기 fields while an event is picked (A안): the event, its rounds and dates, and what the
 * cards under it add up to. The profit reads "제외" when nothing in it had one.
 */
export function EventStrip({ group, round, tally, unit, deltaLabel, destroy }: { group: EventGroup; round?: EventRound; tally: EventTally; unit: string; deltaLabel: string; destroy?: number }) {
  const oldest = group.rounds.at(-1);
  const newest = group.rounds[0];
  const when = round ? roundName(group, round) : oldest && newest ? `${group.rounds.length}회 · ${roundDates(oldest.from, newest.to)}` : "";
  return (
    <Card className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-primary/40 bg-primary-soft/40 px-4 py-2.5 text-[13px] shadow-none">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-bold">
        <span className={cn(CHIP, "border-primary/50 bg-primary-soft text-primary-text")}>{group.label}</span>
        {when}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>
          <span className="text-muted-foreground">{unit}</span> <b className="font-num whitespace-nowrap">{tally.count.toLocaleString("ko-KR")}번</b>
        </span>
        <span>
          <span className="text-muted-foreground">사용 메소</span> <b className="font-num whitespace-nowrap">{eok(tally.spent)}</b>
        </span>
        <span>
          <span className="text-muted-foreground">{deltaLabel}</span> {tally.delta === null ? <b className="text-muted-foreground">제외</b> : <Delta v={tally.delta} />}
        </span>
        {destroy !== undefined && (
          <span>
            <span className="text-muted-foreground">파괴</span> <b className="font-num whitespace-nowrap">{destroy}번</b>
          </span>
        )}
      </span>
    </Card>
  );
}

/** Under a card while an event (not one round) is picked: how many of its rounds the card was in ("샤타포스 4회 중 3회"). */
export function RoundsIn({ group, n }: { group: EventGroup; n: number }) {
  return <span className="mt-2 text-xs font-semibold text-primary-text">{`${group.name ? group.label : "이벤트"} ${group.rounds.length}회 중 ${n}회`}</span>;
}

/** A menu button that reads like the fields next to it. The `after` box makes it 40px tall to the finger. */
const MENU_TRIGGER =
  "relative inline-flex h-8 min-w-0 items-center tile-sm pr-8 pl-2.5 text-left text-[13px] text-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
/** The arrow of a menu button or a select. Its glyph has 3.5px of air inside its box, so the box sits 6px in for the glyph to stand 10px in like the text. */
const MENU_ARROW = "pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground";

export type Sort = "spent" | "delta" | "recent";
const SORT_LABEL: Record<Sort, string> = { spent: "많이 쓴 순", delta: "이득 큰 순", recent: "최근 순" };

/**
 * 모아보기 order, and (star force) the low-star switch in the same menu (B안, user 2026-11-14). The button says when
 * low stars are hidden, so the switch is not lost inside the menu.
 */
export function SortMenu({ value, onChange, hideLow, onHideLow, className }: { value: Sort; onChange: (sort: Sort) => void; hideLow?: boolean; onHideLow?: (v: boolean) => void; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="정렬" title={`${SORT_LABEL[value]}${onHideLow && hideLow ? " · 12성 이상" : ""}`} className={cn(MENU_TRIGGER, className)}>
        <span className="truncate">
          {SORT_LABEL[value]}
          {onHideLow && hideLow ? " · 12성 이상" : ""}
        </span>
        <ChevronDown className={MENU_ARROW} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionAvoidance={BELOW} className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as Sort)}>
          {(Object.keys(SORT_LABEL) as Sort[]).map((sort) => (
            <DropdownMenuRadioItem key={sort} value={sort} closeOnClick>
              {SORT_LABEL[sort]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {onHideLow && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={!!hideLow} onCheckedChange={(checked) => onHideLow(checked)}>
              12성 미만 숨기기
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Native select with our own arrow: the browser one sits flush against the right edge. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex min-w-0">
      <select
        {...props}
        className={cn(
          // 16px on a phone: iOS zooms the page in on a field with smaller text.
          "h-8 min-w-0 appearance-none rounded-md border border-border bg-background pr-8 pl-2.5 text-base text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-[13px]",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown className={MENU_ARROW} aria-hidden="true" />
    </span>
  );
}

const BADGE = {
  event: "border-primary/50 bg-primary-soft text-primary-text",
  plain: "tile-edge text-muted-foreground",
};

/** What was on for one try. 샤타포스 = the discount and the destroy cut together, so it gets one badge of its own. */
export function TryBadges({ row, restored }: { row: SfRow; restored: boolean }) {
  const out: [string, string][] = [];
  if (row.set === "shining") out.push(["샤타포스", BADGE.event]);
  else {
    if (row.sale) out.push([`${row.sale}% 할인`, BADGE.event]);
    if (row.cut) out.push([`파괴 ${row.cut}% 감소`, BADGE.event]);
  }
  if (row.sr >= 100) out.push(["100% 성공", BADGE.event]);
  if (row.plus) out.push(["1+1", BADGE.event]);
  if (row.pr) out.push(["파괴 방지", BADGE.plain]);
  if (row.map) out.push(["이벤트맵", BADGE.plain]);
  if (restored) out.push(["확정 복구", BADGE.plain]);
  if (row.sc) out.push(["스타캐치", BADGE.plain]);
  if (row.via) out.push([row.via, BADGE.plain]);
  if (out.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {out.map(([label, css]) => (
        <span key={label} className={cn(CHIP, css)}>
          {label}
        </span>
      ))}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[1rem] border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
