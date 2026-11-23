"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, RotateCw, X } from "lucide-react";
import { NumberField, parseNum } from "@/components/ev/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Digits } from "@/components/ui/digits";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { AUCTION_FEE_OPTIONS, type AuctionFee } from "@/lib/boss-split/boss-split-math";
import { koreanUnits } from "@/lib/format";
import {
  bossRows,
  cellsOf,
  crystalPrice,
  markKey,
  monthlyThisWeek,
  materialValue,
  partyFor,
  priceOf,
  rewardOf,
  share,
  untilReset,
  weekId,
  withParty,
  type Cell,
  type Marks,
  type PartyStore,
  type Prices,
  type SchedulerState,
} from "@/lib/revenue/calc";
import { BOXES, CATEGORIES, DROPS, ITEMS, MATERIALS, iconSrc, isBox, item, maxParty, type Icon, type ItemId } from "@/lib/revenue/data";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";
import { chip, focus, hoverRing, openRing, pickedRing } from "@/components/revenue/styles";
import type { Char } from "@/components/revenue/use-data";

const won = (meso: number) => koreanUnits(meso);
/** In-game difficulty badge colors (matches NEXON's boss difficulty banners), same in both themes: players read these at a glance. */
const DIFF_STYLE: Record<string, { background: string; color: string }> = {
  이지: { background: "linear-gradient(#888888, #666666)", color: "#ffffff" },
  노멀: { background: "linear-gradient(#51b2cc, #319dbc)", color: "#ffffff" },
  하드: { background: "linear-gradient(#bb4466, #aa3355)", color: "#ffffff" },
  카오스: { background: "linear-gradient(#333333, #222233)", color: "#ffe1be" },
  익스트림: { background: "#09090b", color: "#da1b1b" },
};
const mutedChip = cn(chip, "bg-muted text-muted-foreground");

/** Every item that can be counted, with where it comes from, for the price list (data only: built once). */
const PRICE_ITEMS = (Object.keys(ITEMS) as ItemId[]).map((id) => {
  const from = new Set<string>();
  for (const [key, drops] of Object.entries(DROPS)) for (const d of drops) if (d === id || (isBox(d) && (BOXES[d].opts as string[]).includes(id))) from.add(key.split("|")[0]);
  const mat = Object.values(MATERIALS).find((m) => m.box === id);
  return { id, from: ITEMS[id].cat === "ring" ? "보스 반지 상자에서" : [...from].join(" · ") + (mat ? ` · ${mat.name} 10개 = 1상자` : "") };
});

function ItemImg({ icon, className }: { icon: Icon; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny item pictures (ours or NEXON's icon host), shown as is
  return <img src={iconSrc(icon)} alt="" loading="lazy" className={cn("object-contain", className)} />;
}

/**
 * A character's face: the middle of NEXON's 300×300 look picture, where the head stands. The initial until it is here.
 */
function Face({ src, name }: { src?: string; name: string }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted font-bold text-muted-foreground lg:size-10">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- NEXON's character picture, shown as is
        <img src={src} alt="" className="absolute top-[-56px] left-[-56px] size-[150px] max-w-none lg:top-[-62px] lg:left-[-63px] lg:size-[167px]" />
      ) : (
        name[0]
      )}
    </span>
  );
}

/** A popover whose content closes it after a pick: `children(close)`. */
function Pick({ trigger, label, className, children, width }: { trigger: ReactNode; label: string; className: string; children: (close: () => void) => ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={className} aria-label={label}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("gap-1.5 p-2", width ?? "w-max")}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** A row of number buttons, the chosen one filled: party size, auction fee. */
function Segmented({ options, value, onPick, size, text = String, label }: { options: readonly number[]; value: number; onPick: (n: number) => void; size: string; text?: (n: number) => string; label?: (n: number) => string }) {
  return (
    <div className="flex w-max gap-[3px] rounded-[10px] bg-muted p-[3px]">
      {options.map((n) => (
        <button key={n} type="button" aria-label={label?.(n)} aria-pressed={n === value} onClick={() => onPick(n)} className={cn("rounded-[7px] font-num text-sm", size, focus, n === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {text(n)}
        </button>
      ))}
    </div>
  );
}

/** The party size popover of one boss: 1 … its cap. */
function PartyChoice({ r, onPick }: { r: Row; onPick: (n: number) => void }) {
  return (
    <>
      <span className="px-0.5 text-xs text-muted-foreground">파티원 · 최대 {r.cap}인</span>
      <Segmented options={Array.from({ length: r.cap }, (_, i) => i + 1)} value={r.party} onPick={onPick} size="size-8" label={(n) => `${n}명`} />
    </>
  );
}

type Row = { boss: string; diff: string; key: string; monthly: boolean; done: boolean; /** A monthly boss cleared before this week: shown, not counted. */ earlier: boolean; price: number | null; party: number; cap: number; share: number; cells: Cell[]; reward: number; material: number };
type CharView = { c: Char; state: SchedulerState | null | undefined; done: Row[]; left: Row[]; crystal: number; reward: number; leftSum: number; weeklyDone: number; limit: number };

/** The boss revenue of the picked characters this week. */
export function Board({
  chars,
  states,
  prev,
  faces,
  loadedAt,
  now,
  onRefresh,
}: {
  chars: Char[];
  states: Record<string, SchedulerState | null>;
  /** The scheduler on the last day of last week, for monthly bosses. */
  prev: Record<string, SchedulerState | null>;
  /** Look pictures by ocid. */
  faces: Record<string, string>;
  loadedAt: number;
  now: number;
  onRefresh: () => void;
}) {
  const [party, setParty] = useStored<PartyStore>("revenue:party", {});
  const [got, setGot] = useStored<{ week: string; marks: Marks }>("revenue:got", { week: "", marks: {} });
  const [priceText, setPriceText] = useStored<Partial<Record<ItemId, string>>>("revenue:pricesEok", {});
  const [withMat, setWithMat] = useStored<boolean>("revenue:material", true);
  // Auction fee the drops are sold with, shared like the split calculator (its default first).
  const [feeStored, setFee] = useStored<number>("revenue:fee", AUCTION_FEE_OPTIONS[0]);
  const fee: AuctionFee = (AUCTION_FEE_OPTIONS as readonly number[]).includes(feeStored) ? (feeStored as AuctionFee) : AUCTION_FEE_OPTIONS[0];
  const [pricesOpen, setPricesOpen] = useStored<boolean>("revenue:pricesOpen", false);
  // A character's bosses open in a side sheet (user 2026-11-24, instead of rows opening one by one down the page).
  // `sheetId` stays after closing, so the sheet keeps its content while it leaves.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const week = weekId(now);
  const marks: Marks = useMemo(() => (got.week === week ? got.marks : {}), [got, week]);
  const setMark = (k: string, v: string | true | undefined) =>
    setGot((prev) => {
      const base = prev.week === week ? { ...prev.marks } : {};
      if (v === undefined) delete base[k];
      else base[k] = v;
      return { week, marks: base };
    });
  const prices: Prices = useMemo(() => {
    const out: Prices = {};
    for (const [id, t] of Object.entries(priceText)) if (t && t.trim()) out[id as ItemId] = Math.round(parseNum(t) * 10_000);
    return out;
  }, [priceText]);
  const changed = Object.keys(prices).length;

  const views: CharView[] = useMemo(
    () =>
      chars.map((c) => {
        const state = states[c.ocid];
        // A monthly boss cleared before this week still shows (user 2026-11-24), at the end and without money: its
        // crystal and drops belong to the week it was cleared. Not known yet (last week's scheduler not here): left out.
        const rows: Row[] = bossRows(state).flatMap((r) => {
          const thisWeek = r.monthly && r.done ? monthlyThisWeek(r.boss, prev[c.ocid], now) : true;
          if (thisWeek === null) return [];
          const earlier = !thisWeek;
          const price = crystalPrice(r.key);
          const p = partyFor(party, c.ocid, r.boss, r.diff);
          const cells = cellsOf(c.ocid, r.key, marks);
          const material = withMat && !earlier ? materialValue(r.key, prices) : 0;
          const counted = !earlier;
          return [{ ...r, earlier, price, party: p, cap: maxParty(r.boss), share: price && counted ? share(price, p) : 0, cells, reward: r.done && counted ? rewardOf(cells, r.key, prices, withMat, p, fee) : 0, material }];
        });
        const done = rows.filter((r) => r.done).sort((a, b) => Number(a.earlier) - Number(b.earlier));
        const left = rows.filter((r) => !r.done).sort((a, b) => b.share - a.share);
        return {
          c,
          state,
          done,
          left,
          crystal: done.reduce((a, r) => a + r.share, 0),
          reward: done.reduce((a, r) => a + r.reward, 0),
          leftSum: left.reduce((a, r) => a + r.share, 0),
          weeklyDone: done.filter((r) => !r.monthly).length,
          limit: state?.weekly_boss_clear_limit_count ?? 12,
        };
      }),
    [chars, states, prev, now, party, marks, prices, withMat, fee]
  );
  const sheetIdx = views.findIndex((v) => v.c.ocid === sheetId);
  const sheet = sheetIdx >= 0 ? views[sheetIdx] : null;
  const goSheet = (step: number) => setSheetId(views[(sheetIdx + step + views.length) % views.length].c.ocid);
  const crystal = views.reduce((a, v) => a + v.crystal, 0);
  const reward = views.reduce((a, v) => a + v.reward, 0);
  const leftSum = views.reduce((a, v) => a + v.leftSum, 0);
  const leftCount = views.reduce((a, v) => a + v.left.length, 0);
  const weeklyDone = views.reduce((a, v) => a + v.weeklyDone, 0);
  const weeklyLimit = views.reduce((a, v) => a + v.limit, 0);
  const waiting = chars.filter((c) => !(c.ocid in states)).length;
  const failed = chars.filter((c) => states[c.ocid] === null || prev[c.ocid] === null).length;
  const reset = untilReset(now);
  const setP = (ocid: string, r: Row, n: number) => setParty((prev) => withParty(prev, ocid, r.boss, r.diff, n));
  const time = loadedAt ? new Date(loadedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 tile px-4 py-3">
        <div>
          이번 주 ·{" "}
          <b>
            목요일 0시 초기화까지 {reset.days}일 {reset.hours}시간
          </b>
        </div>
        <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
          {waiting > 0 ? (
            <span className="inline-flex items-center gap-1.5" aria-live="polite">
              <Spinner /> 받는 중… {chars.length - waiting} / {chars.length}
            </span>
          ) : (
            time && `${time} 조회`
          )}
          <button type="button" aria-label="새로 고침" onClick={onRefresh} disabled={waiting > 0} className={cn("grid size-8 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50", focus)}>
            <RotateCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {failed > 0 && <p className="px-1 text-[13px] font-semibold text-destructive">{failed}명의 스케줄러를 못 받음 → 새로 고침</p>}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className={cn(stat, "col-span-2 lg:col-span-1")}>
          <span className={statLabel}>이번 주 보스 수익</span>
          <span className="font-num text-[30px] leading-tight text-primary-text lg:text-[34px]">{won(crystal + reward)}</span>
          <span className="text-[13px] text-muted-foreground">
            결정석 <span className="font-num">{won(crystal)}</span> · 보상 <span className="font-num">{won(reward)}</span>
          </span>
        </div>
        <div className={stat}>
          <span className={statLabel}>주간 보스</span>
          <span className="font-num text-xl lg:text-2xl">
            {weeklyDone}
            <span className="text-[0.7em] text-muted-foreground"> / {weeklyLimit}</span>
          </span>
          <span className="text-[13px] text-muted-foreground">캐릭터당 주 12마리</span>
        </div>
        <div className={stat}>
          <span className={statLabel}>남은 보스까지 잡으면</span>
          <span className="font-num text-xl lg:text-2xl">{won(crystal + reward + leftSum)}</span>
          <span className="text-[13px] text-muted-foreground">
            +{won(leftSum)} · {leftCount}마리
          </span>
        </div>
      </div>

      <section className="tile">
        <button type="button" onClick={() => setPricesOpen(!pricesOpen)} aria-expanded={pricesOpen} className={cn("flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-left hover:bg-muted", focus)}>
          <span className="flex flex-wrap items-baseline gap-x-2.5">
            <b className="text-[15px]">보상 가격</b>
            <span className="text-[13px] text-muted-foreground">
              수수료 {fee}% · {changed ? `${changed}개 고침` : "고치기"}
            </span>
          </span>
          <ChevronDown className={cn("size-[18px] text-muted-foreground transition-transform", pricesOpen && "rotate-180")} aria-hidden="true" />
        </button>
        <Reveal open={pricesOpen} className="px-5 pb-3">
            <div className="flex min-h-11 items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-2.5" role="group" aria-label="경매장 수수료">
                <span className="text-[13px] font-semibold">경매장 수수료</span>
                <Segmented options={AUCTION_FEE_OPTIONS} value={fee} onPick={setFee} size="h-8 px-3" text={(n) => `${n}%`} />
              </div>
              {changed > 0 && (
                <button type="button" onClick={() => setPriceText({})} className={cn("text-[13px] font-bold text-primary-text", focus)}>
                  모두 기본값으로
                </button>
              )}
            </div>
            <div className="grid gap-x-7 lg:grid-cols-2">
              {PRICE_ITEMS.map(({ id, from }) => (
                <label key={id} className="grid min-h-[54px] grid-cols-[30px_minmax(0,1fr)_100px] items-center gap-2.5 border-t border-border">
                  <ItemImg icon={ITEMS[id].icon} className="size-[30px]" />
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate text-[13px]" title={ITEMS[id].name}>{ITEMS[id].name}</b>
                    <span className="truncate text-[11px] text-muted-foreground" title={from}>{from}</span>
                  </span>
                  <NumberField
                    value={priceText[id] ?? ""}
                    onChange={(t) => setPriceText((prev) => ({ ...prev, [id]: t }))}
                    label={`${ITEMS[id].name} 개당 가격, 억 메소`}
                    placeholder={(ITEMS[id].price / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                    suffix="억"
                    decimal
                    inputClassName={priceText[id]?.trim() ? "text-primary-text" : undefined}
                  />
                </label>
              ))}
            </div>
        </Reveal>
      </section>

      {leftCount > 0 && (
        <section className="tile px-4 pt-4 pb-3">
          <div className="flex flex-col gap-0.5 px-1 pb-3 lg:flex-row lg:items-baseline lg:justify-between">
            <h2 className="text-[17px] font-bold">
              이번 주 남은 보스 <span className="font-num text-[15px] text-muted-foreground">{leftCount}</span>
            </h2>
            <span className="text-[13px] text-muted-foreground">
              다 잡으면 <span className="font-num text-[15px] text-primary-text">+{won(leftSum)}</span> · 조각을 누르면 파티원 수
            </span>
          </div>
          {views
            .filter((v) => v.left.length)
            .map((v, i) => (
              <div key={v.c.ocid} className={cn("grid gap-2 py-3 lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-4", i > 0 && "border-t border-border")}>
                <div className="flex flex-wrap items-baseline gap-x-2 px-0.5 lg:flex-col lg:gap-0.5 lg:pt-1">
                  <b className="text-[15px]">{v.c.name}</b>
                  <span className="text-xs text-muted-foreground">{v.left.length}마리 남음</span>
                  <span className="ml-auto font-num text-base text-primary-text lg:ml-0">+{won(v.leftSum)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                  {v.left.map((r) => (
                    <Pick
                      key={r.key}
                      className={cn("flex w-full flex-col items-start gap-px rounded-xl bg-background px-3 pt-[9px] pb-2.5 text-left", hoverRing, openRing, focus)}
                      label={`${r.boss} ${r.diff} ${r.party}인, 파티원 고치기`}
                      trigger={
                        <>
                        <span className="max-w-full truncate text-[13px] font-bold" title={r.boss}>{r.boss}</span>
                        <span className="flex items-center gap-[5px] text-xs text-muted-foreground">
                          <span className="inline-flex h-4 items-center rounded px-1 pt-px text-[11px] font-bold" style={DIFF_STYLE[r.diff]}>
                            {r.diff}
                          </span>
                          <b className="text-foreground">{r.party}인</b>
                        </span>
                          <span className="mt-[3px] font-num text-[15px]">{r.price ? won(r.share) : "가격 미정"}</span>
                        </>
                      }
                    >
                      {(close) => <PartyChoice r={r} onPick={(n) => (setP(v.c.ocid, r, n), close())} />}
                    </Pick>
                  ))}
                </div>
              </div>
            ))}
        </section>
      )}

      <section className="flex flex-col gap-1 tile p-2">
        <div className="flex flex-col gap-1.5 px-3 pt-2 pb-1.5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[17px] font-bold">
            잡은 보스 <span className="ml-1 text-[13px] font-normal text-muted-foreground">기본값 1인</span>
          </h2>
          <label className="flex items-center justify-between gap-2.5 text-xs text-muted-foreground lg:text-[13px]">
            장신망 조각 수익
            <button type="button" role="switch" aria-checked={withMat} aria-label="장신망 조각 수익 넣기" onClick={() => setWithMat(!withMat)} className={cn("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors after:absolute after:-inset-2", withMat ? "bg-primary" : "bg-input", focus)}>
              <span className={cn("absolute top-[3px] left-[3px] size-4 rounded-full transition-transform", withMat ? "translate-x-4 bg-primary-foreground" : "bg-card")} />
            </button>
          </label>
        </div>
        {views.map((v) => {
          const yet = v.left.filter((r) => !r.monthly).length;
          const shown = sheetOpen && sheetId === v.c.ocid;
          return (
              <button
                key={v.c.ocid}
                type="button"
                ref={(el) => {
                  if (el) rowRefs.current.set(v.c.ocid, el);
                  else rowRefs.current.delete(v.c.ocid);
                }}
                aria-haspopup="dialog"
                onClick={() => {
                  setSheetId(v.c.ocid);
                  setSheetOpen(true);
                }}
                className={cn("grid w-full grid-cols-[36px_minmax(0,1fr)_auto_20px] items-center gap-x-2.5 gap-y-1.5 rounded-xl px-2 py-2.5 text-left hover:bg-muted lg:grid-cols-[40px_minmax(0,1fr)_210px_150px_28px] lg:gap-3.5 lg:px-3", focus, shown && "bg-muted")}
              >
                <Face src={faces[v.c.ocid]} name={v.c.name} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold" title={v.c.name}>{v.c.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    Lv.{v.c.level} · {v.c.job} · {v.c.world}
                  </span>
                </span>
                <span className="col-span-2 col-start-2 row-start-2 flex flex-col gap-[5px] lg:col-span-1 lg:col-start-3 lg:row-start-1">
                  <span className="grid grid-cols-12 gap-[3px]" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, k) => (
                      <i key={k} className={cn("h-2 rounded-[3px]", k < v.weeklyDone ? "bg-primary" : k < v.weeklyDone + yet ? "shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-muted")} />
                    ))}
                  </span>
                  <span className="flex justify-between text-xs text-muted-foreground">
                    <span>주간 보스</span>
                    <span className="font-num">
                      {v.weeklyDone} / {v.limit}
                    </span>
                  </span>
                </span>
                <span className="text-right font-num text-base lg:text-lg">{v.state === undefined ? <Spinner /> : <Digits>{won(v.crystal + v.reward)}</Digits>}</span>
                <ChevronRight className="size-[18px] text-muted-foreground" aria-hidden="true" />
              </button>
          );
        })}
      </section>

      <Sheet open={sheetOpen && sheetIdx >= 0} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          // Back to the row of the character on show, which prev / next may have changed.
          finalFocus={() => (sheetId && rowRefs.current.get(sheetId)) || true}
          className="gap-0 bg-card p-0 data-[side=right]:w-full data-[side=right]:border-border data-[side=right]:sm:max-w-[720px]"
        >
          {sheet && (
            <>
              <div className="flex items-center gap-3 border-b border-border py-3 pr-2.5 pl-4 lg:pl-5">
                <Face src={faces[sheet.c.ocid]} name={sheet.c.name} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <SheetTitle className="truncate text-[17px] font-bold">{sheet.c.name}</SheetTitle>
                  <SheetDescription className="truncate text-[13px]">
                    Lv.{sheet.c.level} · {sheet.c.job} · 주간 보스 <span className="font-num">{sheet.weeklyDone} / {sheet.limit}</span>
                  </SheetDescription>
                </div>
                {views.length > 1 && (
                  <div className="flex shrink-0 items-center">
                    <button type="button" aria-label="이전 캐릭터" onClick={() => goSheet(-1)} className={sheetIcon}>
                      <ChevronLeft className="size-[18px]" aria-hidden="true" />
                    </button>
                    <span className="min-w-9 text-center font-num text-[13px] text-muted-foreground">
                      {sheetIdx + 1} / {views.length}
                    </span>
                    <button type="button" aria-label="다음 캐릭터" onClick={() => goSheet(1)} className={sheetIcon}>
                      <ChevronRight className="size-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <SheetClose className={sheetIcon} aria-label="닫기">
                  <X className="size-[18px]" aria-hidden="true" />
                </SheetClose>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 pt-4 pb-2 lg:px-5">
                <span className="font-num text-[26px] leading-tight text-primary-text">{won(sheet.crystal + sheet.reward)}</span>
                <span className="text-[13px] text-muted-foreground">
                  결정석 <span className="font-num">{won(sheet.crystal)}</span> · 보상 <span className="font-num">{won(sheet.reward)}</span>
                </span>
              </div>
              <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 lg:px-3">
                <div className={cn("grid min-h-11 grid-cols-6 items-center gap-1 px-2.5 text-xs font-semibold text-muted-foreground", doneCols)}>
                  <span className="hidden @2xl:block">보스</span>
                  <span className="hidden @2xl:block">파티원</span>
                  {CATEGORIES.map((k) => (
                    <span key={k.cat} className="flex flex-col items-center gap-[3px] text-center text-[10px] leading-tight">
                      <ItemImg icon={k.icon} className="size-6" />
                      {k.label}
                    </span>
                  ))}
                  <span className="hidden text-right @2xl:block">결정석 · 보상</span>
                </div>
                {sheet.done.map((r, i) => (
                  <DoneRow
                    key={r.key}
                    r={r}
                    zebra={i % 2 === 1}
                    withMat={withMat}
                    prices={prices}
                    onParty={(n) => setP(sheet.c.ocid, r, n)}
                    onMark={(cat, val) => setMark(markKey(sheet.c.ocid, r.key, cat), val)}
                  />
                ))}
                {!sheet.done.length && <p className="px-3 py-2.5 text-[13px] text-muted-foreground">{sheet.state === null ? "스케줄러를 못 받음 → 새로 고침" : "아직 잡은 보스 없음"}</p>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const stat = "flex flex-col gap-1.5 tile px-4 py-[18px] lg:px-5";
const statLabel = "text-[13px] font-semibold text-muted-foreground";
const sheetIcon = cn("grid size-10 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground", focus);
/**
 * The sheet's table from 672px of room (wide enough for the boss name): crystal and drops share one money column so it
 * fits the 720px sheet. Below that each boss takes two lines.
 */
const doneCols = "@2xl:min-h-[52px] @2xl:grid-cols-[minmax(0,1fr)_64px_repeat(6,40px)_112px] @2xl:gap-1.5 @2xl:px-3";
const doneRow = (zebra: boolean) => cn("grid grid-cols-6 items-center gap-x-1 gap-y-2 rounded-[10px] px-2.5 py-3 @2xl:py-1.5", doneCols, zebra && "bg-background");

function DoneRow({ r, zebra, withMat, prices, onParty, onMark }: { r: Row; zebra: boolean; withMat: boolean; prices: Prices; onParty: (n: number) => void; onMark: (cat: Cell["cat"], val: string | true | undefined) => void }) {
  if (r.earlier)
    return (
      <div className={doneRow(zebra)}>
        {/* No party or drop cells here, so the name may take their room; chips wrap before the name is cut. */}
        <span className="col-span-4 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 @2xl:col-span-8">
          <span className="truncate font-semibold" title={r.boss}>{r.boss}</span>
          <span className={chip} style={DIFF_STYLE[r.diff]}>
            {r.diff}
          </span>
          <span className={mutedChip}>이번 달 잡음</span>
        </span>
        <span className="col-span-2 text-right text-xs text-muted-foreground @2xl:col-span-1 @2xl:col-start-9 @2xl:text-[13px]">지난 주 수익</span>
      </div>
    );
  const mat = MATERIALS[r.key];
  const hasCells = r.cells.some((c) => c.kind !== "none");
  return (
    <div className={doneRow(zebra)}>
      <span className="col-span-4 flex min-w-0 flex-col items-start gap-0.5 @2xl:col-span-1">
        <span className="flex max-w-full items-center gap-2">
          <span className="truncate font-semibold" title={r.boss}>{r.boss}</span>
          <span className={chip} style={DIFF_STYLE[r.diff]}>
            {r.diff}
          </span>
          {r.monthly && <span className={mutedChip}>월간</span>}
        </span>
        {mat && (
          <span className={cn("text-xs", withMat ? "text-foreground" : "text-muted-foreground")}>
            {mat.name} {mat.count}개{withMat ? ` · +${won(r.material)}` : ""}
          </span>
        )}
        <span className="text-xs text-muted-foreground @2xl:hidden">
          결정석 <span className="font-num whitespace-nowrap text-foreground">{r.price ? won(r.share) : "가격 미정"}</span>
          {r.reward > 0 && (
            <span className="whitespace-nowrap">
              {" "}
              · 보상 <span className="font-num text-primary-text">+{won(r.reward)}</span>
            </span>
          )}
        </span>
      </span>
      <span className="col-span-2 self-start justify-self-end @2xl:col-span-1 @2xl:self-center @2xl:justify-self-start">
        <Pick
          className={cn("inline-flex h-[30px] items-center gap-1 rounded-[9px] bg-muted px-2.5 text-[13px] font-bold", hoverRing, openRing, focus)}
          label={`${r.boss} 파티원 ${r.party}명, 고치기`}
          trigger={
            <>
              <span className="font-num">{r.party}</span>인
              <Pencil className="size-[13px] text-muted-foreground" aria-hidden="true" />
            </>
          }
        >
          {(close) => <PartyChoice r={r} onPick={(n) => (onParty(n), close())} />}
        </Pick>
      </span>
      {r.cells.map((c) => (
        <span key={c.cat} className={cn("grid place-items-center", !hasCells && "@max-2xl:hidden")}>
          <CellButton cell={c} boss={r.boss} prices={prices} onMark={(val) => onMark(c.cat, val)} />
        </span>
      ))}
      <span className="hidden flex-col items-end font-num whitespace-nowrap @2xl:flex">
        <span>{r.price ? <Digits>{won(r.share)}</Digits> : "가격 미정"}</span>
        {r.reward > 0 && <span className="text-xs text-primary-text"><Digits>{`+${won(r.reward)}`}</Digits></span>}
      </span>
    </div>
  );
}

const cellBase = cn("relative grid size-10 place-items-center rounded-xl bg-muted", hoverRing, focus);

function CellButton({ cell, boss, prices, onMark }: { cell: Cell; boss: string; prices: Prices; onMark: (val: string | true | undefined) => void }) {
  if (cell.kind === "none")
    return (
      <span className="text-base text-border" aria-hidden="true">
        ·
      </span>
    );
  if (cell.kind === "item") {
    const it = ITEMS[cell.id];
    return (
      <button type="button" aria-pressed={cell.on} aria-label={`${it.name} 먹음`} title={`${it.name} · ${won(priceOf(cell.id, prices))}`} onClick={() => onMark(cell.on ? undefined : true)} className={cn(cellBase, cell.on && pickedRing)}>
        <ItemImg icon={it.icon} className={cn("size-[30px] lg:size-8", !cell.on && "opacity-50 saturate-50")} />
      </button>
    );
  }
  const box = BOXES[cell.id];
  const got = cell.got ? item(cell.got) : null;
  return (
    <Pick
      className={cn(cellBase, got && pickedRing, openRing)}
      label={`${boss} ${box.name}, ${got ? `${got.name} 나옴` : "나온 것 고르기"}`}
      width="w-[248px]"
      trigger={
        <>
        <ItemImg icon={box.icon} className={cn("size-[30px] lg:size-8", !got && "opacity-50 saturate-50")} />
        {got ? (
          <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-lg bg-card shadow-[0_0_0_1.5px_var(--primary)]">
            <ItemImg icon={got.icon} className="size-5" />
            {got.level && <span className="absolute -top-1.5 -right-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-[3px] pt-px font-num text-[9px] text-primary-foreground">{got.level}</span>}
          </span>
        ) : (
          <span aria-hidden="true" className="absolute right-[3px] bottom-px border-x-[3px] border-t-4 border-x-transparent border-t-muted-foreground" />
        )}
        </>
      }
    >
      {(close) => (
        <>
        <span className="px-1.5 py-1 text-xs text-muted-foreground">{box.name} · 나온 것</span>
        {box.opts.map((id) => (
          <button key={id} type="button" onClick={() => (onMark(id), close())} aria-pressed={cell.got === id} className={cn("grid min-h-10 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[9px] px-2 text-left text-[13px] font-semibold hover:bg-muted", focus, cell.got === id && "bg-primary/14 shadow-[inset_0_0_0_1.5px_var(--primary)]")}>
            <ItemImg icon={ITEMS[id].icon} className="size-7" />
            <span className="truncate">{ITEMS[id].name}</span>
            <span className="font-num text-xs text-muted-foreground">{won(priceOf(id, prices))}</span>
          </button>
        ))}
        {cell.got && (
          <button type="button" onClick={() => (onMark(undefined), close())} className={cn("min-h-8 rounded-[9px] text-xs font-semibold text-muted-foreground hover:bg-muted", focus)}>
            안 나옴
          </button>
        )}
        </>
      )}
    </Pick>
  );
}
