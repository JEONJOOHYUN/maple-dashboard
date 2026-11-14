"use client";

import { useMemo, useState } from "react";
import { Copy, ImageIcon, Info, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MESO_MARKET_FEE_RATE, computeBossSplit } from "@/lib/boss-split/boss-split-math";
import { formatKoreanMeso, formatNumber } from "@/lib/format";
import { handleMesoInput } from "@/lib/meso-input";
import { renderSplitImage } from "@/lib/boss-split/split-image";
import { cn } from "@/lib/utils";

const FEE_OPTIONS = [3, 5] as const;
const COUNT_OPTIONS = [2, 3, 4, 5, 6] as const;
const MAX_MEMBERS = 6;
const DEFAULT_NAMES = ["파티장", "파티원 1", "파티원 2", "파티원 3", "파티원 4", "파티원 5"];
// Cards per row by party size: 4 people read better as 2x2 than 3+1.
// 5 people use half-width tracks (each card spans 2) so the short last row can sit in the middle.
const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2",
  5: "sm:grid-cols-4 lg:grid-cols-6",
  6: "sm:grid-cols-2 lg:grid-cols-3",
};
// 5 people: 2 + 2 + 1 on tablets and 3 + 2 on desktop, last row centered.
const FIVE_CARD: Record<number, string> = {
  3: "lg:col-start-2",
  4: "sm:col-start-2 lg:col-start-auto",
};
// Percent inputs share the full width; small screens wrap to 2-3 per row.
const PERCENT_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};
const NOTE = "파티원 금액 = 받는 사람이 다시 낼 수수료 포함";
const MARKET_PCT = MESO_MARKET_FEE_RATE * 100;
const CROSS_NOTE = `다른 서버 = 메소마켓에서 메이플포인트로 바꿔 건넴 · 수수료 ${MARKET_PCT}% 추가`;

type Item = { id: string; grossMeso: number };
type ImageState = "idle" | "working" | "copied" | "saved" | "error";

function createItem(): Item {
  return { id: crypto.randomUUID(), grossMeso: 0 };
}

/** Whole-number percentages that add up to 100 (the first members take the remainder). */
function evenPercents(count: number): number[] {
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => base + (i < 100 - base * count ? 1 : 0));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BossSplitCalculator() {
  const [items, setItems] = useState<Item[]>(() => [createItem()]);
  const [feePercent, setFeePercent] = useState<(typeof FEE_OPTIONS)[number]>(3);
  const [count, setCount] = useState(2);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  // number | "" so an emptied field stays empty instead of snapping back to 0.
  const [percents, setPercents] = useState<(number | "")[]>(() => [50, 50, 0, 0, 0, 0]);
  // Party members on another server: the leader moves their share through the meso market (1 % more).
  const [otherServer, setOtherServer] = useState<boolean[]>(() => Array(MAX_MEMBERS).fill(false));
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [imageState, setImageState] = useState<ImageState>("idle");

  const totalGrossMeso = items.reduce((sum, item) => sum + item.grossMeso, 0);
  const feeRate = feePercent / 100;
  const netMeso = totalGrossMeso * (1 - feeRate);

  const sharePercents = useMemo(
    () =>
      mode === "equal"
        ? Array.from({ length: count }, () => 100 / count)
        : percents.slice(0, count).map((p) => (p === "" ? 0 : p)),
    [mode, count, percents]
  );
  const percentSum = sharePercents.reduce((sum, p) => sum + p, 0);
  const isValidSplit = Math.abs(percentSum - 100) < 0.01;

  const shares = useMemo(
    () =>
      computeBossSplit(
        isValidSplit ? netMeso : 0,
        sharePercents.map((p) => p / 100),
        feeRate,
        otherServer
      ),
    [isValidSplit, netMeso, sharePercents, feeRate, otherServer]
  );
  const anyOtherServer = otherServer.slice(1, count).some(Boolean);

  // Leader keeps finalMeso; everyone else is handed beforeMeso (their share plus the fee they pay again).
  // Other server: beforeMeso is what the leader sells on the meso market, handedMeso what is handed over there.
  const cards = shares.map((share, index) => {
    const cross = index > 0 && otherServer[index];
    const amount = index === 0 ? share.finalMeso : share.beforeMeso;
    return {
      index,
      cross,
      name: names[index] || DEFAULT_NAMES[index],
      pctLabel: `${Math.round(sharePercents[index] * 10) / 10}%`,
      amount,
      handed: share.handedMeso,
      final: share.finalMeso,
      // One line for the image; the card shows an other-server member's amounts as rows instead.
      role:
        index === 0
          ? "실수령 기준 잔여 · 내가 갖는 몫"
          : cross
            ? `메소마켓에 팔 금액 (수수료 ${MARKET_PCT}% 포함) · 다른 서버에 도착 ${formatNumber(share.handedMeso)} · 받는 몫 ${formatNumber(share.finalMeso)}`
            : `전달 금액 (수수료 포함) · 받는 몫 ${formatNumber(share.finalMeso)}`,
    };
  });
  const hasResult = isValidSplit && netMeso > 0;

  function updateItem(id: string, grossMeso: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, grossMeso } : item)));
  }

  function chooseMode(next: "equal" | "custom") {
    // Start custom mode from the even split the user was just looking at.
    if (next === "custom" && mode !== "custom") {
      setPercents((prev) => [...evenPercents(count), ...prev.slice(count)]);
    }
    setMode(next);
  }

  function chooseCount(next: number) {
    setCount(next);
    if (mode === "custom") {
      setPercents((prev) => [...evenPercents(next), ...prev.slice(next)].slice(0, MAX_MEMBERS));
    }
  }

  async function copyAmount(index: number, amount: number) {
    try {
      await navigator.clipboard.writeText(String(Math.round(amount)));
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1600);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); nothing to recover.
    }
  }

  async function copyImage() {
    if (!hasResult || imageState === "working") return;
    setImageState("working");
    const data = {
      summary: `판매가 ${formatKoreanMeso(totalGrossMeso, { spaced: true }).replace(" 메소", "")} · 수수료 ${feePercent}% · ${count}명`,
      note: anyOtherServer ? `${NOTE} · ${CROSS_NOTE}` : NOTE,
      cards: cards.map((c) => ({
        name: c.name,
        pctLabel: c.pctLabel,
        amount: formatNumber(c.amount),
        kor: formatKoreanMeso(c.amount, { spaced: true }),
        role: c.role,
        highlight: c.index > 0,
      })),
    };
    // The blob promise must go into ClipboardItem synchronously (Safari requirement).
    const blobPromise = renderSplitImage(data);
    let next: ImageState = "copied";
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no image clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    } catch {
      try {
        downloadBlob(await blobPromise, "분배금-결과.png");
        next = "saved";
      } catch {
        next = "error";
      }
    }
    setImageState(next);
    setTimeout(() => setImageState("idle"), 2000);
  }

  const imageLabel = {
    idle: "이미지 복사",
    working: "이미지 만드는 중…",
    copied: "이미지 복사됨",
    saved: "복사 불가 · 파일로 저장",
    error: "이미지 만들기 실패",
  }[imageState];

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader title="분배금 계산기" description="판매가 · 수수료 · 인원만 고르면 바로 계산" />

      <section className="flex flex-col gap-[18px] rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">판매가</h2>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, createItem()])}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-primary-text"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            아이템 추가
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-start gap-2.5">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-input bg-background px-4 py-3.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="text-xs text-muted-foreground">아이템 {index + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.grossMeso === 0 ? "" : formatNumber(item.grossMeso)}
                  placeholder="0"
                  onChange={(e) => handleMesoInput(e, (value) => updateItem(item.id, value))}
                  aria-label={`아이템 ${index + 1} 판매가 (메소)`}
                  className="w-full bg-transparent text-right font-num text-[26px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-[30px]"
                />
                <span className="text-right text-xs text-muted-foreground">
                  {formatKoreanMeso(item.grossMeso, { spaced: true })}
                </span>
              </label>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                  aria-label={`아이템 ${index + 1} 빼기`}
                  className="mt-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Full-width button rows: each option shares the width, so 2~6 fits one line on a phone. */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
          <ChoiceRow label="경매장 수수료" columns="grid-cols-2">
            {FEE_OPTIONS.map((fee) => (
              <ChoiceButton key={fee} on={feePercent === fee} onClick={() => setFeePercent(fee)}>
                {fee}%
              </ChoiceButton>
            ))}
          </ChoiceRow>
          <ChoiceRow label="인원 (명)" columns="grid-cols-5">
            {COUNT_OPTIONS.map((n) => (
              <ChoiceButton key={n} on={count === n} onClick={() => chooseCount(n)} ariaLabel={`${n}명`}>
                {n}
              </ChoiceButton>
            ))}
          </ChoiceRow>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">분배 비율</span>
            <div className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]" role="group" aria-label="분배 비율">
              <SegmentButton on={mode === "equal"} onClick={() => chooseMode("equal")}>
                균등
              </SegmentButton>
              <SegmentButton on={mode === "custom"} onClick={() => chooseMode("custom")}>
                자율
              </SegmentButton>
            </div>
          </div>
          {mode === "custom" && (
            <>
              <div className={cn("grid gap-2", PERCENT_COLS[count])}>
                {Array.from({ length: count }, (_, i) => (
                  <label
                    key={i}
                    className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-3"
                  >
                    <span className="w-full truncate text-center text-[13px] font-semibold">
                      {names[i] || DEFAULT_NAMES[i]}
                    </span>
                    <span className="relative w-full">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step={1}
                      value={percents[i]}
                      onChange={(e) => {
                        const value = e.target.value === "" ? "" : Number(e.target.value);
                        setPercents((prev) => prev.map((p, j) => (j === i ? value : p)));
                      }}
                      aria-label={`${names[i] || DEFAULT_NAMES[i]} 비율 (%)`}
                      className="h-11 w-full rounded-lg border border-input bg-card pr-7 pl-2 text-center font-num text-lg font-bold outline-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={cn("font-semibold", isValidSplit ? "text-foreground" : "text-destructive")}>
                  합계 {Math.round(percentSum * 10) / 10}%
                </span>
                <span className={isValidSplit ? "text-muted-foreground" : "text-destructive"}>
                  {isValidSplit ? "100% 맞음" : "합계 100% 필요"}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-label="계산 결과" className="flex flex-col gap-4 rounded-lg border border-border bg-card px-5 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">계산 결과</h2>
          <span className="text-[13px] text-muted-foreground">
            수수료 {feePercent}% · {count}명 · 실수령 {formatNumber(netMeso)}
          </span>
        </div>

        <div className={cn("grid grid-cols-1 gap-3", GRID_COLS[count])}>
          {cards.map((card) => {
            const highlight = card.index > 0;
            const copied = copiedIndex === card.index;
            return (
              <div
                key={card.index}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-4 pt-5 pb-4 text-center",
                  count === 5 && "sm:col-span-2",
                  count === 5 && FIVE_CARD[card.index],
                  highlight ? "border-primary bg-primary-soft" : "border-border bg-background"
                )}
              >
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <input
                    type="text"
                    value={names[card.index]}
                    onChange={(e) =>
                      setNames((prev) => prev.map((n, j) => (j === card.index ? e.target.value : n)))
                    }
                    placeholder={DEFAULT_NAMES[card.index]}
                    aria-label={`${DEFAULT_NAMES[card.index]} 이름`}
                    size={Math.max(4, (names[card.index] || DEFAULT_NAMES[card.index]).length + 1)}
                    className="min-w-0 rounded-md border border-transparent bg-transparent px-1 text-center text-sm font-bold outline-none field-sizing-content hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <span className="shrink-0 rounded-full bg-muted px-2 py-px text-xs font-bold">{card.pctLabel}</span>
                </span>
                {highlight && (
                  <>
                    {/* Same or other server as a choice of two (user, 2026-11-14: the "타 서버" pill read as a
                        label, not as something to press). */}
                    <div role="group" aria-label={`${card.name} 서버`} className="grid w-full max-w-60 grid-cols-2 gap-0.5 rounded-lg bg-muted p-[3px]">
                      {[false, true].map((other) => (
                        <button
                          key={String(other)}
                          type="button"
                          aria-pressed={card.cross === other}
                          onClick={() => setOtherServer((prev) => prev.map((v, j) => (j === card.index ? other : v)))}
                          className={cn(
                            "h-8 rounded-md text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            card.cross === other ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {other ? "다른 서버" : "같은 서버"}
                        </button>
                      ))}
                    </div>
                    {card.cross && <span className="text-xs text-muted-foreground">메소마켓으로 보내요 · 수수료 {MARKET_PCT}%</span>}
                  </>
                )}
                <span
                  className={cn(
                    "max-w-full font-num text-[26px] leading-tight font-bold break-all tabular-nums sm:text-[30px]",
                    highlight ? "text-primary-text" : "text-foreground"
                  )}
                >
                  {formatNumber(card.amount)}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {card.cross && "메소마켓에 팔 금액 · "}
                  {formatKoreanMeso(card.amount, { spaced: true })}
                </span>
                {card.cross ? (
                  // What arrives on the other server, and the share after the usual fee there: one row each.
                  <div className="flex w-full max-w-72 flex-col gap-1 border-t border-primary/30 pt-2 text-[13px]">
                    <span className="flex justify-between gap-3">
                      <span className="text-muted-foreground">다른 서버에 도착</span>
                      <b className="font-num">{formatNumber(card.handed)}</b>
                    </span>
                    <span className="flex justify-between gap-3">
                      <span className="text-muted-foreground">받는 몫 (수수료 {feePercent}% 뒤)</span>
                      <b className="font-num">{formatNumber(card.final)}</b>
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{card.role}</span>
                )}
                {/* At the foot of the card: cards in a row line up their buttons, whatever is above them. */}
                <div className="mt-auto pt-1.5">
                  <button
                    type="button"
                    onClick={() => copyAmount(card.index, card.amount)}
                    disabled={!hasResult}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-input bg-muted px-3.5 text-[13px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    {copied ? `복사됨 · ${Math.round(card.amount)}` : "금액 복사"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!hasResult && (
          <p className="text-center text-sm text-muted-foreground">
            {isValidSplit ? "판매가를 넣으면 금액 표시" : "비율 합계 100%로 맞추면 금액 표시"}
          </p>
        )}

        <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {NOTE}
          {anyOtherServer ? ` · ${CROSS_NOTE}` : ""} · &quot;금액 복사&quot; = 숫자만
        </p>

        <div className="flex flex-col items-center gap-1.5 border-t border-border pt-3.5">
          <button
            type="button"
            onClick={copyImage}
            disabled={!hasResult || imageState === "working"}
            aria-live="polite"
            className="inline-flex h-[46px] items-center gap-2 rounded-lg bg-primary px-7 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {imageLabel}
          </button>
          <span className="text-xs text-muted-foreground">결과를 그림으로 복사 → 디스코드 · 카톡에 붙여 넣기</span>
        </div>
      </section>
    </div>
  );
}

function ChoiceRow({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <div className={cn("grid gap-1 rounded-[10px] border border-border bg-background p-1", columns)}>{children}</div>
    </div>
  );
}

function ChoiceButton({
  on,
  onClick,
  ariaLabel,
  children,
}: {
  on: boolean;
  onClick: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={ariaLabel}
      className={cn(
        "h-[42px] rounded-[7px] text-[15px] transition-colors",
        on ? "bg-primary font-bold text-primary-foreground" : "font-medium text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SegmentButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-[34px] rounded-md px-3.5 text-[13px] transition-colors",
        on ? "bg-card font-bold text-primary-text shadow-sm" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}
