"use client";

import { useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import {
  Chip,
  Label,
  NumberField,
  Panel,
  Segment,
  Switch,
  eok,
  avg,
  parseNum,
} from "@/components/ev/ui";
import {
  CUSTOM_LEVEL,
  MESO_RATE_WON,
  MULTIPLIERS,
  STAR_ITEMS,
  itemImage,
} from "@/lib/ev/defaults";
import {
  FLOOR_STAR,
  PROTECT_STARS,
  RESTORE_STARS,
  maxStarFor,
  starRange,
  starSteps,
  type MvpGrade,
  type StarEvent,
  type StarOptions,
} from "@/lib/ev/starforce";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";

const EVENTS: { id: StarEvent; label: string }[] = [
  { id: "none", label: "기본" },
  { id: "sale30", label: "30% 할인" },
  { id: "destroy30", label: "파괴 30% 감소" },
  { id: "shining", label: "샤타포스" },
];
const MVPS: { id: MvpGrade; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "silver", label: "실버" },
  { id: "gold", label: "골드" },
  { id: "diamond", label: "다이아+" },
];
const CUSTOM = "custom";
const DEFAULT_ITEM = "astra";
/**
 * The item picker's groups (user, 2026-11-13): levels under 160 hold an item or two each, so they share one group
 * instead of a row per level. The label is read from the levels that are there.
 */
const MERGE_BELOW = 160;
const ITEM_GROUPS = (() => {
  const low = STAR_ITEMS.filter((g) => g.level < MERGE_BELOW);
  const groups = STAR_ITEMS.filter((g) => g.level >= MERGE_BELOW).map((g) => ({ label: `Lv.${g.level}`, items: g.items }));
  if (low.length === 0) return groups;
  const first = low[0].level;
  const last = low[low.length - 1].level;
  return [{ label: first === last ? `Lv.${first}` : `Lv.${first} ~ ${last}`, items: low.flatMap((g) => g.items) }, ...groups];
})();
/**
 * Eight icons to a row (user, 2026-11-13): an item drawn with several icons takes that many cells, and at eight
 * every group fills whole rows (에테르넬 4 + 3 + one more) with no item left alone on a row.
 */
const ITEM_COLS = 8;
const findItem = (id: string) => {
  for (const g of STAR_ITEMS) {
    const it = g.items.find((x) => x.id === id);
    if (it) return { ...it, level: g.level };
  }
  return null;
};

type CartItem = {
  id: string;
  item: string;
  level: number;
  from: number;
  to: number;
  cond: string;
  opt: StarOptions;
};

const starList = (s: number[]) =>
  s.length ? s.map((x) => `${x}`).join(" · ") + "성" : "없음";

export function StarforceTab() {
  const [item, setItem] = useState(DEFAULT_ITEM);
  const [customLv, setCustomLv] = useState(String(CUSTOM_LEVEL));
  const [event, setEvent] = useState<StarEvent>("shining");
  const [mvp, setMvp] = useState<MvpGrade>("none");
  const [pcRoom, setPcRoom] = useState(false);
  const [optimize, setOptimize] = useState(true);
  const [protect, setProtect] = useState<number[]>([]);
  const [restore, setRestore] = useState<number[]>([
    15, 16, 17, 18, 19, 20, 21, 22,
  ]);
  const [view, setView] = useState<"cum" | "step">("cum");
  const [unit, setUnit] = useState<"meso" | "won">("meso");
  const [rateText, setRateText] = useState(String(MESO_RATE_WON));
  const [spareText, setSpareText] = useState(
    String(findItem(DEFAULT_ITEM)?.spareEok ?? 10),
  );
  const [start, setStart] = useState(12);
  const [more, setMore] = useState(false);
  const [mult, setMult] = useState(1.07);
  const [multText, setMultText] = useState("1.07");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [copied, setCopied] = useState<"" | "sum" | "tsv">("");

  const level =
    item === CUSTOM
      ? Math.max(0, Math.min(300, Math.round(parseNum(customLv, 0))))
      : (findItem(item)?.level ?? 200);
  const itemName =
    item === CUSTOM ? "목록에 없는 장비" : (findItem(item)?.name ?? "");
  // Picking an item also loads its usual spare price (노작값); the field stays editable.
  const pickItem = (id: string) => {
    setItem(id);
    const it = findItem(id);
    if (it) setSpareText(String(it.spareEok));
  };
  // Level rule (5 / 8 / 10 / 15 / 20 / 30 stars), lowered by the item's own cap when it has one.
  const itemMax = item === CUSTOM ? undefined : findItem(item)?.maxStar;
  const maxStar = Math.min(maxStarFor(level), itemMax ?? 30);
  const rate = parseNum(rateText, MESO_RATE_WON);
  const spareMeso = parseNum(spareText, 0) * 1e8;

  // Cheap (30 steps): recomputed every render, the React compiler memoizes it.
  const options: StarOptions = {
    level,
    maxStar: itemMax,
    event,
    mvp,
    pcRoom,
    // Star catch is always on.
    starCatch: true,
    spareMeso,
    protect: optimize ? "auto" : protect,
    restore: optimize ? "auto" : restore,
  };
  const steps = level > 0 ? starSteps(options) : [];

  const recommended = {
    protect: steps.filter((s) => s.protect).map((s) => s.star),
    restore: steps.filter((s) => s.restore).map((s) => s.star),
  };
  const shownProtect = optimize ? recommended.protect : protect;
  const shownRestore = optimize ? recommended.restore : restore;

  const startStar = Math.min(start, maxStar - 1);
  const fold = Math.max(22, startStar + 3);
  const lastRow = more ? maxStar : Math.min(maxStar, fold);
  const rows = [];
  for (let to = startStar + 1; to <= lastRow; to++) {
    const from = view === "cum" ? startStar : to - 1;
    rows.push({ from, to, ...starRange(steps, from, to) });
  }

  const money = (meso: number) =>
    unit === "won"
      ? `${koreanUnits((meso / 1e8) * rate)}원`
      : eok(meso);
  const won = (meso: number) =>
    `${koreanUnits((meso / 1e8) * rate)}원`;
  const condText = (o: StarOptions) =>
    [
      EVENTS.find((e) => e.id === o.event)!.label,
      o.mvp !== "none" ? `MVP ${MVPS.find((m) => m.id === o.mvp)!.label}` : "",
      o.pcRoom ? "PC방" : "",
      o.protect === "auto"
        ? "최적화"
        : `방지 ${starList(o.protect)} · 복구 ${starList(o.restore as number[])}`,
      `노작 ${eok(o.spareMeso)}`,
    ]
      .filter(Boolean)
      .join(" · ");

  const cartRows = cart.map((c) => ({
    ...c,
    ...starRange(starSteps(c.opt), c.from, c.to),
  }));
  const sum = cartRows.reduce(
    (a, c) => ({
      meso: a.meso + c.meso,
      destroys: a.destroys + c.destroys,
      tries: a.tries + c.tries,
    }),
    { meso: 0, destroys: 0, tries: 0 },
  );

  const add = (from: number, to: number) =>
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        item: itemName,
        level,
        from,
        to,
        cond: condText(options),
        opt: options,
      },
    ]);

  async function copy(kind: "sum" | "tsv") {
    const text =
      kind === "sum"
        ? String(Math.round(sum.meso * mult))
        : [
            [
              "장비",
              "레벨",
              "구간",
              "조건",
              "기댓값(메소)",
              `×${mult}`,
              "평균 파괴",
              "평균 시도",
            ].join("\t"),
            ...cartRows.map((c) =>
              [
                c.item,
                c.level,
                `${c.from}→${c.to}`,
                c.cond,
                Math.round(c.meso),
                Math.round(c.meso * mult),
                c.destroys.toFixed(2),
                c.tries.toFixed(1),
              ].join("\t"),
            ),
            [
              "합계",
              "",
              "",
              "",
              Math.round(sum.meso),
              Math.round(sum.meso * mult),
              sum.destroys.toFixed(2),
              sum.tries.toFixed(1),
            ].join("\t"),
          ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      // Clipboard can be blocked; nothing to recover.
    }
  }

  const toggle = (list: number[], set: (v: number[]) => void, s: number) =>
    set(
      list.includes(s)
        ? list.filter((x) => x !== s)
        : [...list, s].sort((a, b) => a - b),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel>
          <Label>장비</Label>
          <div className="flex flex-col gap-2.5">
            {ITEM_GROUPS.map((g) => (
              <div key={g.label} className="flex flex-col gap-1.5">
                <span className="font-num text-[11px] text-muted-foreground">
                  {g.label}
                </span>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${ITEM_COLS}, minmax(0, 1fr))` }}
                >
                  {g.items.map((it) => (
                    // Our own name bubble instead of the browser's title box.
                    <Tooltip key={it.id}>
                      <TooltipTrigger
                        render={<button type="button" />}
                        aria-pressed={item === it.id}
                        aria-label={`${it.name} · 노작값 ${eok(it.spareEok * 1e8)}`}
                        onClick={() => pickItem(it.id)}
                        // A name without a picture needs two cells to be read.
                        style={{ gridColumn: `span ${Math.min(ITEM_COLS, it.icons.length || 2)}` }}
                        className={cn(
                          "flex h-11 min-w-0 items-center justify-around rounded-lg border transition-colors",
                          item === it.id
                            ? "border-primary bg-primary-soft ring-1 ring-primary"
                            : "border-border bg-card hover:border-primary/60",
                        )}
                      >
                        {it.icons.length ? (
                          it.icons.map((code) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={code}
                              src={itemImage(code)}
                              alt=""
                              className="size-7 object-contain"
                            />
                          ))
                        ) : (
                          <span className="px-1 text-[11px] leading-tight">
                            {it.name}
                          </span>
                        )}
                      </TooltipTrigger>
                      <TooltipContent className="font-semibold">
                        {it.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
            <span className="rounded-lg bg-muted px-3 py-2 text-[13px]">
              <b>{itemName}</b>
              <span className="text-muted-foreground">
                {" "}
                · Lv.{level} · 노작값 {eok(parseNum(spareText, 0) * 1e8)}
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Chip on={item === CUSTOM} onClick={() => setItem(CUSTOM)}>
                목록에 없는 장비
              </Chip>
              <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                Lv.
                <NumberField
                  label="장비 레벨"
                  value={customLv}
                  onChange={(t) => {
                    setCustomLv(t);
                    setItem(CUSTOM);
                  }}
                  inputClassName="w-16"
                />
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Lv.{level} · 최대 {maxStar}성
              {itemMax && itemMax < maxStarFor(level) ? " (이 장비는 여기까지)" : maxStar < 30 ? " (140제부터 30성)" : ""}
            </span>
          </div>

          <div className="flex flex-col gap-2 border-t border-dashed border-border pt-3.5">
            <Label>이벤트</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
              {EVENTS.map((e) => (
                <Chip
                  key={e.id}
                  on={event === e.id}
                  onClick={() => setEvent(e.id)}
                >
                  {e.label}
                </Chip>
              ))}
            </div>
            <Label>MVP 할인 (17성까지 · 다이아 · 레드 · 블랙 10%)</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {MVPS.map((m) => (
                <Chip key={m.id} on={mvp === m.id} onClick={() => setMvp(m.id)}>
                  {m.label}
                </Chip>
              ))}
            </div>
            <Chip on={pcRoom} onClick={() => setPcRoom(!pcRoom)}>
              PC방 5%
            </Chip>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-3.5">
            <Switch
              on={optimize}
              onChange={setOptimize}
              label="강화 최적화"
              note="노작값에 맞춰 파괴 방지 · 복구 자동 선택"
            />
            <Label>파괴 방지 (15~17성 시도)</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {PROTECT_STARS.map((s) => (
                <Chip
                  key={s}
                  on={shownProtect.includes(s)}
                  soft={optimize}
                  disabled={optimize}
                  onClick={() => toggle(protect, setProtect, s)}
                >
                  {s}성
                </Chip>
              ))}
            </div>
            <Label>파괴되면 확정 복구</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {RESTORE_STARS.map((s) => (
                <Chip
                  key={s}
                  on={shownRestore.includes(s)}
                  soft={optimize}
                  disabled={optimize}
                  onClick={() => toggle(restore, setRestore, s)}
                >
                  {s}성
                </Chip>
              ))}
            </div>
            {/* One fact per line: a single "·" chain wrapped mid-item. */}
            <ul className="flex flex-col gap-0.5 text-xs leading-relaxed text-muted-foreground">
              {(optimize
                ? [
                    `추천 파괴 방지: ${recommended.protect.length ? starList(recommended.protect) : "안 함"}`,
                    `추천 확정 복구: ${recommended.restore.length ? starList(recommended.restore) : "안 함"}`,
                    `그 밖 파괴 → 노작 1개로 ${FLOOR_STAR}성 복구`,
                    ...(recommended.restore.includes(22) ? ["23성 이상 파괴 → 22성으로 복구"] : []),
                  ]
                : [
                    `고르지 않은 성 파괴 → 노작 1개로 ${FLOOR_STAR}성 복구`,
                    restore.includes(22) ? "23성 이상 파괴 → 22성으로 복구" : "23성 이상 파괴 → 22성 복구를 고르면 22성으로",
                  ]
              ).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segment
              label="표 보기"
              value={view}
              onChange={setView}
              options={[
                { id: "cum", label: "누적 기댓값" },
                { id: "step", label: "단계별 기댓값" },
              ]}
              className="w-full sm:w-64"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Segment
                label="단위"
                value={unit}
                onChange={setUnit}
                options={[
                  { id: "meso", label: "메소" },
                  { id: "won", label: "원" },
                ]}
                className="w-32"
              />
              <span className="inline-flex items-center gap-1">
                1억 =
                <NumberField
                  label="1억 메소당 원"
                  value={rateText}
                  onChange={setRateText}
                  suffix="원"
                  inputClassName="w-16"
                />
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              노작값
              <NumberField
                label="노작값 (억 메소)"
                value={spareText}
                onChange={setSpareText}
                suffix="억 메소"
                decimal
                inputClassName="w-16"
              />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>시작 성</Label>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {Array.from({ length: 18 }, (_, i) => i + 12)
                .filter((s) => s < maxStar)
                .map((s) => (
                  <Chip
                    key={s}
                    on={startStar === s}
                    onClick={() => setStart(s)}
                    className="px-0"
                  >
                    {s}
                  </Chip>
                ))}
            </div>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                  <th className="py-2 font-medium">구간</th>
                  <th className="py-2 text-right font-medium">기댓값</th>
                  <th className="py-2 text-right font-medium">×{mult}</th>
                  <th className="py-2 text-right font-medium">평균 파괴</th>
                  <th className="py-2 text-right font-medium">평균 시도</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.from}-${r.to}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2 whitespace-nowrap">
                      {r.from} → {r.to}성
                    </td>
                    <td className="py-2 text-right font-num whitespace-nowrap">
                      {money(r.meso)}
                    </td>
                    <td className="py-2 text-right font-num font-bold whitespace-nowrap text-primary-text">
                      {money(r.meso * mult)}
                    </td>
                    <td className="py-2 text-right font-num">
                      {avg(r.destroys, 2)}
                    </td>
                    <td className="py-2 text-right font-num">
                      {avg(r.tries, 1)}
                    </td>
                    <td className="py-1 text-right">
                      <button
                        type="button"
                        onClick={() => add(r.from, r.to)}
                        className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-primary hover:text-primary-text"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                        담기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fold < maxStar && (
            <button
              type="button"
              onClick={() => setMore(!more)}
              aria-expanded={more}
              className="h-9 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground hover:text-foreground"
            >
              {more
                ? `접기 (${fold}성까지만)`
                : `${fold + 1}~${maxStar}성 더 보기`}
            </button>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[15px]">
              견적서{" "}
              <span className="font-num text-primary-text">{cart.length}</span>
            </b>
            <span className="text-xs text-muted-foreground">
              표에서 &quot;담기&quot;로 추가
            </span>
          </div>
          {cart.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-[13px] text-muted-foreground">
              담은 구간 없음
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                    <th className="py-2 font-medium">장비 · 조건</th>
                    <th className="py-2 font-medium">구간</th>
                    <th className="py-2 text-right font-medium">기댓값</th>
                    <th className="py-2 text-right font-medium">×{mult}</th>
                    <th className="py-2 text-right font-medium">파괴</th>
                    <th className="py-2 text-right font-medium">시도</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2">
                        <b className="block">{c.item}</b>
                        <span className="text-[11px] text-muted-foreground">
                          Lv.{c.level} · {c.cond}
                        </span>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        {c.from} → {c.to}성
                      </td>
                      <td className="py-2 text-right font-num whitespace-nowrap">
                        {money(c.meso)}
                      </td>
                      <td className="py-2 text-right font-num font-bold whitespace-nowrap">
                        {money(c.meso * mult)}
                      </td>
                      <td className="py-2 text-right font-num">
                        {avg(c.destroys, 2)}
                      </td>
                      <td className="py-2 text-right font-num">
                        {avg(c.tries, 1)}
                      </td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((x) => x.id !== c.id))
                          }
                          aria-label={`${c.item} 빼기`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">합계 {cart.length}개</td>
                    <td />
                    <td className="py-2 text-right font-num">
                      {money(sum.meso)}
                    </td>
                    <td className="py-2 text-right font-num text-primary-text">
                      {money(sum.meso * mult)}
                    </td>
                    <td className="py-2 text-right font-num">
                      {avg(sum.destroys, 2)}
                    </td>
                    <td className="py-2 text-right font-num">
                      {avg(sum.tries, 1)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel>
            <b className="text-sm">배율</b>
            <div className="grid grid-cols-4 gap-1.5">
              {MULTIPLIERS.map((m) => (
                <Chip
                  key={m}
                  on={mult === m}
                  onClick={() => {
                    setMult(m);
                    setMultText(m.toFixed(2));
                  }}
                  className="px-0"
                >
                  ×{m.toFixed(2)}
                </Chip>
              ))}
              <span className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground">
                ×
                <NumberField
                  label="배율 직접 입력"
                  value={multText}
                  decimal
                  onChange={(t) => {
                    setMultText(t);
                    const v = parseFloat(t);
                    if (v > 0) setMult(v);
                  }}
                  inputClassName="w-full"
                />
              </span>
            </div>
          </Panel>
          <div className="flex flex-col gap-1 rounded-lg bg-primary px-5 py-4 text-primary-foreground">
            <span className="text-[13px] font-semibold">
              최종 견적 (×{mult})
            </span>
            <span className="font-num text-[30px] leading-tight font-bold">
              {eok(sum.meso * mult)} 메소
            </span>
            <span className="font-num text-base font-bold">
              {won(sum.meso * mult)}
            </span>
            <span className="text-xs font-semibold opacity-80">
              배율 전 {eok(sum.meso)} 메소 · {won(sum.meso)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => copy("sum")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[13px] font-semibold disabled:opacity-50"
            >
              {copied === "sum" ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied === "sum" ? "복사됨" : "금액 복사"}
            </button>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => copy("tsv")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[13px] font-semibold disabled:opacity-50"
            >
              {copied === "tsv" ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied === "tsv" ? "복사됨" : "엑셀 복사"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
