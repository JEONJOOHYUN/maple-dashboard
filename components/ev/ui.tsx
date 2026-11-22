"use client";

import { useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { LUCK_LEVELS, triesAt } from "@/lib/ev/luck";
import { koreanUnits } from "@/lib/format";
import { caretAfter, cleanNumberText, forwardDeleteText, groupDigits, keptBefore } from "@/lib/number-text";
import { Digits } from "@/components/ui/digits";
import { cn } from "@/lib/utils";
import { SteadyText } from "@/components/ui/steady-text";

/** Card section used by every calculator tab. */
export function Panel({ className, children, ref }: { className?: string; children: ReactNode; ref?: Ref<HTMLElement> }) {
  return (
    <section ref={ref} className={cn("flex min-w-0 flex-col gap-3.5 tile p-4 sm:p-5", className)}>
      {children}
    </section>
  );
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
        // 36px to look at, 40px to press: the area reaches 2px above and below (chips sit 6px apart).
        "relative h-9 min-w-0 rounded-lg border px-3 text-[13px] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-0.5 enabled:active:scale-[0.96] disabled:cursor-default",
        on && !soft && "border-transparent bg-primary font-bold text-primary-foreground",
        on && soft && "border-primary bg-primary-soft font-bold text-primary-text",
        !on && soft && "border-dashed border-border bg-transparent text-muted-foreground",
        !on && !soft && "border-transparent bg-background text-foreground shadow-tile enabled:hover:bg-muted enabled:hover:shadow-tile-hover",
        className
      )}
    >
      {/* Picked chips turn bold: the unseen bold copy keeps the chip, and so its neighbours, where they were. */}
      <SteadyText>{children}</SteadyText>
    </button>
  );
}

/**
 * Segmented control (tabs inside a muted track). `hint` = a short note shown above the option on mouse hover or
 * keyboard focus (user, 2026-11-16); neither exists on a phone, so anything a phone needs stays on screen.
 * A `disabled` option cannot be picked and says so (dimmed, no hover, no press).
 */
export function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { id: T; label: ReactNode; hint?: string; disabled?: boolean }[];
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-0.5 rounded-xl bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = value === o.id;
        const props = {
          type: "button" as const,
          role: "radio",
          "aria-checked": on,
          disabled: o.disabled,
          onClick: () => onChange(o.id),
          className: cn(
            "h-[34px] min-w-0 truncate rounded-lg text-[13px] transition-[background-color,color,box-shadow,scale] duration-150 ease-out enabled:active:scale-[0.96] disabled:opacity-40",
            // The transparent border is the pill's edge where shadows are not drawn (forced colours); it takes its 1px
            // from the padding, so the words have the same room picked or not.
            on ? "border border-transparent bg-card px-[7px] font-bold text-foreground shadow-tile" : "px-2 text-muted-foreground enabled:hover:text-foreground"
          ),
        };
        const content = (
          <>
            {o.label}
            {o.hint && <span className="sr-only">, {o.hint}</span>}
          </>
        );
        // A label that is cut can still be read whole.
        if (!o.hint)
          return (
            <button key={o.id} {...props} title={typeof o.label === "string" ? o.label : undefined}>
              {content}
            </button>
          );
        // The hint is plain CSS, shown under the pointer and on keyboard focus. Not the shared Tooltip: this file is
        // on every calculator page, and the popup library behind that part put 32KB (compressed) on the two pages that
        // did not have it (MVP · 핀볼). Outside the button (it truncates), pinned to the track's edge at either end.
        return (
          <span key={o.id} className="group/seg relative flex min-w-0">
            <button {...props} className={cn(props.className, "flex-1")}>
              {content}
            </button>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1.5 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium whitespace-nowrap text-background opacity-0 shadow-sm transition-opacity duration-150 ease-out group-focus-within/seg:opacity-100 group-hover/seg:opacity-100",
                i === 0 ? "left-0" : i === options.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
              )}
            >
              {o.hint}
            </span>
          </span>
        );
      })}
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
      // tile-edge has a 1px border: the padding is 1px less each way, so the switch keeps its size.
      className="press-static flex w-full items-center gap-3 rounded-lg tile-edge bg-background px-[11px] py-[9px] text-left hover:shadow-tile-hover"
    >
      <span className={cn("flex h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors", on ? "bg-primary" : "bg-border")}>
        <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-4")} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[13px]">{label}</b>
        {note && <span className="text-[11px] leading-snug text-muted-foreground">{note}</span>}
      </span>
    </button>
  );
}

/**
 * Small number field. The parent keeps the plain text ("1234.5", so "1." or "" can be typed) and parses it;
 * the field shows it with commas ("1,234.5") and keeps the caret after the same digit while commas come and go.
 */
export function NumberField({
  value,
  onChange,
  label,
  suffix,
  decimal,
  placeholder,
  className,
  inputClassName,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  suffix?: string;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Digits typed before the caret, waiting until the grouped text is on screen.
  const pending = useRef<number | null>(null);
  const putCaret = () => {
    const el = ref.current;
    const kept = pending.current;
    if (!el || kept === null) return;
    pending.current = null;
    if (document.activeElement !== el) return;
    const at = caretAfter(el.value, kept, decimal);
    el.setSelectionRange(at, at);
  };
  useLayoutEffect(putCaret);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-muted-foreground", className)}>
      <input
        ref={ref}
        aria-label={label}
        inputMode={decimal ? "decimal" : "numeric"}
        disabled={disabled}
        value={groupDigits(String(value ?? ""))}
        placeholder={placeholder}
        onChange={(e) => {
          const el = e.target;
          const caret = el.selectionStart ?? el.value.length;
          const forward = (e.nativeEvent as InputEvent).inputType === "deleteContentForward";
          const text = forward ? forwardDeleteText(el.value, caret, String(value ?? ""), decimal) : el.value;
          pending.current = keptBefore(text, caret, decimal);
          onChange(cleanNumberText(text, decimal));
          // When the text stays the same (a comma deleted) nothing re-renders: put the caret back after React restores it.
          requestAnimationFrame(putCaret);
        }}
        className={cn(
          // 16px on a phone whatever size the caller asks for: under that, iOS zooms the page in when the field is tapped.
          "h-9 w-20 min-w-0 rounded-lg border border-input bg-background px-2 text-right font-num text-[15px] font-bold text-foreground transition-[border-color,box-shadow] duration-150 ease-out outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 max-sm:text-base",
          inputClassName
        )}
      />
      {suffix}
    </span>
  );
}

export const parseNum = (text: string, fallback = 0) => {
  // Saved settings from older versions may hold a number instead of text.
  const n = parseFloat(typeof text === "string" ? text.replace(/,/g, "") : String(text));
  return Number.isFinite(n) ? n : fallback;
};

/** The − / + of a stepper, one look for every tab: the caller adds its size and radius. */
export const stepButton = "flex shrink-0 items-center justify-center tile-edge disabled:opacity-40";
/** How an arrow that marks open / closed turns (down = closed, up = open), the same in every tab. */
export const arrowTurn = "transition-[rotate] duration-200 ease-out motion-reduce:transition-none";
/** One hover for every dashed button of the calculators: the edge turns orange and the words darken. */
export const dashedHover = "hover:border-primary/60 hover:text-foreground";

/** Big orange result card. */
/** The orange card a tab's answer sits on: the same shell on every tab, each with its own lines inside. */
export const RESULT_SHELL = "flex flex-col rounded-[1rem] bg-primary px-5 py-4 text-primary-foreground";

export function ResultCard({ label, big, unit, side, foot }: { label: ReactNode; big: ReactNode; unit?: string; side?: ReactNode; foot?: ReactNode }) {
  return (
    <div className={cn(RESULT_SHELL, "gap-1.5 shadow-[0_10px_30px_var(--primary-soft)]")}>
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-num text-[36px] leading-none font-bold sm:text-[44px]">
          {big}
          {unit && <span className="ml-1 text-[0.42em]">{unit}</span>}
        </span>
        {side && <b className="font-num text-lg">{typeof side === "string" || typeof side === "number" ? <Digits>{side}</Digits> : side}</b>}
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
        const tries = Number.isFinite(n) ? `${koreanUnits(n)}${unit}` : "—";
        // Meso first when there is a price; the count goes underneath.
        return cost && Number.isFinite(n) ? <LuckBox key={l.q} label={l.label} value={cost(n)} sub={tries} /> : <LuckBox key={l.q} label={l.label} value={tries} />;
      })}
    </div>
  );
}

/** `onPage`: the box stands on the page itself, not inside a tile, so it is a tile of its own instead of a well. */
export function LuckBox({ label, value, sub, onPage }: { label: string; value: string; sub?: string; onPage?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 p-3", onPage ? "tile" : "rounded-lg bg-background")}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="font-num text-lg">
        <Digits>{value}</Digits>
      </b>
      {sub && (
        <span title={sub} className="truncate font-num text-xs text-muted-foreground">
          <Digits>{sub}</Digits>
        </span>
      )}
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

/**
 * Meso label in Korean units (만 · 억 · 조 · 경 change every 10,000):
 * under 1억 "6,341만", under 1조 "9.15억" / "5,062억", from 1조 "21조 5,107억".
 */
export function eok(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  if (meso === 0) return "0";
  const abs = Math.abs(meso);
  if (abs < 1e4) return Math.round(meso).toLocaleString("ko-KR");
  if (abs < 9999.5e4) return `${Math.round(meso / 1e4).toLocaleString("ko-KR")}만`;
  const e = meso / 1e8;
  if (abs < 999.995e8) return `${(Math.round(e * 100) / 100).toLocaleString("ko-KR")}억`;
  if (abs < 9999.5e8) return `${Math.round(e).toLocaleString("ko-KR")}억`;
  return koreanUnits(meso);
}

/** Averages in tables (destroys · tries): fixed decimals with commas, Korean units from 10,000. */
export function avg(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 9999.5) return koreanUnits(n);
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Tries · items: one decimal under 100, Korean units from 10,000 ("3만 8,136번"). */
export function count(n: number, unit = "번"): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 9999.5) return koreanUnits(n) + unit;
  return `${(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("ko-KR")}${unit}`;
}
