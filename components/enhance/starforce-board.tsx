"use client";

import { useMemo, useState } from "react";
import { eok } from "@/components/ev/ui";
import { PeriodBar, SyncBanners, ViewTabs, usePeriod, useSync } from "@/components/enhance/board-bits";
import { Card, Delta, Empty, SKIP_LABEL, Select } from "@/components/enhance/parts";
import { CalendarView, InsightView, ItemDialog, ItemsView, LogView } from "@/components/enhance/starforce-views";
import { resolveItem, type ItemInfo, type ItemOverrides } from "@/lib/enhance/items";
import { NO_DISCOUNT, judge, trackCopies, type Discount, type SkipReason } from "@/lib/enhance/judge";
import type { MvpGrade } from "@/lib/ev/starforce";
import { DAY, dayStart, kstStamp } from "@/lib/enhance/kst";
import { buildStats, type Entry } from "@/lib/enhance/stats";
import { StarforceSync } from "@/lib/enhance/sync";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

type View = "insight" | "log" | "items" | "cal";
const VIEWS: { id: View; label: string }[] = [
  { id: "insight", label: "강화 요약" },
  { id: "log", label: "강화 내역" },
  { id: "items", label: "모아보기" },
  { id: "cal", label: "달력" },
];

const NO_OVERRIDES: ItemOverrides = { levels: {}, spares: {} };
const MVPS: { id: MvpGrade; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "silver", label: "실버" },
  { id: "gold", label: "골드" },
  { id: "diamond", label: "다이아+" },
];

export function StarforceBoard({ apiKey, account, onForget }: { apiKey: string; account: string; onForget: () => void }) {
  const period = usePeriod();
  const { from, to } = period;
  const [view, setView] = useState<View>("insight");
  const [hideLow, setHideLow] = useState(true);
  const [worldsOff, setWorldsOff] = useState<string[]>([]);
  /** Key of the item whose tries are open in the window ("" = closed). */
  const [openItem, setOpenItem] = useState("");
  const [overrides, setOverrides] = useStored<ItemOverrides>("enhance:items", NO_OVERRIDES);
  // The API does not say which discounts a try had, so the user sets them once for every try.
  const [discount, setDiscount] = useStored<Discount>("enhance:discount", NO_DISCOUNT);

  const [sync] = useState(() => new StarforceSync(apiKey, account));
  const { snap, loading, refresh } = useSync(sync, from, to, StarforceSync.serverSnapshot);

  // Pieces and restored destroys are read from the item's neighbouring tries, so they need every loaded try, not only the filtered ones.
  const tracked = useMemo(() => trackCopies(snap.rows), [snap.rows]);
  const inPeriod = useMemo(() => {
    const start = dayStart(from);
    const end = dayStart(to) + DAY;
    return snap.rows.filter((r) => r.t >= start && r.t < end);
  }, [snap.rows, from, to]);
  const worlds = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of inPeriod) count.set(r.world, (count.get(r.world) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [inPeriod]);
  const entries = useMemo<Entry[]>(() => {
    const infos = new Map<string, ItemInfo>();
    return inPeriod
      .filter((r) => !worldsOff.includes(r.world))
      .map((row) => {
        let info = infos.get(row.item);
        if (!info) infos.set(row.item, (info = resolveItem(row.item, snap.found, overrides)));
        return { row, info, j: judge(row, info, tracked.restored.has(row.id), discount), copy: tracked.copy.get(row.id) ?? 1 };
      });
  }, [inPeriod, worldsOff, snap.found, overrides, tracked, discount]);
  const stats = useMemo(() => buildStats(entries), [entries]);

  // Rows are oldest first: the last one is the newest try NEXON has given us.
  const latest = snap.rows.at(-1)?.t ?? 0;
  const skipped = (Object.entries(stats.skipped) as [SkipReason, number][]).filter(([, n]) => n > 0);
  const noLevel = stats.items.filter((it) => it.info.level <= 0).length;
  const tiles = [
    { label: "성공", value: stats.success.toLocaleString("ko-KR"), css: "" },
    { label: "실패", value: stats.fail.toLocaleString("ko-KR"), css: "" },
    { label: "파괴", value: stats.destroy.toLocaleString("ko-KR"), css: stats.destroy ? "text-destructive" : "" },
    { label: "사용 메소", value: eok(stats.spent), css: "" },
  ];

  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]" data-clarity-mask="true">
      <PeriodBar
        state={period}
        loading={loading}
        onRefresh={refresh}
        onForget={onForget}
        status={
          snap.at > 0 && (
            <span>
              {latest > 0 && <>마지막 강화 {kstStamp(latest)} · </>}
              {kstStamp(snap.at)} 조회 · 게임 → 기록 반영 최대 5분
            </span>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          MVP
          <Select aria-label="MVP 등급" value={discount.mvp} onChange={(e) => setDiscount({ ...discount, mvp: e.target.value as MvpGrade })}>
            {MVPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={discount.pcRoom} onChange={(e) => setDiscount({ ...discount, pcRoom: e.target.checked })} className="size-4 accent-primary" />
          PC방
        </label>
      </div>

      {/* A world that was switched off stays listed, so it can be switched back on after the period changes. */}
      {(worlds.length > 1 || worlds.some(([name]) => worldsOff.includes(name))) && (
        <div role="group" aria-label="월드" className="flex flex-wrap gap-1.5 text-[13px]">
          {worlds.map(([name, n]) => {
            const on = !worldsOff.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => setWorldsOff(on ? [...worldsOff, name] : worldsOff.filter((w) => w !== name))}
                className={cn(
                  "rounded-full px-3 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on ? "bg-primary-soft text-primary-text" : "bg-muted text-muted-foreground"
                )}
              >
                {name} <b className="font-num text-xs">{n.toLocaleString("ko-KR")}</b>
              </button>
            );
          })}
        </div>
      )}

      <SyncBanners snap={snap} unit="일" onRetry={refresh} onForget={onForget} />

      {stats.total === 0 ? (
        snap.status === "done" && <Empty>이 기간에 스타포스 기록 없음</Empty>
      ) : (
        <>
          <Card>
            <div className="grid items-end gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:p-7">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-muted-foreground">기댓값 대비 손익 · {period.label}</span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <Delta v={stats.delta} className="text-[38px] leading-[1.05] lg:text-[52px]" />
                  <span className="text-sm text-muted-foreground">메소</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {tiles.map((t) => (
                  <div key={t.label} className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                    <b className={cn("truncate font-num text-lg", t.css)}>{t.value}</b>
                  </div>
                ))}
              </div>
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-5 pb-3.5 text-xs text-muted-foreground lg:px-7">
              <span>
                기록 {stats.total.toLocaleString("ko-KR")}건 → 손익 계산 {stats.judged.toLocaleString("ko-KR")}건
              </span>
              {skipped.length > 0 && <span>· 제외: {skipped.map(([why, n]) => `${SKIP_LABEL[why]} ${n.toLocaleString("ko-KR")}`).join(" · ")}</span>}
              {noLevel > 0 && view !== "items" && (
                <button type="button" onClick={() => setView("items")} className="font-semibold text-primary-text underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  레벨 모르는 장비 {noLevel}개 → 입력
                </button>
              )}
            </p>
          </Card>

          <ViewTabs views={VIEWS} value={view} onChange={setView} />

          {view === "insight" && <InsightView stats={stats} onOpen={setOpenItem} />}
          {view === "log" && <LogView entries={entries} characters={stats.characters} hideLow={hideLow} onHideLow={setHideLow} />}
          {view === "items" && <ItemsView stats={stats} overrides={overrides} onOverrides={setOverrides} onOpen={setOpenItem} />}
          {view === "cal" && <CalendarView stats={stats} from={from} to={to} />}
          <ItemDialog key={openItem} item={stats.items.find((it) => it.key === openItem) ?? null} entries={entries} onClose={() => setOpenItem("")} />
        </>
      )}
    </div>
  );
}
