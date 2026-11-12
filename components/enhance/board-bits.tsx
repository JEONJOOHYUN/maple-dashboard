"use client";

// What the star force board and the potential board share: the period, the sync wiring and its banners, the tab row.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { ApiErrorKind } from "@/lib/enhance/client";
import { addDays, kstDate } from "@/lib/enhance/kst";
import type { HistorySync, SyncSnap } from "@/lib/enhance/sync";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

type PeriodId = "7d" | "30d" | "1y" | "all" | "custom";
const PERIODS: { id: PeriodId; label: string; days: number }[] = [
  { id: "7d", label: "최근 7일", days: 7 },
  { id: "30d", label: "최근 30일", days: 30 },
  { id: "1y", label: "최근 1년", days: 365 },
  // The API keeps two years.
  { id: "all", label: "전체 2년", days: 730 },
  { id: "custom", label: "기간 설정", days: 0 },
];

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음 → 키 다시 입력",
  quota: "이 키의 호출 한도 초과 (하루 1,000회) → 받은 기록까지만 표시 · 내일 이어받기",
  param: "넥슨 API 응답 오류 → 받은 기록까지만 표시",
  busy: "넥슨 API 점검 중 → 받은 기록까지만 표시",
  network: "넥슨 서버 연결 실패 → 받은 기록까지만 표시",
  failed: "넥슨 API 응답 오류 → 받은 기록까지만 표시",
};

const dateInput = "h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const plainButton = "h-8 rounded-md border border-border bg-card px-2.5 text-[13px] text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

export type PeriodState = ReturnType<typeof usePeriod>;

/** The period both boards look at (kept in the browser, so the two tabs and the next visit agree). */
export function usePeriod() {
  // The boards only render after hydration, so the clock is never 0 here.
  const today = kstDate(useNow());
  const oldest = addDays(today, -729);
  const [period, setPeriod] = useStored<PeriodId>("enhance:period", "30d");
  const [custom, setCustom] = useStored<{ from: string; to: string }>("enhance:custom", { from: "", to: "" });
  const days = PERIODS.find((p) => p.id === period)?.days ?? 30;
  const clamp = (d: string) => (d < oldest ? oldest : d > today ? today : d);
  const to = period === "custom" && custom.to ? clamp(custom.to) : today;
  const from = period === "custom" ? clamp(custom.from && custom.from <= to ? custom.from : addDays(to, -29)) : addDays(today, -(days - 1));
  const label = period === "custom" ? `${from} ~ ${to}` : (PERIODS.find((p) => p.id === period)?.label ?? "");
  return { period, setPeriod, custom, setCustom, today, oldest, from, to, label };
}

/** Runs the sync for the period. `refresh()` asks NEXON again even when today was fetched a moment ago; a period change does not. */
export function useSync<T extends { t: number; who: string; item: string }>(sync: HistorySync<T>, from: string, to: string, serverSnapshot: () => SyncSnap<T>) {
  const snap = useSyncExternalStore(sync.subscribe, sync.getSnapshot, serverSnapshot);
  const [tick, setTick] = useState(0);
  const seen = useRef(0);
  useEffect(() => {
    const force = tick !== seen.current;
    seen.current = tick;
    sync.load(from, to, force);
    return () => sync.stop();
  }, [sync, from, to, tick]);
  return { snap, loading: snap.status === "loading" || snap.status === "idle", refresh: () => setTick((n) => n + 1) };
}

/** Period buttons on the left; when the records were read, refresh and forget on the right; the date fields under it. */
export function PeriodBar({ state, status, loading, onRefresh, onForget }: { state: PeriodState; status: ReactNode; loading: boolean; onRefresh: () => void; onForget: () => void }) {
  const { period, setPeriod, custom, setCustom, today, oldest, from, to } = state;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="기간" className="flex flex-wrap gap-[3px] rounded-lg border border-border p-[3px]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "h-[30px] rounded-md px-3 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                period === p.id ? "bg-primary-soft font-bold text-primary-text" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!loading && status}
          <button type="button" onClick={onRefresh} disabled={loading} className={cn(plainButton, "inline-flex items-center gap-1.5 disabled:opacity-50")}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
            새로 고침
          </button>
          <button type="button" onClick={onForget} className={plainButton}>
            키 · 기록 지우기
          </button>
        </div>
      </div>
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <input type="date" aria-label="시작일" value={custom.from || from} min={oldest} max={to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={dateInput} />
          ~
          <input type="date" aria-label="종료일" value={custom.to || to} min={oldest} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={dateInput} />
        </div>
      )}
    </>
  );
}

/** "기록 받는 중 n / m" while loading; what went wrong, with the way out, on an error. `unit` = what done / total count. */
export function SyncBanners({ snap, unit, onRetry, onForget }: { snap: Pick<SyncSnap<unknown>, "status" | "done" | "total" | "error">; unit: string; onRetry: () => void; onForget: () => void }) {
  const loading = snap.status === "loading" || snap.status === "idle";
  return (
    <>
      {loading && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-[13px]">
            <Loader2 className="size-4 animate-spin text-primary-text" aria-hidden="true" />
            기록 받는 중
            {snap.total > 0 && (
              <b className="font-num">
                {snap.done.toLocaleString("ko-KR")} / {snap.total.toLocaleString("ko-KR")}
                {unit}
              </b>
            )}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${snap.total ? (snap.done / snap.total) * 100 : 0}%` }} />
          </span>
        </div>
      )}
      {snap.status === "error" && snap.error && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px]">
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <span className="min-w-0 flex-1 basis-48 font-semibold">{ERRORS[snap.error]}</span>
          <button type="button" onClick={snap.error === "badKey" ? onForget : onRetry} className={cn(plainButton, "px-3 font-semibold")}>
            {snap.error === "badKey" ? "키 다시 입력" : "다시 시도"}
          </button>
        </div>
      )}
    </>
  );
}

export function ViewTabs<T extends string>({ views, value, onChange }: { views: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" aria-label="강화 기록 보기" className="flex gap-0.5 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            "h-10 shrink-0 px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === v.id ? "font-bold text-primary-text shadow-[inset_0_-2px_0_var(--primary)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
