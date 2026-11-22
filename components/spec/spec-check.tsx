"use client";

import { asOfLabel } from "@/lib/spec/as-of";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, RotateCw, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { refreshSpec } from "@/app/spec/actions";
import { PageHeader } from "@/components/page-header";
import { SpecTabs } from "@/components/spec/spec-tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Spinner } from "@/components/ui/spinner";
import { SwapIcon } from "@/components/ui/swap-icon";
import type { Miss, SpecResult, Tier, Tile } from "@/lib/spec/check";
import { periodGroups } from "@/lib/spec/period-rows";
import { useStored } from "@/lib/use-stored";
import { useReveal } from "@/components/ui/reveal";
import { Digits } from "@/components/ui/digits";
import { cn } from "@/lib/utils";
// Static imports, like the menu icons: each address carries a content hash.
import artAbility from "@/public/icons/spec/ability.svg";
import artArtifact from "@/public/icons/spec/artifact.svg";
import artCash from "@/public/icons/spec/cash.svg";
import artHyperStat from "@/public/icons/spec/hyper-stat.svg";
import artLabelPlus from "@/public/icons/spec/label-plus.svg";
import artMisc from "@/public/icons/spec/misc.svg";
import artPet from "@/public/icons/spec/pet.svg";
import artPetGear from "@/public/icons/spec/pet-gear.svg";
import artPropensity from "@/public/icons/spec/propensity.svg";
import artTitle from "@/public/icons/spec/title.svg";

export type SpecView =
  | { kind: "empty" }
  | { kind: "result"; result: SpecResult; at: number; /** The day the data is of, when NEXON was under maintenance. */ asOf?: string; optimizer: string | null }
  | { kind: "notFound" | "quota" | "maintenance" | "failed"; name: string };

/** One line for both tabs, so switching tabs never moves the tab row. */
export const SPEC_DESCRIPTION = "닉네임 · 길드 → 돈 거의 안 들이고 채울 수 있는데 놓친 스펙 찾기";

// Recent characters (this browser only): people come back to check a fix (user, 2026-11-16).
const RECENT_KEY = "spec-recent";
const RECENT_MAX = 8;

const CHECKED =
  "공용 · 직업 0차 스킬 · 성향 · 유니온 아티팩트 · 칭호 · 주문서 강화 · 캐시 장비 · 펫 기간 · 펫 장비 · 마스터라벨 · 마스터라벨 플러스 · 5차 · 하이퍼 스탯 · 하이퍼 패시브 · 펫 버프 · 링크 · 어빌리티";

const kstTime = (ms: number) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(ms))
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);

function fetchedAt(ms: number) {
  const t = kstTime(ms);
  return `${t.month}/${t.day} ${t.hour}:${t.minute}`;
}

/**
 * "부족: 공격력/마력 Lv.1 · 크리티컬 확률 Lv.10" — each " · " item keeps to one line and breaks only between items,
 * unless one item alone is wider than the box (a narrow card): then it wraps between words instead of spilling out.
 */
function DetailLine({ text }: { text: string }) {
  return <Pieces text={text} className="text-[13px] leading-normal text-muted-foreground" />;
}

/** Split on " · " except inside brackets: "보스 프리셋(장비 · 하이퍼)을 찾아" stays one item. */
function splitItems(text: string): string[] {
  const out = [""];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && text.startsWith(" · ", i)) {
      out.push("");
      i += 2;
    } else out[out.length - 1] += ch;
  }
  return out;
}

const NBSP = "\u00a0";

/** DetailLine's " · " list for any text: pieces break between them, and the dot ends a line, never starts one. */
export function Pieces({ text, className }: { text: string; className?: string }) {
  // "보스에 안 쓰는 효과: A · B" — the label is a piece of its own, so a long first item does not drag it along.
  const cut = text.indexOf(": ");
  const label = cut > 0 && cut < 16 ? text.slice(0, cut + 1) : null;
  const items = splitItems(label ? text.slice(cut + 2) : text);
  // "Lv.10" or "+10,500" stays with its name, a bracket keeps its words, and a last word of one or two letters
  // ("…그 세팅으로 확인") never sits alone on a line.
  const glue = (s: string) =>
    s
      .replace(/ (?=(Lv\.|\+?[\d.,]+[%회개일]?$))/g, NBSP)
      .replace(/\([^)]*\)/g, (m) => m.replaceAll(" ", NBSP))
      .replace(/ (\S{1,2})$/, `${NBSP}$1`);
  return (
    <span className={className}>
      {label && <span className="inline-block max-w-full break-keep">{label}</span>}
      {label && " "}
      {items.map((it, i) => (
        <span key={i}>
          <span className="inline-block max-w-full break-keep">
            {glue(it)}
            {i < items.length - 1 && `${NBSP}·`}
          </span>
          {i < items.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** A title like "24포인트 남음 (1번 프리셋)" or "여제의 축복 24 / 30": the bracket and the "a / b" each keep together. */
export const whatText = (what: string) =>
  what
    .replace(/\([^)]*\)/g, (m) => m.replaceAll(" ", NBSP))
    .replace(/(\d+) \/ (\d+)/g, `$1${NBSP}/${NBSP}$2`)
    .replace(/(\d\S*) (남음|미만|부위)/g, `$1${NBSP}$2`)
    // a last word of one or two letters ("넣을 자리 없음" → "없음") never sits alone
    .replace(/ (\S{1,2})$/, `${NBSP}$1`);

// How much a line takes to fill (user, 2026-11-17): the chip on every line. The list comes already in this order.
const TIER: Record<Tier, { label: string; className: string }> = {
  urgent: { label: "기간 임박", className: "bg-[oklch(0.63_0.182_24.3_/_0.14)] text-[oklch(0.63_0.182_24.3)]" },
  now: { label: "바로 됨", className: "bg-primary-soft text-primary-text" },
  quest: { label: "조금만", className: "bg-secondary text-foreground" },
  long: { label: "시간 · 메소", className: "tile-edge text-muted-foreground" },
};

function TierChip({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-[68px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold whitespace-nowrap",
        TIER[tier].className,
        className,
      )}
    >
      {TIER[tier].label}
    </span>
  );
}

// Categories the game API has no picture for get one of ours, in the menu icons' style (user, 2026-11-18: the thin
// line icons looked empty next to the game pictures; drawn by Codex, originals outside the repository). Others: misc.
const CAT_ART: Record<string, { src: string }> = {
  "하이퍼 스탯": artHyperStat,
  "유니온 아티팩트": artArtifact,
  칭호: artTitle,
  성향: artPropensity,
  어빌리티: artAbility,
  "캐시 장비": artCash,
  펫: artPet,
  "펫 장비": artPetGear,
  마스터라벨: artLabelPlus,
  "마스터라벨 플러스": artLabelPlus,
};
const catArt = (cat?: string) => ((cat && CAT_ART[cat]) || artMisc).src;

// Two pictures in one square, cut along the diagonal with a hairline between them — how the game draws a boost core
// (its first skill at the top left, its second at the bottom right).
const HALF_TOP_LEFT = { clipPath: "polygon(0 0, calc(100% - 1px) 0, 0 calc(100% - 1px))" };
const HALF_BOTTOM_RIGHT = { clipPath: "polygon(100% 1px, 100% 100%, 1px 100%)" };

/** One picture of a thing: a alone, or a and b sharing the square. */
type Pic = { a: string; b?: string | null };

/** A game picture at the size given (size-8 in a box, size-6 on a line); with b, the two split along the diagonal. */
function GamePic({ pic, size }: { pic: Pic; size: string }) {
  if (!pic.b) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pic.a} alt="" loading="lazy" className={cn("shrink-0 object-contain", size)} />;
  }
  return (
    <span className={cn("relative shrink-0", size)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pic.a} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" style={HALF_TOP_LEFT} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pic.b} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" style={HALF_BOTTOM_RIGHT} />
    </span>
  );
}

/** A game picture in a rounded box; without one, our picture of the category. */
function PicBox({ pic, cat, large }: { pic?: Pic; cat?: string; large?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-[10px] tile-edge bg-secondary", large ? "size-12" : "size-11")}>
      <GamePic pic={pic ?? { a: catArt(cat) }} size="size-8" />
    </span>
  );
}

/** Every picture a line has: its own, its tiles, its table rows. */
const picsOf = (m: Miss): Pic[] => [
  ...(m.icon ? [{ a: m.icon }] : []),
  // What is missing first: a line can also show what is already done (hyper passives, master labels with stats).
  ...[...(m.tiles ?? [])].sort((x, y) => Number(!!x.done) - Number(!!y.done)).flatMap((x) => (x.icon ? [{ a: x.icon, b: x.icon2 }] : [])),
  ...(m.rowIcons ?? []).flatMap((x) => (x ? [{ a: x }] : [])),
];

/**
 * A line opens when there is more to show than fits beside its title. One thing (a single link, one piece of gear)
 * is named right on the line instead, so nobody has to open a line to read one word.
 */
const opens = (m: Miss) => (m.tiles?.length ?? 0) > 1 || !!m.rows?.length || m.detail.length > 1;

/** The first lines as cards. Long lists stay in the list below, where they can open. */
const CARD_MAX = 3;
const fitsCard = (m: Miss) => !m.rows?.length && (m.tiles?.length ?? 0) <= 4;

function TopCard({ miss }: { miss: Miss }) {
  return (
    <li className="flex gap-3 rounded-lg border border-primary/45 bg-card p-3.5 @xl:flex-col @xl:gap-2.5 @xl:p-4">
      <PicBox pic={picsOf(miss)[0]} cat={miss.cat} large />
      {/* The chip shares the line of the category, so the text under it keeps the whole width of a narrow card. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs break-keep text-muted-foreground">{miss.cat}</span>
          <TierChip tier={miss.tier} />
        </span>
        <b className="text-sm leading-snug break-keep">{whatText(miss.what)}</b>
        {miss.detail.map((d, i) => (
          <DetailLine key={i} text={d} />
        ))}
      </div>
    </li>
  );
}

function Tiles({ tiles, cat }: { tiles: Tile[]; cat: string }) {
  return (
    // Each tile is three rows of the list's own grid (picture · name · the line under it), so along one row of tiles
    // the names share a height and the lines under them sit level (user, 2026-11-17: "레벨 위치 통일").
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-1.5 gap-y-1">
      {tiles.map((x, i) => (
        <li key={`${i}-${x.name}`} className="row-span-3 grid grid-rows-subgrid justify-items-center pb-2.5 text-center">
          <PicBox pic={x.icon ? { a: x.icon, b: x.icon2 } : undefined} cat={cat} />
          <span className="text-[11px] leading-tight font-semibold text-balance break-keep">
            {/* "데몬 임팩트-보너스 어택": break after the hyphen first, so "어택" is not left alone on the last line */}
            {x.name.split(/(?<=-)/).map((part, i) => (
              <span key={i} className="inline-block max-w-full">
                {part}
              </span>
            ))}
          </span>
          <span className={cn("text-[11px] leading-tight font-semibold whitespace-nowrap", x.done ? "text-muted-foreground" : "text-primary-text")}>
            {x.sub}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The closed part of a line: category over what is missing, then small pictures, the chip, and (when it opens) the
 * arrow the accordion adds. Sized by the width of the list, not of the window (the list is half the page on a desktop):
 * a narrow list puts the chip beside the category and drops the pictures, so the text keeps its width.
 */
function LineHead({ miss, chip }: { miss: Miss; chip: boolean }) {
  const own = picsOf(miss);
  // No game picture: the category's own, in the same place.
  const pics = own.length ? own : [{ a: catArt(miss.cat) }];
  const beside = !opens(miss) ? miss.detail[0] : undefined;
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <b className="text-[13px] leading-normal break-keep">{miss.cat}</b>
          {chip && <TierChip tier={miss.tier} className="@sm:hidden" />}
        </span>
        <span className="text-[13px] leading-normal font-normal break-keep">
          <span className="font-semibold">{whatText(miss.what)}</span>
          {beside && (
            <>
              {" "}
              <DetailLine text={beside} />
            </>
          )}
        </span>
      </span>
      {pics.length > 0 && (
        <span className="hidden shrink-0 items-center gap-1 @lg:flex">
          {pics.slice(0, 3).map((pic, i) => (
            <GamePic key={i} pic={pic} size="size-6" />
          ))}
          {pics.length > 3 && <span className="text-[11px] font-semibold text-muted-foreground">+{pics.length - 3}</span>}
        </span>
      )}
      {chip && <TierChip tier={miss.tier} className="hidden @sm:inline-flex" />}
    </>
  );
}

function LineBody({ miss }: { miss: Miss }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Tiles are the same list as the text, with pictures: one or the other. */}
      {/* The first detail line is what the tiles show; any line after it (마스터라벨: places without one) stays. */}
      {(miss.tiles?.length ?? 0) > 1 ? (
        <>
          <Tiles tiles={miss.tiles!} cat={miss.cat} />
          {miss.detail.slice(1).map((d, i) => (
            <DetailLine key={i} text={d} />
          ))}
        </>
      ) : (
        miss.detail.map((d, i) => <DetailLine key={i} text={d} />)
      )}
      {miss.rows && (
        // A narrow list (a phone) has no room for a fourth column: the stats go under their row instead.
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground tabular-nums @sm:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
          {miss.rows.map((r, j) =>
            r.map((c, k) => (
              <span key={`${j}-${k}`} className={cn(
                  "whitespace-nowrap",
                  k === 0 && "flex items-center gap-1.5 text-foreground",
                  k === 2 && "text-right",
                  k === 3 && "col-span-full mb-1 pl-[26px] whitespace-normal @sm:col-span-1 @sm:mb-0 @sm:pl-0",
                )}
              >
                {k === 0 && miss.rowIcons?.[j] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={miss.rowIcons[j]!} alt="" loading="lazy" className="size-5 object-contain" />
                )}
                {k === 3 ? <Pieces text={c} /> : c}
              </span>
            )),
          )}
        </div>
      )}
    </div>
  );
}

/** The list: lines with more to show open on a press, the others are plain lines. */
function Lines({ items, chip }: { items: Miss[]; chip: boolean }) {
  return (
    <Accordion multiple className="overflow-hidden tile">
      {items.map((m, i) =>
        opens(m) ? (
          <AccordionItem key={i} value={`${i}`}>
            <AccordionTrigger className="min-h-[56px] items-center gap-3 rounded-none px-4 py-2.5 hover:bg-secondary/60 hover:no-underline">
              <LineHead miss={m} chip={chip} />
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <LineBody miss={m} />
            </AccordionContent>
          </AccordionItem>
        ) : (
          <div key={i} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 not-last:border-b">
            <LineHead miss={m} chip={chip} />
            {/* keeps the chip in line with the lines that carry an arrow */}
            <span className="size-4 shrink-0" aria-hidden="true" />
          </div>
        ),
      )}
    </Accordion>
  );
}

/**
 * Desktop: do the cards sit under the character (left) or above the list (right)? Whichever leaves the two columns
 * closer in height (user, 2026-11-17: "좌우 밸런스"). Rough heights are enough, and the answer comes from the result
 * alone, so nothing jumps to the other column when a line is opened.
 */
function cardsUnderCharacter(result: SpecResult, cards: number, lines: number, optimizer: boolean) {
  if (!cards || !lines) return false;
  const periods = periodGroups(result.periods ?? [], result.labelPlus ?? null);
  const character = 300 + (periods.length ? 44 + periods.reduce((sum, g) => sum + 40 + g.rows.length * 26, 0) : 0) + (optimizer ? 56 : 0);
  const asRows = 34 + cards * 92;
  const asGrid = 34 + 250;
  const lists = 34 + lines * 62 + (result.tips.length ? 44 + result.tips.length * 62 : 0);
  return Math.abs(character + asRows - lists) < Math.abs(character - (asGrid + lists));
}

function ListTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-0.5">
      <b className="text-[15px]">{title}</b>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

/** Stat cash items · pets · 마스터라벨 플러스 (시안 B, user 2026-11-17): title per kind, rows of what · date · days. */
function Periods({ result }: { result: SpecResult }) {
  const groups = periodGroups(result.periods ?? [], result.labelPlus ?? null);
  if (!groups.length) return null;
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg tile-edge">
      <b className="px-3.5 py-2.5 text-[13px]">남은 기간</b>
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-1.5 px-3.5 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <b className="text-[13px]">{g.title}</b>
            {g.value && <b className={cn("text-[13px]", g.warn ? "text-[oklch(0.63_0.182_24.3)]" : "text-foreground")}>{g.value}</b>}
          </div>
          {g.rows.map((r) => (
            <div key={`${r.what}-${r.date}`} className="grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-baseline gap-x-3">
              <DetailLine text={r.what} />
              <span className="font-num text-[13px] text-muted-foreground tabular-nums"><Digits>{r.date}</Digits></span>
              <b className={cn("text-right font-num text-[13px] tabular-nums", r.warn && "text-[oklch(0.63_0.182_24.3)]")}><Digits>{r.days}</Digits></b>
            </div>
          ))}
          {g.notes.map((n) => (
            <DetailLine key={n} text={n} />
          ))}
        </div>
      ))}
    </div>
  );
}

type ResultProps = { result: SpecResult; at: number; asOf?: string; optimizer: string | null; refreshing: boolean; refreshNote: string; onRefresh: () => void };

function Result({ result, at, asOf, optimizer, refreshing, refreshNote, onRefresh }: ResultProps) {
  const [open, setOpen] = useState(true);
  const n = result.misses.length;
  const top = result.misses.filter(fitsCard).slice(0, CARD_MAX);
  const rest = result.misses.filter((m) => !top.includes(m));
  const under = cardsUnderCharacter(result, top.length, rest.length, !!optimizer);
  // The lists fade out before the "open it" note comes in, so the two are never on the page together.
  const list = useReveal(n > 0 && open);
  const cards =
    list.shown && top.length > 0 ? (
      <div {...list.attrs} className="reveal flex flex-col gap-3">
        <ListTitle title="먼저 채울 것" note="보스 프리셋 기준" />
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5 @xl:grid-cols-3">
          {top.map((m, i) => (
            <TopCard key={i} miss={m} />
          ))}
        </ul>
      </div>
    ) : null;
  const p = result.presets;
  const presetText = [
    p.eq && `장비 ${p.eq}`,
    p.hyper && `하이퍼 ${p.hyper}`,
    p.link && `링크 ${p.link}`,
    p.ability && `어빌 ${p.ability}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="grid items-start gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* The character alone stays in view on a desktop while the list beside it grows as lines open. */}
      <div className={cn("@container flex min-w-0 flex-col gap-3", !under && "lg:sticky lg:top-4")}>
        <div className="relative flex flex-col gap-3.5 tile p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
              {result.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.image} alt={`${result.name} 캐릭터`} className="size-[230px] max-w-none shrink-0 object-contain" />
              ) : (
                <span className="text-[11px] text-muted-foreground">캐릭터</span>
              )}
            </span>
            {/* Only the name makes room for the button at the corner, so the line under it keeps the full width. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 self-center">
              <b className="pr-10 font-heading text-[22px] leading-tight break-all @sm:pr-[92px]">{result.name}</b>
              <span className="text-[13px] break-keep text-muted-foreground">
                Lv.{result.level} · {result.cls} · {result.world}
              </span>
              {asOf && <span className="text-xs font-semibold text-primary-text">{asOfLabel(asOf)}</span>}
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="다시 조회"
              title={`${fetchedAt(at)} 조회`}
              className="absolute top-4 right-4 inline-flex h-8 items-center gap-1 rounded-md tile-edge px-2 text-xs font-semibold whitespace-nowrap hover:bg-secondary disabled:opacity-60 sm:top-5 sm:right-5"
            >
              <SwapIcon on={refreshing} from={<RotateCw className="size-3.5" aria-hidden="true" />} to={<Spinner size={14} />} />
              <span className="hidden @sm:inline">다시 조회</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => n && setOpen((o) => !o)}
            aria-expanded={n ? open : undefined}
            className={cn(
              "press-static flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left",
              n
                ? "cursor-pointer border-[oklch(0.63_0.182_24.3_/_0.5)] bg-[oklch(0.63_0.182_24.3_/_0.12)] text-[oklch(0.63_0.182_24.3)]"
                : "cursor-default border-[oklch(0.678_0.134_152.4_/_0.5)] bg-[oklch(0.678_0.134_152.4_/_0.12)] text-[oklch(0.651_0.137_152.5)]",
            )}
          >
            {n ? <ShieldAlert className="size-[22px] shrink-0" aria-hidden="true" /> : <ShieldCheck className="size-[22px] shrink-0" aria-hidden="true" />}
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px]">{n ? `놓친 스펙 ${n}개` : "빠진 것 없음"}</b>
              <span className="text-xs opacity-85">{n ? "보스 기준 · 바로 되는 것부터" : "확인한 항목 모두 채움"}</span>
            </span>
            {n > 0 && <span className="ml-auto text-xs font-bold">{open ? "목록 닫기" : "목록 보기"}</span>}
          </button>

          <Periods result={result} />

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {presetText && <span>보스 프리셋: {presetText}</span>}
            {refreshNote && <span className="text-[oklch(0.63_0.182_24.3)]">{refreshNote}</span>}
            {!result.known && <span>새 직업 → 직업별 기준 없음, 공용 항목만 확인</span>}
          </div>

          {optimizer && (
            <a
              href={optimizer}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg tile-edge px-3.5 py-2.5 text-[13px] font-semibold hover:bg-secondary"
            >
              하이퍼 스탯 효율 배분 보기
              <span className="text-xs font-normal text-muted-foreground">외부 사이트</span>
              <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          )}
        </div>
        {under && cards && <div className="mt-2 flex flex-col gap-3">{cards}</div>}
      </div>

      <div className="@container flex min-w-0 flex-col gap-3">
        {!under && cards}
        {list.shown && rest.length > 0 && (
          <div {...list.attrs} className="reveal flex flex-col gap-3">
            <div className={cn(!under && top.length > 0 && "mt-2")}>
              <ListTitle title={top.length ? `나머지 ${rest.length}개` : "놓친 스펙"} note={top.length ? "줄을 누르면 펼쳐짐" : "보스 프리셋 기준"} />
            </div>
            <Lines items={rest} chip />
          </div>
        )}
        {n === 0 && (
          <div className="flex flex-col items-center gap-2 tile px-4 py-9 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[oklch(0.678_0.134_152.4_/_0.16)] text-[oklch(0.651_0.137_152.5)]">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base">빠진 것 없음</b>
            <span className="text-[13px] text-muted-foreground">확인하는 항목 모두 채움</span>
          </div>
        )}
        {n > 0 && !list.shown && (
          <div className="reveal tile px-4 py-9 text-center text-[13px] text-muted-foreground">왼쪽 배지 → 목록 열기</div>
        )}
        {result.tips.length > 0 && (
          <>
            <div className="mt-2">
              <ListTitle title="참고" note="개수에 안 셈 · 메소나 시간이 드는 것" />
            </div>
            <Lines items={result.tips} chip={false} />
          </>
        )}
      </div>
    </section>
  );
}

export function Message({ title, sub }: { title: string; sub: string }) {
  return (
    <section className="flex flex-col items-center gap-1.5 rounded-[1rem] border border-dashed border-border bg-card px-5 py-10 text-center">
      <b className="text-[15px]">{title}</b>
      <span className="text-[13px] text-muted-foreground">{sub}</span>
    </section>
  );
}

export function SpecCheck({ name, view }: { name: string; view: SpecView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(name);
  const [recent, setRecent] = useStored<string[]>(RECENT_KEY, []);
  const [refreshNote, setRefreshNote] = useState("");

  // Only characters that were found are remembered, newest first, under the name NEXON returned.
  const found = view.kind === "result" ? view.result.name : null;
  useEffect(() => {
    if (found) setRecent((prev) => [found, ...(Array.isArray(prev) ? prev : []).filter((n) => n !== found)].slice(0, RECENT_MAX));
  }, [found, setRecent]);
  const recentList = Array.isArray(recent) ? recent.filter((n): n is string => typeof n === "string") : [];

  const go = (q: string) => startTransition(() => router.push(`/spec?name=${encodeURIComponent(q)}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q) go(q);
  };

  const pick = (n: string) => {
    setText(n);
    go(n);
  };

  // The saved result is keyed by the name in the address, so that is the one dropped.
  const refresh = () => {
    setRefreshNote("");
    startTransition(async () => {
      if (await refreshSpec(name)) router.refresh();
      else setRefreshNote("지금은 다시 조회 못 함 → 잠시 뒤 다시");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="숨은 스펙업" description={SPEC_DESCRIPTION} aside={<SpecTabs on="person" />} />

      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 tile px-4 focus-within:border-primary">
          <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">캐릭터 닉네임</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="캐릭터 닉네임"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            className="h-[46px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="flex h-[50px] shrink-0 items-center gap-1.5 rounded-lg bg-primary px-[22px] text-[15px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending && <Spinner />}
          {pending ? "조회 중" : "검색"}
        </button>
      </form>

      {recentList.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-muted-foreground">최근 검색</span>
          {recentList.map((n) => (
            <span
              key={n}
              className={cn(
                "inline-flex items-center rounded-full border text-[13px]",
                n === found ? "border-primary bg-primary-soft text-primary-text" : "tile-edge bg-card",
              )}
            >
              <button type="button" onClick={() => pick(n)} disabled={pending} className="py-1.5 pr-1 pl-3 font-semibold">
                {n}
              </button>
              <button
                type="button"
                onClick={() => setRecent((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x !== n))}
                aria-label={`${n} 최근 검색에서 지우기`}
                className="py-1.5 pr-2.5 pl-1 opacity-60 hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={cn("transition-opacity", pending && "opacity-50")} aria-busy={pending}>
        {view.kind === "result" && (
          <Result
            key={`${view.result.name}-${view.at}`}
            result={view.result}
            at={view.at}
            asOf={view.asOf}
            optimizer={view.optimizer}
            refreshing={pending}
            refreshNote={refreshNote}
            onRefresh={refresh}
          />
        )}
        {view.kind === "empty" && <Message title="닉네임 검색" sub="보스 프리셋 기준으로 공용 스킬 · 아티팩트 · 5차 · 링크 · 어빌리티 등 확인" />}
        {view.kind === "notFound" && <Message title={`"${view.name}" 캐릭터 없음`} sub="닉네임 확인 · 2023년 12월 이후 접속 기록이 있어야 조회됨" />}
        {view.kind === "quota" && <Message title="오늘 조회 한도 다 씀" sub="넥슨 API 하루 한도 → 내일 다시 · 이미 조회한 캐릭터는 3시간 동안 바로 보임" />}
        {view.kind === "maintenance" && <Message title="넥슨 점검 중" sub="점검이 끝나면 다시 조회" />}
        {view.kind === "failed" && <Message title="조회 실패" sub="넥슨 API 응답 오류 → 잠시 뒤 다시" />}
      </div>

      <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <Pieces text={`확인하는 것: ${CHECKED}`} />
        <Pieces text="기준: 직업별 상위 캐릭터 대부분의 선택 · 보스 프리셋(장비 · 하이퍼 · 링크 · 어빌)을 찾아 그 세팅으로 확인" />
        <span>Data based on NEXON Open API</span>
      </div>
    </div>
  );
}
