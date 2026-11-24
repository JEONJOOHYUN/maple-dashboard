"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { IntentLink } from "@/components/intent-link";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { bossRows, type SchedulerState } from "@/lib/revenue/calc";
import { MAX_PICKED, SCAN_MIN_LEVEL } from "@/lib/revenue/data";
import { cn } from "@/lib/utils";
import { CharCard, GoButton, NameSearch, Tabs, charGrid, headBtn, pickCard as card } from "@/components/revenue/pick-parts";
import { focus } from "@/components/revenue/styles";
import type { Char } from "@/components/revenue/use-data";

/** A NEXON account in use: its key's name, its colour dot and how its character list came back. */
export type AccountView = { account: string; label: string; color: string; chars: Char[]; error?: string; loading: boolean };

/** A small button on an account card. */
const cardBtn = cn("h-[30px] shrink-0 rounded-lg px-2 text-xs hover:bg-muted", focus);
const plus = <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />;
/** The tile after the account cards: one more account. */
const addTile = cn("flex min-h-[60px] items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--border)] hover:bg-primary/14 hover:shadow-[inset_0_0_0_1.5px_var(--primary)]", focus);

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
  registered,
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
  /** The accounts are the ones connected to the signed-in member: added and deleted on 내 정보, not here. */
  registered?: boolean;
}) {
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState("all");
  const [world, setWorld] = useState("all");
  const [restOpen, setRestOpen] = useState(false);
  const colorOf = (account: string) => (accounts.length > 1 ? accounts.find((a) => a.account === account)?.color : undefined);
  const counts = new Map(all.map((c) => [c.ocid, bossRows(states[c.ocid]).filter((r) => !r.monthly).length]));
  const bossCount = (c: Char) => counts.get(c.ocid) ?? 0;
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
    if (allOn) {
      const off = new Set(withBoss.map((c) => c.ocid));
      return onPick(picked.filter((x) => !off.has(x)));
    }
    const add = withBoss.filter((c) => !set.has(c.ocid)).map((c) => c.ocid);
    onPick([...new Set([...picked, ...add])].slice(0, MAX_PICKED));
  };
  const showRest = restOpen || !!q.trim();

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-2.5 tile p-4">
        <div className="flex flex-col gap-0.5 px-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
          <h2 className="text-[15px] font-bold">{registered ? "연결한 넥슨 계정" : "등록한 API 키"}</h2>
          <span className="text-[13px] text-muted-foreground">{registered ? "내 정보에 등록한 키 · 어느 기기에서든 같이 봄" : "키 하나 = 그 키를 만든 넥슨 계정 · 이 브라우저에만 저장"}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
          {accounts.map((a) => (
            <div key={a.account} className={card}>
              <i aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-sm" title={a.label}>{a.label}</b>
                <span className="text-xs text-muted-foreground">
                  {a.loading ? "캐릭터 받는 중…" : a.error ? a.error : `캐릭터 ${a.chars.length}명 · 보스 있는 캐릭터 ${a.chars.filter((c) => bossCount(c) > 0).length}명`}
                </span>
              </span>
              {a.error && (
                <button type="button" onClick={onRetry} className={cn(cardBtn, "font-bold text-primary-text")}>
                  다시
                </button>
              )}
              {!registered && (
                <button type="button" onClick={() => onRemove(a.account)} className={cn(cardBtn, "font-semibold text-muted-foreground hover:text-foreground")}>
                  빼기
                </button>
              )}
            </div>
          ))}
          {registered ? (
            <IntentLink href="/me" className={addTile}>
              {plus}
              내 정보에서 추가 · 삭제
            </IntentLink>
          ) : (
            <button type="button" onClick={onAdd} className={addTile}>
              {plus}
              API 키 추가
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 tile px-[18px] py-4">
        <div>
          <b>보스 돌 캐릭터 고르기</b>
          <p className="text-[13px] text-muted-foreground">스케줄러에 주간 보스가 있는 캐릭터를 골라 뒀어요 · 최대 {MAX_PICKED}명</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <NameSearch value={q} onChange={setQ} />
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
              <button type="button" onClick={toggleAll} className={headBtn}>
                {allOn ? "모두 빼기" : "모두 고르기"}
              </button>
            )
          )}
        </div>
        <div className={charGrid}>
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
          <button type="button" onClick={() => setRestOpen((v) => !v)} aria-expanded={showRest} className={headBtn}>
            {showRest ? "접기" : "펼치기"}
          </button>
        </div>
        <Reveal open={showRest} className={cn("mt-2.5", charGrid)}>
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
        <GoButton onClick={onDone} disabled={!picked.length} className="shrink-0">
          보스 수익 보기
        </GoButton>
      </div>
    </div>
  );
}
