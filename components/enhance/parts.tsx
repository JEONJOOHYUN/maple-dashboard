"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, Package } from "lucide-react";
import { eok } from "@/components/ev/ui";
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

export function Delta({ v, className }: { v: number; className?: string }) {
  return <b className={cn("font-num whitespace-nowrap", tone(v), className)}>{signed(v)}</b>;
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
