"use client";

import type { ComponentProps } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { chip, focus, hoverRing, pickedRing } from "@/components/revenue/styles";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// The pieces of a "pick your characters" screen, shared by boss revenue and homework. Nothing here knows about
// bosses or prices, so a screen that uses it does not load them.

const tab = cn("h-[34px] rounded-[9px] px-3 text-[13px] font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground", focus);
const tabOn = "bg-card text-foreground shadow-(--tile-shadow)";
/** A card in the lists: an account, a character. */
export const pickCard = "flex min-h-[60px] items-center gap-2.5 rounded-xl bg-background px-3 py-2.5";
/** A text button in a section's head. */
export const headBtn = cn("h-8 rounded-lg px-1.5 text-[13px] font-bold text-primary-text", focus);
export const charGrid = "grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4";

export function Tabs({ items, value, onChange, label }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    // Wraps inside what holds it (an account can have a dozen worlds); never wider than that.
    <div role="radiogroup" aria-label={label} className="flex w-fit max-w-full flex-wrap gap-[3px] rounded-xl bg-muted p-[3px]">
      {items.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id)} className={cn(tab, value === t.id && tabOn)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** The field that narrows the characters by name. */
export function NameSearch({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-input bg-background px-3 text-muted-foreground focus-within:border-ring sm:w-[200px]">
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="캐릭터 이름" aria-label="캐릭터 이름으로 찾기" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none sm:text-sm" />
    </label>
  );
}

/** The way out of a picker: on to the page the characters were picked for. `busy` = the pick is being saved. */
export function GoButton({ busy, className, children, ...rest }: ComponentProps<"button"> & { busy?: boolean }) {
  return (
    <button type="button" {...rest} className={cn("inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-[18px] text-sm font-bold text-primary-foreground hover:bg-primary/85 disabled:opacity-50", focus, className)}>
      {children}
      {busy ? <Spinner /> : <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />}
    </button>
  );
}

/** A character to pick. `boss` = its weekly bosses, `color` = its account's dot when several accounts are on show. */
export function CharCard({ c, on, boss, color, onToggle, disabled }: { c: { name: string; level: number; job: string; world: string }; on: boolean; boss?: number; color?: string; onToggle: () => void; disabled: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled && !on} onClick={onToggle} className={cn(pickCard, "text-left disabled:opacity-45", focus, on ? pickedRing : hoverRing)}>
      <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px]", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {on && <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold" title={c.name}>
          {c.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Lv.{c.level} · {c.job} ·{" "}
          <span className="inline-flex items-center gap-1">
            {color && <i aria-hidden="true" className="inline-block size-[7px] rounded-full" style={{ background: color }} />}
            {c.world}
          </span>
        </span>
      </span>
      {!!boss && <span className={cn(chip, "ml-auto bg-primary/14 text-primary-text")}>보스 {boss}</span>}
    </button>
  );
}
