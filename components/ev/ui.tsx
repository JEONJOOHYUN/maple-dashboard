"use client";

import type { ReactNode } from "react";
import { LUCK_LEVELS, triesAt } from "@/lib/ev/luck";
import { cn } from "@/lib/utils";

/** Card section used by every calculator tab. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-card p-4 sm:p-5", className)}>{children}</section>;
}

export function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{children}</span>
      {aside}
    </div>
  );
}

/** Pill chip: on = filled orange. `soft` = outlined orange (e.g. recommended, not clickable). */
export function Chip({
  on,
  soft,
  onClick,
  disabled,
  className,
  children,
  title,
}: {
  on: boolean;
  soft?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      className={cn(
        "h-9 min-w-0 rounded-lg border px-3 text-[13px] whitespace-nowrap transition-colors disabled:cursor-default",
        on && !soft && "border-primary bg-primary font-bold text-primary-foreground",
        on && soft && "border-primary bg-primary-soft font-bold text-primary-text",
        !on && soft && "border-dashed border-border bg-transparent text-muted-foreground",
        !on && !soft && "border-border bg-card text-foreground hover:border-primary/60",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Segmented control (tabs inside a muted track). */
export function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-0.5 rounded-lg bg-muted p-[3px]", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-[34px] min-w-0 truncate rounded-md px-2 text-[13px] transition-colors",
            value === o.id ? "bg-card font-bold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, note }: { on: boolean; onChange: (on: boolean) => void; label: string; note?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-left"
    >
      <span className={cn("flex h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors", on ? "justify-end bg-primary" : "justify-start bg-border")}>
        <span className="size-5 rounded-full bg-white shadow-sm" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[13px]">{label}</b>
        {note && <span className="text-[11px] leading-snug text-muted-foreground">{note}</span>}
      </span>
    </button>
  );
}

/** Small number field. Keeps the raw text so "1." or "" can be typed; parent gets the parsed number. */
export function NumberField({
  value,
  onChange,
  label,
  suffix,
  decimal,
  placeholder,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  suffix?: string;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-muted-foreground", className)}>
      <input
        aria-label={label}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "").slice(0, 12))}
        className={cn(
          "h-9 w-20 min-w-0 rounded-lg border border-input bg-background px-2 text-right font-num text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/40",
          inputClassName
        )}
      />
      {suffix}
    </span>
  );
}

export const parseNum = (text: string, fallback = 0) => {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : fallback;
};

/** Big orange result card. */
export function ResultCard({ label, big, unit, side, foot }: { label: ReactNode; big: ReactNode; unit?: string; side?: ReactNode; foot?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-primary px-5 py-4 text-primary-foreground shadow-[0_10px_30px_var(--primary-soft)]">
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-num text-[36px] leading-none font-bold sm:text-[44px]">
          {big}
          {unit && <span className="ml-1 text-[0.42em]">{unit}</span>}
        </span>
        {side && <b className="font-num text-lg">{side}</b>}
      </span>
      {foot && <span className="text-xs font-semibold opacity-85">{foot}</span>}
    </div>
  );
}

/** 운 좋으면 / 절반 / 운 나쁘면 boxes for a geometric chance. `cost` turns a try count into a money label. */
export function LuckRow({ p, cap = 0, cost, unit = "번" }: { p: number; cap?: number; cost?: (n: number) => string; unit?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LUCK_LEVELS.map((l) => {
        const n = triesAt(p, l.q, cap);
        const tries = Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}${unit}` : "—";
        // Meso first when there is a price; the count goes underneath.
        return cost && Number.isFinite(n) ? <LuckBox key={l.q} label={l.label} value={cost(n)} sub={tries} /> : <LuckBox key={l.q} label={l.label} value={tries} />;
      })}
    </div>
  );
}

export function LuckBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="font-num text-lg">{value}</b>
      {sub && <span className="truncate font-num text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

export function pct(x: number): string {
  if (!Number.isFinite(x) || x <= 0) return "불가";
  const v = x * 100;
  return `${v < 0.1 ? v.toFixed(4) : v.toFixed(2)}%`;
}

/** 억 · 만 short label for meso. */
export function eok(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  if (meso === 0) return "0";
  const e = meso / 1e8;
  if (Math.abs(e) >= 1000) return `${Math.round(e).toLocaleString("ko-KR")}억`;
  if (Math.abs(e) >= 1) return `${(Math.round(e * 100) / 100).toLocaleString("ko-KR")}억`;
  return `${Math.round(meso / 1e4).toLocaleString("ko-KR")}만`;
}

export function count(n: number, unit = "번"): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("ko-KR")}${unit}`;
}
