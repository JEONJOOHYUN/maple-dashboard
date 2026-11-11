"use client";

import { useState } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import { pct } from "@/components/ev/ui";
import { OPTION_GROUPS, type CustomCond, type SlotOption } from "@/lib/ev/potential";
import { cn } from "@/lib/utils";

const MAX_SETS = 4;
const STAT_CATS = new Set(["str", "dex", "int", "luk"]);
const MAX_CONDS = 3;

/** "보스 데미지 60%" · "공격력 +32" · "쓸만한 샤프 아이즈 1줄" (for the goal line). */
export function condText(option: SlotOption | undefined, min: number): string {
  if (!option) return "";
  if (option.label.endsWith(" +")) return `${option.label}${min}`;
  return `${option.label.replace(/ %$/, "")} ${min}${option.unit}`;
}

const stepButton =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 disabled:hover:border-border";

/**
 * "직접" goal builder: each set looks like the in-game potential box. A row is one option with the total it must
 * reach over the three lines; only options the slot can roll are offered, and the stepper moves through totals that exist.
 */
export function CustomGoal({
  options,
  sets,
  onChange,
  chanceOf,
  slotLabel,
  gradeLabel,
}: {
  options: SlotOption[];
  sets: CustomCond[][];
  onChange: (sets: CustomCond[][]) => void;
  chanceOf: (set: CustomCond[]) => number;
  slotLabel: string;
  gradeLabel: string;
}) {
  // Which row is choosing an option: row = index to replace, or the set's length to add one.
  const [picking, setPicking] = useState<{ set: number; row: number } | null>(null);
  const byCat = new Map(options.map((o) => [o.cat, o]));

  const setConds = (si: number, conds: CustomCond[]) => onChange(sets.map((s, i) => (i === si ? conds : s)));
  const pick = (si: number, row: number, option: SlotOption) => {
    const conds = [...sets[si]];
    conds[row] = { cat: option.cat, min: option.base };
    setConds(si, conds);
    setPicking(null);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {sets.map((conds, si) => {
        const p = chanceOf(conds);
        // An empty set has nothing to show but the list, so it stays open.
        const open = conds.length === 0 ? { set: si, row: 0 } : picking?.set === si ? picking : null;
        return (
          <div key={si} className="flex flex-col gap-2.5">
            {si > 0 && (
              <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                또는
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-900 dark:border-zinc-600">
              <div className="flex items-center gap-2 bg-zinc-900 py-1.5 pr-1.5 pl-3 text-white">
                <b className="text-[13px]">세트 {si + 1}</b>
                <span className="text-xs font-bold text-emerald-300">{gradeLabel}</span>
                <span className="ml-auto text-xs text-zinc-300">
                  {conds.length ? (
                    <>
                      1번에 <b className="font-num text-white">{pct(p)}</b>
                    </>
                  ) : (
                    "옵션 고르기"
                  )}
                </span>
                {sets.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`세트 ${si + 1} 지우기`}
                    onClick={() => {
                      onChange(sets.filter((_, i) => i !== si));
                      setPicking(null);
                    }}
                    className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/50"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="h-8 w-1.5" />
                )}
              </div>

              {conds.map((cond, ri) => {
                const option = byCat.get(cond.cat);
                if (!option) return null;
                const at = option.sums.indexOf(cond.min);
                const step = (d: number) => setConds(si, conds.map((c, i) => (i === ri ? { ...c, min: option.sums[at + d] } : c)));
                const replacing = open?.row === ri;
                return (
                  <div key={cond.cat} className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2.5">
                    <button
                      type="button"
                      aria-expanded={replacing}
                      aria-label={`${option.label} · 다른 옵션으로 바꾸기`}
                      onClick={() => setPicking(replacing ? null : { set: si, row: ri })}
                      className={cn(
                        "flex h-10 min-w-0 flex-1 basis-[150px] items-center justify-between gap-2 rounded-lg border bg-card px-3 text-left text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        replacing ? "border-primary text-primary-text" : "border-border hover:border-primary/60"
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", replacing && "rotate-180")} aria-hidden="true" />
                    </button>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button type="button" aria-label={`${option.label} 낮추기`} disabled={at <= 0} onClick={() => step(-1)} className={stepButton}>
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <b className="w-[5.5rem] text-center font-num text-[15px]">
                        {cond.min}
                        {option.unit} 이상
                      </b>
                      <button type="button" aria-label={`${option.label} 올리기`} disabled={at >= option.sums.length - 1} onClick={() => step(1)} className={stepButton}>
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${option.label} 빼기`}
                        onClick={() => {
                          setConds(si, conds.filter((_, i) => i !== ri));
                          setPicking(null);
                        }}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col gap-2.5 bg-muted/40 px-3 py-2.5">
                {conds.length > 0 && conds.length < MAX_CONDS && (
                  <button
                    type="button"
                    aria-expanded={open?.row === conds.length}
                    onClick={() => setPicking(open?.row === conds.length ? null : { set: si, row: conds.length })}
                    className={cn(
                      "flex h-10 items-center justify-between gap-2 rounded-lg border px-3 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      open?.row === conds.length ? "border-primary bg-primary-soft text-primary-text" : "border-dashed border-border text-muted-foreground hover:border-primary/60"
                    )}
                  >
                    + 옵션 추가
                    <ChevronDown className={cn("size-4 shrink-0", open?.row === conds.length && "rotate-180")} aria-hidden="true" />
                  </button>
                )}
                {open &&
                  OPTION_GROUPS.map((group) => {
                    const list = options.filter((o) => o.group === group.id);
                    if (!list.length) return null;
                    return (
                      <div key={group.id} className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {list.map((o) => {
                            // Already in this set (other than the row being replaced): one row per option.
                            const used = conds.some((c, i) => c.cat === o.cat && i !== open.row);
                            const current = conds[open.row]?.cat === o.cat;
                            return (
                              <button
                                key={o.cat}
                                type="button"
                                title={o.label}
                                disabled={used}
                                aria-pressed={current}
                                onClick={() => (current ? setPicking(null) : pick(si, open.row, o))}
                                className={cn(
                                  "h-10 min-w-0 truncate rounded-lg border px-2 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                  current
                                    ? "border-primary bg-primary-soft font-bold text-primary-text"
                                    : used
                                      ? "border-border bg-muted text-muted-foreground"
                                      : "border-border bg-card hover:border-primary/60"
                                )}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {conds.length === 0 && <span className="text-[11px] text-muted-foreground">{slotLabel}에 뜨는 옵션만 · 한 세트에 3개까지</span>}
                {conds.some((c) => STAT_CATS.has(c.cat)) && <span className="text-[11px] text-muted-foreground">STR · DEX · INT · LUK % 는 올스탯 % 줄도 더해서 셈</span>}
                {conds.length >= MAX_CONDS && !open && <span className="text-[11px] text-muted-foreground">옵션을 누르면 다른 옵션으로 바꿈</span>}
              </div>
            </div>
          </div>
        );
      })}

      {sets.length < MAX_SETS && sets.every((s) => s.length > 0) && (
        <button
          type="button"
          onClick={() => {
            onChange([...sets, []]);
            setPicking(null);
          }}
          className="h-10 rounded-lg border border-dashed border-border text-[13px] font-bold outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          + 세트 추가 (또는)
        </button>
      )}
    </div>
  );
}
