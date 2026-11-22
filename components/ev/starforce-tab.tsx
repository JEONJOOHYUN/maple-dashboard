"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, ImageIcon, Plus, X } from "lucide-react";
import {
  Chip,
  Label,
  NumberField,
  Panel,
  RESULT_SHELL,
  Segment,
  Switch,
  dashedHover,
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
import { Digits } from "@/components/ui/digits";
import { Reveal, useReveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import { SwapIcon, SwapLabel } from "@/components/ui/swap-icon";
import { ZEBRA_HEAD, ZEBRA_ROW, ZEBRA_SCROLL, ZEBRA_TABLE } from "@/components/ui/zebra";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";
import { copyImage, type ImageCopyResult } from "@/lib/canvas-image";
import type { QuoteImageData } from "@/lib/ev/quote-image";

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
/**
 * Row height of the table beside the settings panel (user, 2026-11-13): fixed, the one at which the 18 rows of
 * 12 → 30성 end on the panel's bottom (42.7 with the 조건 and 결과 lines over the table, 2026-11-22: measured so the two panels end together). The same for every item and start star; stacked panels keep the plain row.
 */
const ROW_CSS = "lg:h-[42.7px]";
const findItem = (id: string) => {
  for (const g of STAR_ITEMS) {
    const it = g.items.find((x) => x.id === id);
    if (it) return { ...it, level: g.level };
  }
  return null;
};

/** "담기": a 28px pill whose press area reaches 6px above and below it (rows are 40px and up, so they never overlap). */
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The transparent border is the edge where shadows are not drawn (forced colours); the padding gives its 1px back.
      className="relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-transparent bg-background pr-[9px] pl-[7px] text-xs whitespace-nowrap text-muted-foreground shadow-tile transition-[box-shadow,color,scale] duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-1.5 hover:text-primary-text hover:shadow-tile-hover active:scale-[0.96]"
    >
      <Plus size={12} strokeWidth={1.5} aria-hidden="true" />
      담기
    </button>
  );
}

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

/** The range table's box: under 520px the two-line list, from 520px the table (@min-[32.5rem]). */
const RANGE_STEPS = [520];
/** The quote's box: the table from 624px (@min-[39rem]). */
const QUOTE_STEPS = [624];

/**
 * How many of `steps` (widths in px, rising) a box has reached, measured once the page is on screen. Until then it is
 * null: the first HTML holds both layouts and CSS (a container query at the same width) picks one, so nothing jumps;
 * after that only the layout in use is drawn. The range table is the heaviest part of the page (every digit is its own
 * element), and two copies of it made each press re-draw twice as much.
 * A step count, not the width itself: dragging the window edge then re-draws only when a step is crossed.
 */
function useBoxSteps(steps: number[]) {
  // The box as state, not a ref: the quote's box is only in the page once something is in the quote.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [reached, setReached] = useState<number | null>(null);
  useEffect(() => {
    if (!box) return;
    const watch = new ResizeObserver(([entry]) => setReached(steps.filter((px) => entry.contentRect.width >= px).length));
    watch.observe(box);
    return () => watch.disconnect();
  }, [box, steps]);
  return [setBox, reached] as const;
}

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
  // The opened rows stay a moment after "접기" so they can fade out (user, 2026-11-22: opening moved, closing did not).
  const moreRows = useReveal(more);
  // 520px = the container query the two layouts of the range table switch at (@min-[32.5rem]).
  const [rangeBox, rangeSteps] = useBoxSteps(RANGE_STEPS);
  const rangeWide = rangeSteps === null ? null : rangeSteps >= 1;
  const listClass = cn("flex flex-col", rangeWide === null && "@min-[32.5rem]:hidden");
  const tableClass = cn(ZEBRA_SCROLL, rangeWide === null ? "hidden @min-[32.5rem]:block" : "block");
  const [quoteBox, quoteSteps] = useBoxSteps(QUOTE_STEPS);
  const quoteWide = quoteSteps === null ? null : quoteSteps >= 1;
  const [mult, setMult] = useState(1.07);
  const [multText, setMultText] = useState("1.07");
  const [cart, setCart] = useState<CartItem[]>([]);
  // Quote rows opened in the narrow list (ids).
  const [openRows, setOpenRows] = useState<string[]>([]);
  const [copied, setCopied] = useState<"" | "sum" | "image">("");
  // How the last picture copy ended; kept after the label swaps back so the words do not change mid-fade.
  const [imageResult, setImageResult] = useState<ImageCopyResult>("copied");
  const [imageBusy, setImageBusy] = useState(false);
  // The same for the sum: a blocked clipboard says so instead of doing nothing.
  const [sumFailed, setSumFailed] = useState(false);

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
  const startChoices = Array.from({ length: 18 }, (_, i) => i + 12).filter((s) => s < maxStar);
  const fold = Math.max(22, startStar + 3);
  const lastRow = moreRows.shown ? maxStar : Math.min(maxStar, fold);
  const allRows = [];
  for (let to = startStar + 1; to <= maxStar; to++) {
    const from = view === "cum" ? startStar : to - 1;
    allRows.push({ from, to, ...starRange(steps, from, to) });
  }
  type RangeRow = (typeof allRows)[number];
  const rows = allRows.filter((r) => r.to <= lastRow);
  /** The rows "더 보기" opens: their room is kept under the button, so opening them never makes the panel taller. */
  const foldedRows = allRows.filter((r) => r.to > lastRow);

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

  async function copySum() {
    let failed = false;
    try {
      await navigator.clipboard.writeText(String(Math.round(sum.meso * mult)));
    } catch {
      // Clipboard can be blocked; nothing to recover, so the button says it failed.
      failed = true;
    }
    setSumFailed(failed);
    setCopied("sum");
    setTimeout(() => setCopied(""), 1600);
  }

  /** The quote as a picture, with the same words and numbers the page shows (unit switch included). */
  async function copyPicture() {
    if (cart.length === 0 || imageBusy) return;
    setImageBusy(true);
    // No await before copyImage: the clipboard item has to be made inside the click (Safari). The drawing code is
    // fetched here, on the first picture, rather than with the page.
    const data: QuoteImageData = {
        multLabel: `×${mult}`,
        rows: cartRows.map((c) => ({
          item: c.item,
          sub: `Lv.${c.level} · ${c.cond}`,
          range: `${c.from} → ${c.to}성`,
          cost: money(c.meso),
          quote: money(c.meso * mult),
          destroys: avg(c.destroys, 2),
          tries: avg(c.tries, 1),
        })),
        total: {
          label: `합계 ${cart.length}개`,
          cost: money(sum.meso),
          quote: money(sum.meso * mult),
          destroys: avg(sum.destroys, 2),
          tries: avg(sum.tries, 1),
        },
        final: {
          title: `최종 견적 (×${mult})`,
          meso: `${eok(sum.meso * mult)} 메소`,
          won: won(sum.meso * mult),
          before: `배율 전 ${eok(sum.meso)} 메소 · ${won(sum.meso)}`,
        },
    };
    const result = await copyImage(
      import("@/lib/ev/quote-image").then((m) => m.renderQuoteImage(data)),
      "스타포스-견적서.png",
    );
    setImageResult(result);
    setImageBusy(false);
    setCopied("image");
    setTimeout(() => setCopied(""), 1600);
  }

  const toggle = (list: number[], set: (v: number[]) => void, s: number) =>
    set(
      list.includes(s)
        ? list.filter((x) => x !== s)
        : [...list, s].sort((a, b) => a - b),
    );

  /** "19 → 20성" with every digit the same width, so the arrows of a column stand under each other. */
  const range = (from: number, to: number) => (
    <>
      <Digits>{from}</Digits> <span className="font-sans">→</span> <Digits>{to}</Digits>성
    </>
  );
  // Rows that "더 보기" opens come in and leave softly (reveal-row); the others are there from the start. Keyed by the
  // star reached, so changing the start star keeps the rows that stay instead of bringing them all in again.
  // `ghost` = the unseen copy that only holds the room: no motion state on it (with reduced motion a closed
  // reveal-row takes no room at all).
  const opened = (r: RangeRow, ghost: boolean) => !ghost && r.to > fold && "reveal-row";
  const openedAttrs = (r: RangeRow, ghost: boolean) => (!ghost && r.to > fold ? moreRows.attrs : undefined);
  // The table sizes its columns by what is in them, and the folded rows hold the biggest numbers: opening them
  // moved every column up to 45px (user, 2026-11-22). A zero-height row with the widest value of each column over
  // all rows, folded or not, keeps the columns where they are. Widest by a rough width: a digit is 0.68em, a comma or
  // a dot about a third, a Korean unit a full em.
  const roughWidth = (s: string) => [...s].reduce((w, ch) => w + (ch >= "0" && ch <= "9" ? 0.68 : ch === "," || ch === "." ? 0.3 : 1), 0);
  const widest = (texts: string[]) => texts.reduce((a, b) => (roughWidth(b) > roughWidth(a) ? b : a), "");
  const columnSizers = [
    widest(allRows.map((r) => money(r.meso))),
    widest(allRows.map((r) => money(r.meso * mult))),
    widest(allRows.map((r) => avg(r.destroys, 2))),
    widest(allRows.map((r) => avg(r.tries, 1))),
  ];
  const listRow = (r: RangeRow, i: number, ghost = false) => (
    <div
      key={r.to}
      {...openedAttrs(r, ghost)}
      className={cn("-mx-3 flex flex-col gap-0.5 rounded-[10px] px-3 py-2", i % 2 === 1 && "bg-background", opened(r, ghost))}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 font-num text-[15px] font-bold whitespace-nowrap">
          {range(r.from, r.to)}
        </span>
        <span className="font-num text-[15px] font-bold whitespace-nowrap text-primary-text">
          <Digits>{money(r.meso * mult)}</Digits>
        </span>
        <AddButton onClick={() => add(r.from, r.to)} />
      </div>
      <div className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">
          기댓값{" "}
          <b className="font-num text-foreground">
            <Digits>{money(r.meso)}</Digits>
          </b>
        </span>
        <span className="whitespace-nowrap">
          · 파괴{" "}
          <b className="font-num text-foreground">
            <Digits>{avg(r.destroys, 2)}</Digits>
          </b>
        </span>
        <span className="whitespace-nowrap">
          · 시도{" "}
          <b className="font-num text-foreground">
            <Digits>{avg(r.tries, 1)}</Digits>
          </b>
        </span>
      </div>
    </div>
  );
  const tableRow = (r: RangeRow) => (
    <tr
      key={r.to}
      {...openedAttrs(r, false)}
      className={cn(ZEBRA_ROW, ROW_CSS, opened(r, false))}
    >
      <td className="py-2 font-num text-[15px] font-bold whitespace-nowrap">
        {range(r.from, r.to)}
      </td>
      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
        <Digits>{money(r.meso)}</Digits>
      </td>
      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap text-primary-text">
        <Digits>{money(r.meso * mult)}</Digits>
      </td>
      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
        <Digits>{avg(r.destroys, 2)}</Digits>
      </td>
      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
        <Digits>{avg(r.tries, 1)}</Digits>
      </td>
      <td className="py-1 text-right">
        <AddButton onClick={() => add(r.from, r.to)} />
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 lg:grid-cols-[360px_minmax(0,1fr)]">
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
                          "flex h-11 min-w-0 items-center justify-around rounded-lg border transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out",
                          item === it.id
                            ? "border-primary bg-primary-soft ring-1 ring-primary"
                            : "tile-edge bg-card hover:border-primary/60",
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
            <span className="text-[11px] text-pretty text-muted-foreground">
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
          {/* What goes in on one line (user, 2026-11-22: the spare price sat alone on a second line). */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <b className="text-[15px]">조건</b>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
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
          {/* Nothing to pick on an item that stops at 12 stars or under: no heading over an empty row. */}
          {startChoices.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>시작 성</Label>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                {startChoices.map((s) => (
                  <Chip
                    key={s}
                    on={startStar === s}
                    onClick={() => setStart(s)}
                    className="px-0 font-num text-sm"
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {/* How the table reads sits by the table. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 pt-1">
            <b className="text-[15px]">결과</b>
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
          </div>
          <div ref={rangeBox} className="@container">
            {/*
              Narrower than the table (phones, a narrow window) each range takes two lines (user, 2026-11-22): the range,
              the quoted price and "담기" on the first, the other three numbers small on the second. Everything stays on
              show, since this table is for comparing the ranges, and nothing scrolls sideways. One price a line is what
              fits: 구간 70 + a price up to 120 (30성) + 담기 55 in a 311px panel.
            */}
            {rangeWide !== true && (
            <div className={listClass}>
              <div className="flex justify-between pr-[63px] pb-1.5 text-[11px] font-medium text-muted-foreground">
                <span>구간</span>
                <span>×{mult}</span>
              </div>
              {rows.map((r, i) => listRow(r, i))}
            </div>
            )}
          {/* 520px: at a 1280px window the panel is 551px wide (560 scrolled by 9px and cut "담기"). */}
          {rangeWide !== false && (
          <div className={tableClass}>
            <table className={cn(ZEBRA_TABLE, "min-w-[520px] text-[13px]")}>
              <thead>
                <tr className={ZEBRA_HEAD}>
                  <th className="py-2 font-medium">구간</th>
                  <th className="py-2 text-right font-medium">기댓값</th>
                  <th className="py-2 text-right font-medium">×{mult}</th>
                  <th className="py-2 text-right font-medium">평균 파괴</th>
                  <th className="py-2 text-right font-medium">평균 시도</th>
                  <th className="w-[5.5rem]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => tableRow(r))}
              </tbody>
              <tfoot aria-hidden="true">
                <tr className="[&>td]:px-3 [&>td]:py-0">
                  <td />
                  {columnSizers.map((text, i) => (
                    <td key={i} className="text-right font-num text-[15px] font-bold whitespace-nowrap">
                      <div className="h-0 overflow-hidden">
                        <Digits>{text}</Digits>
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          )}
          </div>
          {fold < maxStar && (
            <button
              type="button"
              onClick={() => setMore(!more)}
              aria-expanded={more}
              // 36px to look at, 40px to press: the area reaches 2px above and below.
              className={cn(
                "relative h-9 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground transition-[color,border-color,scale] duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-0.5 active:scale-[0.96]",
                dashedHover,
              )}
            >
              <SwapLabel on={more} from={`${fold + 1}~${maxStar}성 더 보기`} to={`접기 (${fold}성까지만)`} />
            </button>
          )}
          {/* Side by side the folded rows keep their room (user, 2026-11-22): opening them never makes the panel taller.
              The room is those very rows drawn unseen, so it is right for the table and for the two-line list at any
              width; stacked (below lg) the panel just grows. */}
          {foldedRows.length > 0 && (
            <div aria-hidden="true" inert className="invisible @container -mt-3.5 hidden lg:block">
              {rangeWide !== true && <div className={listClass}>{foldedRows.map((r, i) => listRow(r, i, true))}</div>}
              {/* The table's rows are one fixed height side by side, and its width is pinned by the sizer row, so
                  empty rows are all the room needs (the two-line list above needs the real lines: they can wrap). */}
              {rangeWide !== false && (
                <table className={cn("w-full", rangeWide === null && "hidden @min-[32.5rem]:table")}>
                  <tbody>
                    {foldedRows.map((r) => (
                      <tr key={r.to} className={ROW_CSS}>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[15px]">
              견적서{" "}
              <span className="font-num text-primary-text">
                <Digits>{cart.length}</Digits>
              </span>
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
            <div ref={quoteBox} className="@container">
              {/*
                Where the table does not fit (phones, a narrow column) the quote is a list (user, 2026-11-22): the range
                and the quoted price on show, the rest one tap away, and nothing to scroll sideways.
              */}
              {quoteWide !== true && (
              <div className={cn("flex flex-col", quoteWide === null && "@min-[39rem]:hidden")}>
                <div className="flex justify-between pr-6 pb-1.5 text-[11px] font-medium text-muted-foreground">
                  <span>구간 · 장비</span>
                  <span>×{mult}</span>
                </div>
                {cartRows.map((c, i) => {
                  const open = openRows.includes(c.id);
                  return (
                    <div key={c.id} className={cn("-mx-3 rounded-[10px]", i % 2 === 1 && "bg-background")}>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`quote-${c.id}`}
                        onClick={() => setOpenRows((prev) => (open ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                        // The arrow has 4px of air inside its own box: 4px less padding on its side looks even.
                        className="press-static flex min-h-14 w-full items-center gap-2 rounded-[10px] py-2.5 pr-2 pl-3 text-left hover:bg-muted/60"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-num text-[15px] font-bold whitespace-nowrap">
                            {range(c.from, c.to)}
                          </span>
                          {/* Two rows of one item and range differ by their settings: the hand-set one says so. */}
                          <span
                            title={`${c.item}${c.opt.protect !== "auto" ? ` · 방지 ${starList(c.opt.protect)}` : ""}`}
                            className="truncate text-[11px] text-muted-foreground"
                          >
                            {c.item}
                            {c.opt.protect !== "auto" && ` · 방지 ${starList(c.opt.protect)}`}
                          </span>
                        </span>
                        <span className="font-num text-[17px] font-bold whitespace-nowrap">
                          <Digits>{money(c.meso * mult)}</Digits>
                        </span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            "ml-1 shrink-0 transition-[rotate,color] duration-200 ease-out motion-reduce:transition-none",
                            open ? "rotate-180 text-foreground" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      <Reveal open={open} id={`quote-${c.id}`} className="flex flex-col gap-2 px-3 pb-3">
                          {/* The whole name here: the closed row may cut it. */}
                          <span className="text-[11px] text-pretty text-muted-foreground">
                            {c.item} · Lv.{c.level} · {c.cond}
                          </span>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              기댓값{" "}
                              <b className="font-num text-foreground">
                                <Digits>{money(c.meso)}</Digits>
                              </b>{" "}
                              · 파괴{" "}
                              <b className="font-num text-foreground">
                                <Digits>{avg(c.destroys, 2)}</Digits>
                              </b>{" "}
                              · 시도{" "}
                              <b className="font-num text-foreground">
                                <Digits>{avg(c.tries, 1)}</Digits>
                              </b>
                            </span>
                            <button
                              type="button"
                              onClick={() => setCart((prev) => prev.filter((x) => x.id !== c.id))}
                              aria-label={`${c.item} ${c.from} → ${c.to}성 빼기`}
                              className="relative h-7 shrink-0 rounded-md tile-edge px-2.5 text-xs whitespace-nowrap text-muted-foreground transition-[color,background-color,scale] duration-150 ease-out after:absolute after:-inset-1.5 hover:text-destructive active:scale-[0.96]"
                            >
                              빼기
                            </button>
                          </div>
                      </Reveal>
                    </div>
                  );
                })}
                <div
                  className={cn(
                    "-mx-3 flex items-baseline justify-between gap-2 rounded-[10px] py-3 pr-9 pl-3",
                    cart.length % 2 === 1 && "bg-background",
                  )}
                >
                  <b className="text-[13px]">합계 {cart.length}개</b>
                  <span className="font-num text-[17px] font-bold whitespace-nowrap text-primary-text">
                    <Digits>{money(sum.meso * mult)}</Digits>
                  </span>
                </div>
              </div>
              )}
              {quoteWide !== false && (
              <div className={cn(ZEBRA_SCROLL, quoteWide === null ? "hidden @min-[39rem]:block" : "block")}>
              <table className={cn(ZEBRA_TABLE, "min-w-[620px] text-[13px]")}>
                <thead>
                  <tr className={ZEBRA_HEAD}>
                    <th className="py-2 font-medium">장비 · 조건</th>
                    <th className="py-2 font-medium">구간</th>
                    <th className="py-2 text-right font-medium">기댓값</th>
                    <th className="py-2 text-right font-medium">×{mult}</th>
                    <th className="py-2 text-right font-medium">파괴</th>
                    <th className="py-2 text-right font-medium">시도</th>
                    <th className="w-[3.25rem]" />
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map((c) => (
                    <tr key={c.id} className={ZEBRA_ROW}>
                      <td className="py-2">
                        <b className="block">{c.item}</b>
                        <span className="text-[11px] text-muted-foreground">
                          Lv.{c.level} · {c.cond}
                        </span>
                      </td>
                      <td className="py-2 font-num text-[15px] font-bold whitespace-nowrap">
                        {range(c.from, c.to)}
                      </td>
                      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                        <Digits>{money(c.meso)}</Digits>
                      </td>
                      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                        <Digits>{money(c.meso * mult)}</Digits>
                      </td>
                      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                        <Digits>{avg(c.destroys, 2)}</Digits>
                      </td>
                      <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                        <Digits>{avg(c.tries, 1)}</Digits>
                      </td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((x) => x.id !== c.id))
                          }
                          aria-label={`${c.item} 빼기`}
                          // 28px to look at, 40px to press (the row is 52px tall).
                          className="relative inline-flex size-7 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 hover:bg-muted hover:text-destructive"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className={cn(ZEBRA_ROW, "font-bold")}>
                    <td className="py-2">합계 {cart.length}개</td>
                    <td />
                    <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                      <Digits>{money(sum.meso)}</Digits>
                    </td>
                    <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap text-primary-text">
                      <Digits>{money(sum.meso * mult)}</Digits>
                    </td>
                    <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                      <Digits>{avg(sum.destroys, 2)}</Digits>
                    </td>
                    <td className="py-2 text-right font-num text-[15px] font-bold whitespace-nowrap">
                      <Digits>{avg(sum.tries, 1)}</Digits>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
              </div>
              )}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-2">
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
                  className="px-0 font-num text-sm"
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
          <div className={cn(RESULT_SHELL, "gap-1")}>
            <span className="text-[13px] font-semibold">
              최종 견적 (×{mult})
            </span>
            <span className="font-num text-[30px] leading-tight font-bold">
              <Digits>{eok(sum.meso * mult)}</Digits> 메소
            </span>
            <span className="font-num text-base font-bold">
              <Digits>{won(sum.meso * mult)}</Digits>
            </span>
            <span className="text-xs font-semibold opacity-80">
              배율 전 {eok(sum.meso)} 메소 · {won(sum.meso)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={copySum}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg tile-edge bg-card text-[13px] font-semibold disabled:opacity-50"
            >
              <SwapLabel
                on={copied === "sum"}
                from={
                  <>
                    <Copy size={16} aria-hidden="true" />
                    금액 복사
                  </>
                }
                to={
                  sumFailed ? (
                    <>
                      <X size={16} aria-hidden="true" />
                      복사 실패
                    </>
                  ) : (
                    <>
                      <Check size={16} aria-hidden="true" />
                      복사됨
                    </>
                  )
                }
              />
            </button>
            <button
              type="button"
              disabled={cart.length === 0 || imageBusy}
              onClick={copyPicture}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg tile-edge bg-card text-[13px] font-semibold disabled:opacity-50"
            >
              <SwapLabel
                on={copied === "image"}
                from={
                  <>
                    {/* Drawing the picture takes a moment: the icon turns into the waiting mark meanwhile. */}
                    <SwapIcon
                      on={imageBusy}
                      from={<ImageIcon size={16} aria-hidden="true" />}
                      to={<Spinner size={16} />}
                    />
                    사진 복사
                  </>
                }
                to={
                  imageResult === "error" ? (
                    <>
                      <X size={16} aria-hidden="true" />
                      복사 실패
                    </>
                  ) : (
                    <>
                      <Check size={16} aria-hidden="true" />
                      {imageResult === "saved" ? "파일로 저장" : "복사됨"}
                    </>
                  )
                }
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
