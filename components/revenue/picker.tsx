"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus, Search } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { bossRows, type SchedulerState } from "@/lib/revenue/calc";
import { MAX_PICKED, SCAN_MIN_LEVEL } from "@/lib/revenue/data";
import { cn } from "@/lib/utils";
import type { Char } from "@/components/revenue/use-data";

/** A NEXON account in use: its key's name, its colour dot and how its character list came back. */
export type AccountView = { account: string; label: string; color: string; chars: Char[]; error?: string; loading: boolean };

const chip = "h-[34px] rounded-[9px] px-3 text-[13px] font-semibold whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "bg-card text-foreground shadow-(--tile-shadow)";

function Tabs({ items, value, onChange, label }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-[3px] overflow-x-auto rounded-xl bg-muted p-[3px]">
      {items.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id)} className={cn(chip, value === t.id && chipOn)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function CharCard({ c, on, boss, color, onToggle, disabled }: { c: Char; on: boolean; boss?: number; color?: string; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled && !on}
      onClick={onToggle}
      className={cn(
        "flex min-h-[60px] items-center gap-2.5 rounded-xl bg-background px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
        on ? "bg-primary/14 shadow-[inset_0_0_0_2px_var(--primary)]" : "hover:shadow-[inset_0_0_0_1px_var(--input)]"
      )}
    >
      <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px]", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {on && <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold" title={c.name}>{c.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          Lv.{c.level} · {c.job} ·{" "}
          <span className="inline-flex items-center gap-1">
            {color && <i aria-hidden="true" className="inline-block size-[7px] rounded-full" style={{ background: color }} />}
            {c.world}
          </span>
        </span>
      </span>
      {!!boss && <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-primary/14 px-[7px] pt-0.5 text-[11px] font-bold whitespace-nowrap text-primary-text">보스 {boss}</span>}
    </button>
  );
}

/**
 * Who the revenue page follows: the characters of every key in use, those with a weekly boss list first (picked for
 * the user the first time), the rest folded away. At most 36.
 */
export function Picker({
  accounts,
  chars: all,
  states,
  picked,
  onPick,
  onDone,
  onAdd,
  onRemove,
  onRetry,
}: {
  accounts: AccountView[];
  /** Every character on screen, each once. */
  chars: Char[];
  states: Record<string, SchedulerState | null>;
  picked: string[];
  onPick: (next: string[]) => void;
  onDone: () => void;
  onAdd: () => void;
  onRemove: (account: string) => void;
  /** Asks again for the character lists that failed. */
  onRetry: () => void;
}) {
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState("all");
  const [world, setWorld] = useState("all");
  const [restOpen, setRestOpen] = useState(false);
  const colorOf = (account: string) => (accounts.length > 1 ? accounts.find((a) => a.account === account)?.color : undefined);
  const bossCount = (c: Char) => bossRows(states[c.ocid]).filter((r) => !r.monthly).length;
  const scanned = all.filter((c) => c.level >= SCAN_MIN_LEVEL);
  const waiting = scanned.filter((c) => !(c.ocid in states)).length;
  const worlds = [...new Set(all.map((c) => c.world))];
  const set = new Set(picked);
  const keep = (c: Char) => (acc === "all" || c.account === acc) && (world === "all" || c.world === world) && (!q.trim() || c.name.includes(q.trim()));
  const withBoss = all.filter((c) => bossCount(c) > 0 && keep(c));
  const rest = all.filter((c) => bossCount(c) === 0 && keep(c));
  const full = set.size >= MAX_PICKED;
  const toggle = (ocid: string) => onPick(set.has(ocid) ? picked.filter((x) => x !== ocid) : [...picked, ocid]);
  const allOn = withBoss.length > 0 && withBoss.every((c) => set.has(c.ocid));
  const toggleAll = () => {
    if (allOn) return onPick(picked.filter((x) => !withBoss.some((c) => c.ocid === x)));
    const add = withBoss.filter((c) => !set.has(c.ocid)).map((c) => c.ocid);
    onPick([...new Set([...picked, ...add])].slice(0, MAX_PICKED));
  };
  const showRest = restOpen || !!q.trim();

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-2.5 tile p-4">
        <div className="flex flex-col gap-0.5 px-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
          <h2 className="text-[15px] font-bold">등록한 API 키</h2>
          <span className="text-[13px] text-muted-foreground">키 하나 = 그 키를 만든 넥슨 계정 · 이 브라우저에만 저장</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
          {accounts.map((a) => (
            <div key={a.account} className="flex min-h-[60px] items-center gap-2.5 rounded-xl bg-background px-3 py-2.5">
              <i aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-sm" title={a.label}>{a.label}</b>
                <span className="text-xs text-muted-foreground">
                  {a.loading ? "캐릭터 받는 중…" : a.error ? a.error : `캐릭터 ${a.chars.length}명 · 보스 있는 캐릭터 ${a.chars.filter((c) => bossCount(c) > 0).length}명`}
                </span>
              </span>
              {a.error && (
                <button type="button" onClick={onRetry} className="h-[30px] shrink-0 rounded-lg px-2 text-xs font-bold text-primary-text outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                  다시
                </button>
              )}
              <button type="button" onClick={() => onRemove(a.account)} className="h-[30px] shrink-0 rounded-lg px-2 text-xs font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                빼기
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--border)] outline-none hover:bg-primary/14 hover:shadow-[inset_0_0_0_1.5px_var(--primary)] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
            API 키 추가
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 tile px-[18px] py-4">
        <div>
          <b>보스 돌 캐릭터 고르기</b>
          <p className="text-[13px] text-muted-foreground">스케줄러에 주간 보스가 있는 캐릭터를 골라 뒀어요 · 최대 {MAX_PICKED}명</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-input bg-background px-3 text-muted-foreground focus-within:border-ring sm:w-[200px]">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="캐릭터 이름" aria-label="캐릭터 이름으로 찾기" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none sm:text-sm" />
          </label>
          {accounts.length > 1 && <Tabs label="계정" value={acc} onChange={setAcc} items={[{ id: "all", label: "모든 계정" }, ...accounts.map((a) => ({ id: a.account, label: a.label }))]} />}
          {worlds.length > 1 && <Tabs label="월드" value={world} onChange={setWorld} items={[{ id: "all", label: "전체" }, ...worlds.map((w) => ({ id: w, label: w }))]} />}
        </div>
      </section>

      <section className="tile p-4">
        <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5">
          <b className="text-[15px]">
            보스가 있는 캐릭터 <span className="font-num text-muted-foreground">{withBoss.length}</span>
          </b>
          {waiting > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground" aria-live="polite">
              <Spinner /> 스케줄러 확인 중… {scanned.length - waiting} / {scanned.length}
            </span>
          ) : (
            withBoss.length > 0 && (
              <button type="button" onClick={toggleAll} className="h-8 rounded-lg px-1.5 text-[13px] font-bold text-primary-text outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {allOn ? "모두 빼기" : "모두 고르기"}
              </button>
            )
          )}
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {withBoss.map((c) => (
            <CharCard key={c.ocid} c={c} on={set.has(c.ocid)} boss={bossCount(c)} color={colorOf(c.account)} onToggle={() => toggle(c.ocid)} disabled={full} />
          ))}
        </div>
        {withBoss.length === 0 && waiting === 0 && <p className="px-1.5 text-[13px] text-muted-foreground">스케줄러에 주간 보스가 등록된 캐릭터가 없어요 · 아래 나머지에서 고르기</p>}
      </section>

      <section className="tile p-4">
        <div className="flex items-center justify-between gap-2 px-1.5">
          <b className="text-[15px]">
            나머지 <span className="font-num text-muted-foreground">{rest.length}</span>
          </b>
          <button type="button" onClick={() => setRestOpen((v) => !v)} aria-expanded={showRest} className="h-8 rounded-lg px-1.5 text-[13px] font-bold text-primary-text outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {showRest ? "접기" : "펼치기"}
          </button>
        </div>
        <Reveal open={showRest} className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((c) => (
              <CharCard key={c.ocid} c={c} on={set.has(c.ocid)} color={colorOf(c.account)} onToggle={() => toggle(c.ocid)} disabled={full} />
            ))}
        </Reveal>
      </section>

      <div className="flex items-center justify-between gap-3 tile px-[18px] py-3.5">
        <div>
          <b className="font-num text-lg">{picked.length}</b>
          <span className="text-muted-foreground"> 명 골랐어요{accounts.length > 1 ? ` · 계정 ${accounts.length}개 합쳐서` : ""} · 다음에도 이대로</span>
        </div>
        <button
          type="button"
          onClick={onDone}
          disabled={!picked.length}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-primary px-[18px] text-sm font-bold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          보스 수익 보기
          <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
