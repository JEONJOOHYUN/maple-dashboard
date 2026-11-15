"use client";

import { useEffect, useRef, useState } from "react";
import { Label, Panel } from "@/components/ev/ui";
import { Input } from "@/components/ui/input";
import { BUILD_LETTERS, type AbilityMode } from "@/lib/ev/ability";
import type { ClassAbility } from "@/lib/ev/ability-classes";
import { cn } from "@/lib/utils";

const words = (letters: string) => [...letters].map((c) => BUILD_LETTERS[c]?.label ?? c);
const COLS = "grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)]";

/**
 * 직업별 추천 어빌리티 (user, 2026-11-15: C안, in the empty space under the inputs, about three rows then scroll).
 * A row calculates that class's build for the reset picked above; the reset's column of the picked row is highlighted.
 */
export function ClassAbilityTable({
  classes,
  picked,
  mode,
  onPick,
}: {
  classes: ClassAbility[];
  picked: string | null;
  mode: AbilityMode;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const shown = q ? classes.filter((c) => c.name.includes(q)) : classes;
  // Keep the picked row in view inside the list (e.g. after clearing the search), without scrolling the page.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = row.offsetTop - 2;
  }, [picked, q]);

  return (
    <Panel>
      <Label aside={<span className="text-[11px] text-muted-foreground">{classes.length}직업</span>}>직업별 추천 어빌리티</Label>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="직업 찾기" aria-label="직업 찾기" className="h-9" />
      <div className={cn("grid items-end gap-2 px-2.5 text-[11px] text-muted-foreground", COLS)} aria-hidden="true">
        <span className="font-semibold">직업</span>
        <span className="flex flex-col">
          <span className="font-semibold">고급 재설정</span>
          레전드리 3줄
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">일반 재설정</span>
          레전 1 + 유니크 2
        </span>
      </div>
      {/* Three rows and the top of a fourth, so it reads as a scrolling list (user: about three, then scroll). Rows are
          one line where the panel is wide (sm single column, xl two columns), two lines where it is narrow (phones, lg). */}
      <ul
        ref={listRef}
        className="relative -mt-1.5 flex max-h-[200px] flex-col gap-0.5 overflow-y-auto sm:max-h-[134px] lg:max-h-[200px] xl:max-h-[134px]"
      >
        {shown.map((c) => {
          const on = c.name === picked;
          const full = words(c.full).join(" · ");
          const [lead, ...rest] = words(c.practical);
          const normal = `${lead} + ${rest.join(" · ")}`;
          return (
            <li key={c.name}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${c.name}${c.collector ? "(콜렉터 쓸 때)" : ""}: 고급 재설정 ${full}, 일반 재설정 레전드리 ${lead}, 유니크 ${rest.join(" · ")}`}
                onClick={() => onPick(c.name)}
                className={cn(
                  "grid w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  COLS,
                  on ? "bg-primary-soft" : "hover:bg-muted",
                )}
              >
                <span className={cn("min-w-0", on && "font-bold")}>
                  {c.name}
                  {c.collector && "*"}
                </span>
                <span className={cn("min-w-0", on && mode === "l3" && "font-bold text-primary-text")}>{full}</span>
                <span className={cn("min-w-0", on && mode === "l1u2" && "font-bold text-primary-text")}>{normal}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2.5 py-2 text-xs text-muted-foreground">맞는 직업이 없어요</li>}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        누르면 그 조합으로 계산 · 일반은 + 앞이 레전드리 줄 · 공마 = 버프 지속(같은 줄로 계산) · 카이저는 버프 지속도 가능 · *
        콜렉터를 쓸 때만 더 셈
      </p>
    </Panel>
  );
}
