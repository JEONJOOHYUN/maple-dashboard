"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, Package } from "lucide-react";
import { eok } from "@/components/ev/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EventRound } from "@/lib/enhance/events";
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
  return <section className={cn("min-w-0 rounded-lg border border-border bg-card", className)}>{children}</section>;
}

/** How many rows a ranking card shows; the rest are in its window. */
export const RANK_TOP = 3;

/**
 * A ranking card's title, with "더보기" on the right when the list is longer than the card shows (user, 2026-11-14).
 * In the title row so the button sits at the same height on every card of a row, whatever their lengths.
 */
export function RankHead({ title, more, onMore }: { title: string; more: boolean; onMore: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {more && (
        <button type="button" onClick={onMore} className="rounded-sm text-xs font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          더보기
        </button>
      )}
    </div>
  );
}

/** The whole ranking a card shows the top of, in a window like an item's; a row opens that item (user, 2026-11-14). */
export function RankDialog({ title, count, open, onClose, children }: { title: string; count: number; open: boolean; onClose: () => void; children: ReactNode }) {
  // Focus goes to the list, not to its first row.
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent initialFocus={listRef} className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" data-clarity-mask="true">
        <div className="flex flex-col gap-1 border-b border-border p-4 pr-12">
          <DialogTitle className="text-base leading-tight font-bold">{title}</DialogTitle>
          <DialogDescription className="text-xs">{count.toLocaleString("ko-KR")}개 · 누르면 그 아이템의 내역</DialogDescription>
        </div>
        <div ref={listRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none [&>*:first-child]:border-t-0">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Delta({ v, className }: { v: number; className?: string }) {
  return <b className={cn("font-num whitespace-nowrap", tone(v), className)}>{signed(v)}</b>;
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

/** Small label on a card (a count, a streak). */
export const CHIP = "rounded border border-border px-1.5 text-[11px] leading-[18px] font-semibold whitespace-nowrap";

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
export function Gauge({ label, used, mean, children }: { label: ReactNode; used: number; mean: number; children: ReactNode }) {
  const scale = Math.max(used, mean) * 1.15 || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
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

const ALL_ROUNDS = "\u0000all";
/**
 * Menus of a long list stay under their field, shorter and scrolling when the room below runs out: by default they
 * flipped above it once the list was taller than that room (user, 2026-11-14).
 */
export const BELOW = { side: "none" } as const;

/**
 * 모아보기 event round pick: "모든 기록" or one round. Hidden while there are no rounds.
 * A menu like the item list (opens below, 256px, scrolls): two years of rounds made a native list taller than the
 * room under it, so it opened upwards (user, 2026-11-14).
 */
export function RoundSelect({ rounds, value, onChange, className }: { rounds: EventRound[]; value: string; onChange: (id: string) => void; className?: string }) {
  if (rounds.length === 0) return null;
  const picked = rounds.find((r) => r.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="이벤트 회차" className={cn(MENU_TRIGGER, "sm:max-w-[240px]", className)}>
        <span className="truncate">{picked?.label ?? "모든 기록"}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionAvoidance={BELOW} className="max-h-[min(16rem,var(--available-height))] w-64">
        <DropdownMenuRadioGroup value={picked ? picked.id : ALL_ROUNDS} onValueChange={(next) => onChange(next === ALL_ROUNDS ? "" : String(next))}>
          <DropdownMenuRadioItem value={ALL_ROUNDS} closeOnClick>
            모든 기록
          </DropdownMenuRadioItem>
          {rounds.map((r) => (
            <DropdownMenuRadioItem key={r.id} value={r.id} closeOnClick>
              <span className="truncate">{r.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A menu button that reads like the fields next to it. */
const MENU_TRIGGER =
  "relative inline-flex h-8 min-w-0 items-center rounded-md border border-border bg-card pr-8 pl-2.5 text-left text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export type Sort = "spent" | "delta" | "recent";
const SORT_LABEL: Record<Sort, string> = { spent: "많이 쓴 순", delta: "이득 큰 순", recent: "최근 순" };

/**
 * 모아보기 order, and (star force) the low-star switch in the same menu (B안, user 2026-11-14). The button says when
 * low stars are hidden, so the switch is not lost inside the menu.
 */
export function SortMenu({ value, onChange, hideLow, onHideLow, className }: { value: Sort; onChange: (sort: Sort) => void; hideLow?: boolean; onHideLow?: (v: boolean) => void; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="정렬" className={cn(MENU_TRIGGER, className)}>
        <span className="truncate">
          {SORT_LABEL[value]}
          {onHideLow && hideLow ? " · 12성 이상" : ""}
        </span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
          "h-8 min-w-0 appearance-none rounded-md border border-border bg-background pr-8 pl-2.5 text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </span>
  );
}

const BADGE = {
  event: "border-primary/50 bg-primary-soft text-primary-text",
  plain: "border-border text-muted-foreground",
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
        <span key={label} className={cn("rounded border px-1.5 text-[11px] leading-[18px] font-semibold whitespace-nowrap", css)}>
          {label}
        </span>
      ))}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
