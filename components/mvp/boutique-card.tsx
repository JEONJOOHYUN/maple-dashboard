"use client";

import { useMemo } from "react";
import { LuckBox, NumberField, Segment, parseNum } from "@/components/ev/ui";
import { LUCK_LEVELS } from "@/lib/ev/luck";
import { koreanUnits } from "@/lib/format";
import { fewestTickets, shareAtLeast, ticketsAtTop, ticketsPer10 } from "@/lib/mvp/boutique";

export type BoutiqueTab = "before" | "after";

/** Largest input the exact share is worked out for (1,000 opens × 10,000 tickets ≈ 0.1 s). */
const MAX_OPENS = 1000;
const MAX_TICKETS = 10_000;

const PER_10 = ticketsPer10();
const PER_10_ALL = ticketsPer10(true);
// 상위 10% · 절반 · 상위 90% of ten opens: fixed by the table, worked out once.
const LUCK = LUCK_LEVELS.map((l) => ({ label: l.label, tickets: ticketsAtTop(l.q) }));

const meso = (tickets: number, ticketMan: number) => `${koreanUnits(tickets * ticketMan * 10_000)}`;

/**
 * 부티크 기프트 (user, 2026-11-17, 시안 D1): "까기 전" = what ten opens usually give, "이미 깐 것" = how one's own opens
 * went (share of people with as many or more, and the 1만원당 it came to).
 */
export function BoutiqueCard({
  tab,
  onTab,
  ticketMan,
  cashPer10,
  opened,
  onOpened,
  per10k,
  pgaPer10k,
}: {
  tab: BoutiqueTab;
  onTab: (tab: BoutiqueTab) => void;
  /** One 부티크 티켓, 만 메소. */
  ticketMan: number;
  /** Cash for ten gifts (33,000). */
  cashPer10: number;
  opened: { n: string; t: string };
  onOpened: (next: { n: string; t: string }) => void;
  /** 1만원당 for `eok` 억 of auction sales bought with `cash` (credit included like the ranking). */
  per10k: (eok: number, cash: number) => number;
  pgaPer10k: number | null;
}) {
  const n = Math.round(parseNum(opened.n, 0));
  const t = Math.round(parseNum(opened.t, 0));
  const fewest = fewestTickets(n);
  const tooBig = n > MAX_OPENS || t > MAX_TICKETS;
  const ready = n > 0 && t > 0 && t >= fewest && !tooBig;
  const share = useMemo(() => (ready ? shareAtLeast(n, t) : null), [ready, n, t]);
  const top = share === null ? "" : share < 0.01 ? "상위 1% 안" : `상위 ${Math.round(share * 100)}%`;
  const won = ready ? per10k((t * ticketMan) / 10_000, (n * cashPer10) / 10) : 0;
  const perGift = n > 0 ? t / n : 0;
  const vsAvg = (perGift / (PER_10 / 10) - 1) * 100;

  return (
    <section className="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[15px]">부티크 기프트</b>
        <Segment
          label="부티크 기프트 보기"
          value={tab}
          onChange={onTab}
          options={[
            { id: "before", label: "까기 전" },
            { id: "after", label: "이미 깐 것" },
          ]}
          className="w-52"
        />
      </div>

      {tab === "before" ? (
        <>
          <span className="text-xs text-muted-foreground">10개 기준 · 10번째는 피버(최소 10개) · 티켓 {ticketMan.toLocaleString("ko-KR")}만</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {LUCK.map((l) => (
              <LuckBox key={l.label} label={l.label} value={meso(l.tickets, ticketMan)} sub={`티켓 ${l.tickets}개`} />
            ))}
          </div>
          <span className="text-xs leading-relaxed text-muted-foreground">
            평균 {PER_10.toFixed(1)}개(500개 이상 대박은 뺌 · 넣으면 {PER_10_ALL.toFixed(1)}개) · 판매가는 수수료 전
          </span>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background pr-1 pl-3 text-[13px] text-muted-foreground">
              <span className="truncate">깐 개수</span>
              <NumberField label="깐 부티크 기프트 개수" value={opened.n} onChange={(v) => onOpened({ ...opened, n: v })} suffix="개" inputClassName="h-8 w-16" />
            </label>
            <label className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background pr-1 pl-3 text-[13px] text-muted-foreground">
              <span className="truncate">받은 티켓</span>
              <NumberField label="받은 부티크 티켓 개수" value={opened.t} onChange={(v) => onOpened({ ...opened, t: v })} suffix="개" inputClassName="h-8 w-16" />
            </label>
          </div>
          {ready ? (
            <div className="flex flex-col gap-1 rounded-lg border border-primary bg-primary-soft px-4 py-3">
              <span className="text-xs text-muted-foreground">같은 개수 깐 사람 중</span>
              <b className="font-num text-[26px] leading-tight text-primary-text">{top}</b>
              <span className="text-[13px]">
                1개당 <b className="font-num">{perGift.toFixed(2)}개</b> · 대박 빼고 평균 {(PER_10 / 10).toFixed(2)}개{" "}
                <span className="whitespace-nowrap">
                  ({vsAvg >= 0 ? "+" : ""}
                  {vsAvg.toFixed(1)}%)
                </span>
              </span>
              <span className="text-[13px]">
                판매가 <b className="font-num">{meso(t, ticketMan)}</b> → 1만원당 <b className="font-num">{Math.round(won).toLocaleString("ko-KR")}원</b>
                {pgaPer10k ? <span className="whitespace-nowrap"> · 플가 대비 {(won / pgaPer10k).toFixed(2)}</span> : null}
              </span>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-[13px] text-muted-foreground">
              {tooBig
                ? `${MAX_OPENS.toLocaleString("ko-KR")}개 · 티켓 ${MAX_TICKETS.toLocaleString("ko-KR")}개까지 계산`
                : n > 0 && t > 0
                  ? `${n}개면 티켓이 최소 ${fewest}개 → 숫자 확인`
                  : "깐 개수 · 받은 티켓 → 같은 개수 깐 사람 중 몇 %인지"}
            </p>
          )}
          <span className="text-xs text-muted-foreground">10번째마다 피버 · 판매 기간이 바뀌면 처음부터 셈</span>
        </>
      )}
    </section>
  );
}
