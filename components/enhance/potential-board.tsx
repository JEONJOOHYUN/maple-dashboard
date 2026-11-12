"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Package, Split } from "lucide-react";
import { NumberField, eok, parseNum } from "@/components/ev/ui";
import { BasisButton, BasisRow, ItemFilter, NO_ITEM_FILTER, PeriodBar, SyncBanners, ViewTabs, WorldStrip, itemMatches, liveFilter, useGroupsOff, useKnownGroups, usePeriod, useSync } from "@/components/enhance/board-bits";
import { Card, Delta, Empty, Gauge, ItemIcon, Select, Tile } from "@/components/enhance/parts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useItemDict, type Rolled } from "@/components/enhance/use-item-dict";
import { useInsights, useWorldOf } from "@/components/enhance/use-worlds";
import { itemIcon, type ItemInfo } from "@/lib/enhance/items";
import { DAY, dayStart, kstFull, kstShort, kstStamp } from "@/lib/enhance/kst";
import { buildPotStats, potEntries, potEntryKey, type PieceStat, type PotEntry } from "@/lib/enhance/pot-stats";
import { PRICED_CUBES, cubePriceDefault, feeByInsight, pricedCube, trackPieces, type CubePrices, type PricedCube } from "@/lib/enhance/potential";
import { PotentialSync, StarforceSync } from "@/lib/enhance/sync";
import { groupTallies, worldGroup } from "@/lib/enhance/worlds";
import { STAT_CONV_DEFAULT } from "@/lib/ev/defaults";
import { GRADE_LABEL, NEXT_GRADE, convFromScouter, type Grade } from "@/lib/ev/potential";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

type View = "insight" | "log" | "items";
const VIEWS: { id: View; label: string }[] = [
  { id: "insight", label: "강화 요약" },
  { id: "log", label: "재설정 내역" },
  { id: "items", label: "모아보기" },
];

const GRADE_CSS: Record<Grade, string> = {
  rare: "text-[#2b67cf] dark:text-[#78aeff]",
  epic: "text-[#6b3fd1] dark:text-[#b98cff]",
  unique: "text-[#7d5800] dark:text-[#f5c451]",
  legendary: "text-[#11663a] dark:text-[#7be0a0]",
};
const BADGE = "rounded border px-1.5 text-[11px] leading-[18px] font-semibold whitespace-nowrap";
const CUBE_NAME: Record<PricedCube, string> = { prime: "프라임 큐브", primeAddi: "프라임 에디셔널 큐브" };
const CUBE_SHORT: Record<PricedCube, string> = { prime: "프라임", primeAddi: "프라임 에디" };
const PAGE = 100;

/** Item name → picture address: what the character wears now, else the calculator's list, else the shared dictionary. */
type Icons = Record<string, string | undefined>;
const iconOf = (item: string, level: number, icons: Icons): ItemInfo => ({ level, spare: 0, icon: icons[item], source: "api" });
const kindLabel = (add: boolean) => (add ? "에디셔널" : "잠재능력");
const rolls = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}회`;

function GradeText({ grade }: { grade: Grade | null }) {
  return grade ? <b className={GRADE_CSS[grade]}>{GRADE_LABEL[grade]}</b> : <b className="text-muted-foreground">등급 없음</b>;
}

/** One roll: what it produced, what it cost. `showItem` = with the item's picture and name (the log). */
function RollRow({ entry, found, showItem }: { entry: PotEntry; found: Icons; showItem: boolean }) {
  const { row, taken, cost } = entry;
  const bar = row.up ? "var(--primary)" : taken ? "var(--gain)" : "var(--border)";
  return (
    <div
      className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:gap-3"
      style={{ boxShadow: `inset 3px 0 0 ${bar}` }}
    >
      <span className="flex flex-col gap-0.5 text-xs">
        <GradeText grade={row.grade} />
        <span className="text-muted-foreground">{kindLabel(row.add)}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        {showItem && (
          <span className="flex min-w-0 items-center gap-2.5">
            <ItemIcon info={iconOf(row.item, row.level, found)} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-sm">{row.item}</b>
              <span className="truncate text-xs text-muted-foreground">{row.who}</span>
            </span>
          </span>
        )}
        <span className="text-[13px] leading-snug">{row.after.join(" · ")}</span>
        {(row.up || taken || row.mt || !row.meso) && (
          <span className="flex flex-wrap gap-1">
            {row.up && <span className={cn(BADGE, "border-primary/50 bg-primary-soft text-primary-text")}>등급 상승</span>}
            {taken && <span className={cn(BADGE, "border-gain/50 bg-gain/10 text-gain")}>선택</span>}
            {row.mt && <span className={cn(BADGE, "border-primary/50 bg-primary-soft text-primary-text")}>미라클 타임</span>}
            {!row.meso && <span className={cn(BADGE, "border-border text-muted-foreground")}>{row.type}</span>}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <b className="font-num text-sm whitespace-nowrap">{cost > 0 ? eok(cost) : "—"}</b>
        <span className="text-[11px] whitespace-nowrap text-muted-foreground">{kstFull(row.t)}</span>
      </span>
    </div>
  );
}

function PieceCard({ piece, found, onOpen }: { piece: PieceStat; found: Icons; onOpen: () => void }) {
  const cubes = piece.rolls - piece.resets;
  // Bars: every grade-up together in one (rolls and averages add up), then the option it ended on.
  const bars: { key: string; label: ReactNode; used: number; mean: number }[] = [];
  const ups = piece.phases.filter((p) => p.up && p.expected !== null);
  if (ups.length > 0) {
    const to = NEXT_GRADE[ups[ups.length - 1].grade];
    bars.push({
      key: "up",
      label: `${GRADE_LABEL[ups[0].grade]}${to ? ` → ${GRADE_LABEL[to]}` : " 등급 상승"}`,
      used: ups.reduce((sum, p) => sum + p.rolls, 0),
      mean: ups.reduce((sum, p) => sum + (p.expected ?? 0), 0),
    });
  }
  const tail = piece.phases[piece.phases.length - 1];
  if (tail && !tail.up && tail.expected !== null) bars.push({ key: "goal", label: <b className="text-primary-text">{piece.goalBy || "옵션"}</b>, used: tail.rolls, mean: tail.expected });
  return (
    <Card className="relative flex flex-col items-center p-3.5 text-center hover:border-primary/60">
      <button type="button" aria-label={`${piece.item} ${kindLabel(piece.add)} 내역 보기`} onClick={onOpen} className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
      <span className="absolute top-3.5 left-3.5 text-xs text-muted-foreground">
        {kstShort(piece.first)} ~ {kstShort(piece.last)}
      </span>
      <ItemIcon info={iconOf(piece.item, piece.level, found)} size={48} />
      <b className="mt-2 max-w-full truncate text-[15px]">{piece.item}</b>
      <span className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">
        {kindLabel(piece.add)} · Lv.{piece.level} · {piece.who}
        {piece.of > 1 && ` · ${piece.n}번째`}
      </span>
      <span className="mt-2.5 flex items-baseline gap-1.5 text-base whitespace-nowrap">
        {piece.from !== piece.grade && (
          <>
            <GradeText grade={piece.from} />
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <GradeText grade={piece.grade} />
      </span>
      {piece.option.length > 0 && (
        <div className="mt-2 flex flex-col self-stretch rounded-md bg-muted px-3 py-1.5 text-[13px] leading-5 font-semibold">
          {piece.option.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      )}
      {piece.keptRolls !== null && (
        <span className="mt-1.5 max-w-full text-xs text-muted-foreground">
          기존 옵션 · {piece.keptBy} = 평균 {rolls(piece.keptRolls)}
          {piece.keptMeso !== null && ` · ${eok(piece.keptMeso)}`}
        </span>
      )}
      {piece.spent > 0 && (
        <>
          <b className="mt-2.5 font-num text-[28px] leading-[1.1] whitespace-nowrap">{eok(piece.spent)}</b>
          <span className="mt-[3px] text-xs text-muted-foreground">사용 메소{piece.expected !== null ? ` · 기댓값 ${eok(piece.expected)}` : piece.keptRolls !== null ? "" : " · 기댓값 없음"}</span>
        </>
      )}
      {/* The rolls it took against the average for the same result. Pinned to the bottom with the boxes under it:
          cards in one row differ in height, and the option bar and the boxes should line up across them. */}
      {bars.length > 0 && (
        <div className="mt-auto flex flex-col gap-2 self-stretch pt-2.5 text-left">
          {bars.map((bar) => (
            <Gauge key={bar.key} label={bar.label} used={bar.used} mean={bar.mean}>
              <b>{rolls(bar.used)}</b> <span className="text-muted-foreground">· 평균 {rolls(bar.mean)}</span>
            </Gauge>
          ))}
        </div>
      )}
      <div className={cn("grid grid-cols-[1fr_1fr_1.2fr] gap-1.5 self-stretch pt-3", bars.length === 0 && "mt-auto")}>
        <Tile label="재설정">
          <b className="font-num text-sm whitespace-nowrap">{rolls(piece.resets)}</b>
        </Tile>
        {cubes > 0 ? (
          <Tile label="큐브">
            <b className="font-num text-sm whitespace-nowrap">{cubes.toLocaleString("ko-KR")}개</b>
          </Tile>
        ) : (
          <Tile label="등급 상승">
            <b className="font-num text-sm whitespace-nowrap">{piece.ups}번</b>
          </Tile>
        )}
        <Tile label="손익" className={piece.delta !== null && piece.delta > 0 ? "bg-gain/10" : piece.delta !== null && piece.delta < 0 ? "bg-loss/10" : ""}>
          {piece.delta !== null ? <Delta v={piece.delta} className="text-sm" /> : <b className="text-[13px] text-muted-foreground">제외</b>}
        </Tile>
      </div>
    </Card>
  );
}

/** Every roll of one piece, newest first, with how each grade went. */
function PieceDialog({ piece, entries, found, onClose }: { piece: PieceStat | null; entries: PotEntry[]; found: Icons; onClose: () => void }) {
  const [limit, setLimit] = useState(PAGE);
  // Focus goes to the list: left to the default it lands on "더 보기" at the bottom and the list opens scrolled down.
  const listRef = useRef<HTMLDivElement>(null);
  const list = piece ? entries.filter((e) => potEntryKey(e) === piece.key) : [];
  const shown = list.slice(-limit).reverse();
  const tiles = piece
    ? [
        { label: "사용 메소", node: <b className="font-num text-lg leading-tight whitespace-nowrap">{piece.spent > 0 ? eok(piece.spent) : "—"}</b> },
        { label: "기댓값", node: <b className="font-num text-lg leading-tight whitespace-nowrap">{piece.expected !== null ? eok(piece.expected) : "—"}</b> },
        { label: "손익", node: piece.delta !== null ? <Delta v={piece.delta} className="text-lg leading-tight" /> : <b className="font-num text-lg leading-tight text-muted-foreground">—</b> },
      ]
    : [];

  return (
    <Dialog open={piece !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent initialFocus={listRef} className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-clarity-mask="true">
        {piece && (
          <>
            <div className="flex flex-col gap-3 border-b border-border p-4">
              <div className="flex items-center gap-3 pr-9">
                <ItemIcon info={iconOf(piece.item, piece.level, found)} size={44} />
                <div className="flex min-w-0 flex-col gap-1">
                  <DialogTitle className="truncate text-base leading-tight font-bold">{piece.item}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {kindLabel(piece.add)} · Lv.{piece.level} · {piece.part} · {piece.who}
                    {piece.of > 1 && ` · ${piece.n}번째`}
                  </DialogDescription>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg bg-muted py-2.5">
                {tiles.map((t) => (
                  <div key={t.label} className="flex min-w-0 flex-col items-center gap-1 px-2">
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                    {t.node}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                {piece.phases.map((phase, i) => (
                  <span key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                    <GradeText grade={phase.grade} />
                    <span>{rolls(phase.rolls)}</span>
                    <span className="text-muted-foreground">
                      {phase.expected !== null
                        ? `평균 ${rolls(phase.expected)}`
                        : !phase.up && i === piece.phases.length - 1 && piece.keptRolls !== null
                          ? `기존 옵션 그대로 · ${piece.keptBy} = 평균 ${rolls(piece.keptRolls)}`
                          : "평균 없음"}
                      {phase.up ? " → 등급 상승" : i === piece.phases.length - 1 && piece.goalBy ? ` (${piece.goalBy})` : ""}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div ref={listRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
              {shown.map((e) => (
                <RollRow key={e.row.id} entry={e} found={found} showItem={false} />
              ))}
              {list.length > limit && (
                <button type="button" onClick={() => setLimit(limit + PAGE)} className="w-full border-t border-border py-3 text-[13px] font-semibold text-primary-text outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                  더 보기 ({(list.length - limit).toLocaleString("ko-KR")}건 남음)
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Rank = { title: string; empty: string; pieces: PieceStat[]; value: (p: PieceStat) => string; sub: (p: PieceStat) => string };

/** Lucky and unlucky item, main vs additional potential, and the items that took the most meso, resets and cubes. */
function PotInsight({ stats, found, onOpen }: { stats: ReturnType<typeof buildPotStats>; found: Icons; onOpen: (key: string) => void }) {
  const priced = stats.pieces.filter((p) => p.delta !== null);
  const best = priced.filter((p) => p.delta! > 0).sort((a, b) => b.delta! - a.delta!)[0];
  const worst = priced.filter((p) => p.delta! < 0).sort((a, b) => a.delta! - b.delta!)[0];
  const side = (add: boolean) => {
    const list = stats.pieces.filter((p) => p.add === add);
    return { items: list.length, resets: list.reduce((n, p) => n + p.resets, 0), cubes: list.reduce((n, p) => n + p.rolls - p.resets, 0), spent: list.reduce((n, p) => n + p.spent, 0) };
  };
  const top = (pick: (p: PieceStat) => number) =>
    stats.pieces
      .filter((p) => pick(p) > 0)
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, 3);
  const ranks: Rank[] = [
    { title: "메소를 많이 쓴 아이템", empty: "메소 재설정 없음", pieces: top((p) => p.spent), value: (p) => eok(p.spent), sub: (p) => `재설정 ${rolls(p.resets)}` },
    { title: "재설정을 많이 돌린 아이템", empty: "메소 재설정 없음", pieces: top((p) => p.resets), value: (p) => rolls(p.resets), sub: (p) => `사용 ${eok(p.spent)}` },
    { title: "큐브를 많이 쓴 아이템", empty: "큐브 사용 없음", pieces: top((p) => p.rolls - p.resets), value: (p) => `${(p.rolls - p.resets).toLocaleString("ko-KR")}개`, sub: (p) => p.types.find((t) => !t.includes("재설정")) ?? "" },
  ];
  const luck = (label: string, p: PieceStat | undefined, css: string) => (
    <button
      type="button"
      disabled={!p}
      onClick={() => p && onOpen(p.key)}
      className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50", css)}
    >
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="text-sm leading-snug">{p ? p.item : "해당 없음"}</b>
      {p ? <Delta v={p.delta!} className="text-lg" /> : <b className="font-num text-lg text-muted-foreground">—</b>}
      <span className="text-[11px] text-muted-foreground">{p ? `${kindLabel(p.add)} · ${p.goalBy || "등급 상승"} · 사용 ${eok(p.spent)}` : ""}</span>
    </button>
  );
  const kind = (label: string, add: boolean) => {
    const t = side(add);
    // The same four lines as the lucky · unlucky boxes next to it, so the two cards are one height.
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <b className="text-sm leading-snug">아이템 {t.items.toLocaleString("ko-KR")}개</b>
        <b className="font-num text-lg">{t.spent > 0 ? eok(t.spent) : "—"}</b>
        <span className="text-[11px] text-muted-foreground">
          재설정 {rolls(t.resets)}
          {t.cubes > 0 && ` · 큐브 ${t.cubes.toLocaleString("ko-KR")}개`}
        </span>
      </div>
    );
  };

  return (
    <>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* The boxes fill their card: a long item name on one side must not leave the other card's boxes shorter. */}
        <Card className="flex flex-col">
          <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-1 text-sm font-bold">
            <Package className="size-4 text-primary-text" aria-hidden="true" />
            행운의 아이템
          </h2>
          <div className="grid flex-1 grid-cols-2 gap-2.5 px-4 pt-2 pb-3.5">
            {luck("행운", best, "bg-gain/10")}
            {luck("저주", worst, "bg-loss/10")}
          </div>
        </Card>
        <Card className="flex flex-col">
          <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-1 text-sm font-bold">
            <Split className="size-4 text-primary-text" aria-hidden="true" />
            잠재능력 vs 에디셔널
          </h2>
          <div className="grid flex-1 grid-cols-2 gap-2.5 px-4 pt-2 pb-3.5">
            {kind("잠재능력", false)}
            {kind("에디셔널", true)}
          </div>
        </Card>
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
        {ranks.map((rank) => (
          <Card key={rank.title} className="overflow-hidden">
            <h2 className="px-4 pt-3.5 pb-2 text-sm font-bold">{rank.title}</h2>
            {rank.pieces.length === 0 && <p className="border-t border-border px-4 py-6 text-center text-[13px] text-muted-foreground">{rank.empty}</p>}
            {rank.pieces.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onOpen(p.key)}
                className="grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border px-4 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <b className="font-num text-[15px] text-muted-foreground">{i + 1}</b>
                <span className="flex min-w-0 items-center gap-2.5">
                  <ItemIcon info={iconOf(p.item, p.level, found)} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <b className="truncate text-sm">{p.item}</b>
                    <span className="truncate text-xs text-muted-foreground">
                      {kindLabel(p.add)}
                      {p.of > 1 && ` ${p.n}번째`} · {rank.sub(p)}
                    </span>
                  </span>
                </span>
                <b className="font-num text-sm whitespace-nowrap">{rank.value(p)}</b>
              </button>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

type Sort = "spent" | "delta" | "recent";

function PiecesView({ pieces, found, onOpen }: { pieces: PieceStat[]; found: Icons; onOpen: (key: string) => void }) {
  const [sort, setSort] = useState<Sort>("spent");
  const [picked, setFilter] = useState(NO_ITEM_FILTER);
  const names = pieces.map((p) => p.item);
  const filter = liveFilter(picked, names);
  const list = pieces
    .filter((p) => itemMatches(p.item, filter))
    .sort((a, b) => (sort === "spent" ? b.spent - a.spent : sort === "delta" ? (b.delta ?? -Infinity) - (a.delta ?? -Infinity) : b.last - a.last) || b.rolls - a.rolls);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">
          아이템별 모아보기 <span className="font-medium text-muted-foreground">{list.length}개</span>
        </b>
        <span className="flex flex-wrap items-center gap-2">
          <ItemFilter names={names} value={filter} onChange={setFilter} />
          <Select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-card">
            <option value="spent">사용한 메소 순</option>
            <option value="delta">손익 순</option>
            <option value="recent">최근 재설정 순</option>
          </Select>
        </span>
      </div>
      {list.length === 0 && <Empty>해당 아이템 없음</Empty>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((piece) => (
          <PieceCard key={piece.key} piece={piece} found={found} onOpen={() => onOpen(piece.key)} />
        ))}
      </div>
    </>
  );
}

function RollsView({ entries, characters, found }: { entries: PotEntry[]; characters: string[]; found: Icons }) {
  const [who, setWho] = useState("");
  const [item, setItem] = useState("");
  const [kind, setKind] = useState("");
  const [only, setOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  // Items of the chosen character (every item when no character is chosen).
  const items = [...new Set(entries.filter((e) => !who || e.row.who === who).map((e) => e.row.item))].sort((a, b) => a.localeCompare(b, "ko"));
  const list = entries.filter(
    (e) => (!who || e.row.who === who) && (!item || e.row.item === item) && (!kind || (kind === "add") === e.row.add) && (!only || e.taken || e.row.up)
  );
  const shown = list.slice(-limit).reverse();
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
        <b className="text-sm">
          재설정 내역 <span className="font-medium text-muted-foreground">{list.length.toLocaleString("ko-KR")}건</span>
        </b>
        <Select aria-label="캐릭터" value={who} onChange={(e) => (setWho(e.target.value), setItem(""), setLimit(PAGE))}>
          <option value="">모든 캐릭터</option>
          {characters.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select aria-label="아이템" value={item} onChange={(e) => (setItem(e.target.value), setLimit(PAGE))} className="max-w-[180px]">
          <option value="">모든 아이템</option>
          {items.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
        <Select aria-label="종류" value={kind} onChange={(e) => (setKind(e.target.value), setLimit(PAGE))}>
          <option value="">잠재 · 에디셔널</option>
          <option value="main">잠재능력</option>
          <option value="add">에디셔널</option>
        </Select>
        <label className="inline-flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={only} onChange={(e) => (setOnly(e.target.checked), setLimit(PAGE))} className="size-4 accent-primary" />
          선택 · 등급 상승만
        </label>
      </div>
      {shown.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">해당 기록 없음</p>}
      {shown.map((e) => (
        <RollRow key={e.row.id} entry={e} found={found} showItem />
      ))}
      {list.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} className="w-full border-t border-border py-3 text-[13px] font-semibold text-primary-text outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          더 보기 ({(list.length - limit).toLocaleString("ko-KR")}건 남음)
        </button>
      )}
    </Card>
  );
}

/** `switcher` = the star force · potential switch, shown at the start of the period row. */
export function PotentialBoard({ apiKey, account, onForget, switcher }: { apiKey: string; account: string; onForget: () => void; switcher: ReactNode }) {
  const period = usePeriod();
  const { from, to } = period;
  const [view, setView] = useState<View>("insight");
  // How much the other lines are worth in main stat %: the same numbers the calculator's potential tab keeps.
  const [convText] = useStored<Record<string, string>>("ev:statConv", {});
  const conv = useMemo(() => {
    const n = (k: keyof typeof STAT_CONV_DEFAULT) => {
      const v = parseFloat(convText[k] ?? "");
      return Number.isFinite(v) ? v : STAT_CONV_DEFAULT[k];
    };
    return convFromScouter({ level: n("level"), v9: n("v9"), cd3: n("cd3"), atk1: n("atk1"), all1: n("all1") });
  }, [convText]);
  const [openPiece, setOpenPiece] = useState("");

  const [sync] = useState(() => new PotentialSync(apiKey, account));
  const { snap, loading, refresh } = useSync(sync, from, to, PotentialSync.serverSnapshot);

  // Pictures, with the shared item dictionary for what this account no longer wears. The rolls tell the
  // dictionary the level and part of their items in return.
  const rolled = useMemo(() => {
    const seen = new Map<string, Rolled>();
    for (const r of snap.rows) if (r.level > 0 && !seen.has(r.item)) seen.set(r.item, { item: r.item, level: r.level, part: r.part });
    return [...seen.values()];
  }, [snap.rows]);
  const names = useMemo(() => [...new Set(snap.rows.map((r) => r.item))], [snap.rows]);
  const dict = useItemDict(snap.status === "done", names, snap.found, rolled);
  const icons = useMemo(() => Object.fromEntries(names.map((name) => [name, itemIcon(name, snap.found, dict)])) as Icons, [names, snap.found, dict]);

  // Which item a roll belongs to is read from the rolls around it, so that needs every loaded roll, not only the period's.
  const pieces = useMemo(() => trackPieces(snap.rows), [snap.rows]);
  // A cube on an item up to Lv.120 is free for a character with enough 통찰력: asked for those characters only.
  const feeKey = useMemo(() => [...new Set(snap.rows.filter(feeByInsight).map((r) => r.who))].sort().join("\u0000"), [snap.rows]);
  const feeNames = useMemo(() => (feeKey ? feeKey.split("\u0000") : []), [feeKey]);
  const insights = useInsights(apiKey, account, feeNames, snap.status === "done" || snap.status === "error");
  // Prime cubes are bought with meso, so each one used costs its price: ours unless the user typed another (억).
  const [priceText, setPriceText] = useStored<Partial<Record<PricedCube, string>>>("enhance:cubePrice", {});
  const prices = useMemo(() => {
    const out: CubePrices = {};
    for (const cube of PRICED_CUBES) {
      const typed = priceText[cube] ?? "";
      if (typed !== "") out[cube] = parseNum(typed, 0) * 1e8;
    }
    return out;
  }, [priceText]);
  const pricedUsed = useMemo(() => PRICED_CUBES.filter((cube) => snap.rows.some((r) => pricedCube(r) === cube)), [snap.rows]);
  const inPeriod = useMemo(() => {
    const start = dayStart(from);
    const end = dayStart(to) + DAY;
    return potEntries(snap.rows.filter((r) => r.t >= start && r.t < end), pieces, insights, prices);
  }, [snap.rows, from, to, pieces, insights, prices]);
  // The rolls carry no world: it is read from the character (its star force tries, and where it is now).
  // The period's star force tries are fetched quietly once the rolls are in (days already saved cost no call), so
  // the worlds are right in a browser that never opened the star force tab too. A failure here is not shown: the
  // rolls are on screen either way, only told apart less well.
  const [groupsOff, toggleGroup] = useGroupsOff();
  const [tries] = useState(() => new StarforceSync(apiKey, account));
  const triesSnap = useSyncExternalStore(tries.subscribe, tries.getSnapshot, StarforceSync.serverSnapshot);
  const rollsIn = snap.status === "done";
  useEffect(() => {
    if (!rollsIn) return;
    tries.load(from, to);
    return () => tries.stop();
  }, [tries, rollsIn, from, to]);
  const worldOf = useWorldOf(apiKey, account, triesSnap.rows, triesSnap.at);
  const tallies = useMemo(() => groupTallies(inPeriod.map((e) => ({ world: worldOf(e.row.who, e.row.t), spent: e.cost }))), [inPeriod, worldOf]);
  const groups = useKnownGroups(account, tallies);
  const entries = useMemo(() => inPeriod.filter((e) => !groupsOff.includes(worldGroup(worldOf(e.row.who, e.row.t)))), [inPeriod, worldOf, groupsOff]);
  const stats = useMemo(() => buildPotStats(entries, conv), [entries, conv]);

  const tiles = [
    { label: "재설정", value: rolls(stats.resets) },
    { label: "큐브", value: `${stats.cubes.toLocaleString("ko-KR")}개` },
    { label: "등급 상승", value: `${stats.ups.toLocaleString("ko-KR")}번` },
  ];

  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]" data-clarity-mask="true">
      <PeriodBar
        state={period}
        loading={loading}
        onRefresh={refresh}
        lead={switcher}
        aside={
          pricedUsed.length > 0 && (
            <BasisButton summary={pricedUsed.map((cube) => `${CUBE_SHORT[cube]} ${eok(prices[cube] ?? cubePriceDefault(cube))}`).join(" · ")}>
              {pricedUsed.map((cube) => (
                <BasisRow key={cube} label={`${CUBE_NAME[cube]} 1개`}>
                  <NumberField
                    label={`${CUBE_NAME[cube]} 1개 가격 (억 메소)`}
                    value={priceText[cube] ?? ""}
                    onChange={(t) => setPriceText({ ...priceText, [cube]: t })}
                    placeholder={String(cubePriceDefault(cube) / 1e8)}
                    decimal
                    suffix="억"
                    inputClassName="h-8 w-16"
                  />
                </BasisRow>
              ))}
            </BasisButton>
          )
        }
        status={
          snap.at > 0 && (
            <span>{kstStamp(snap.at)} 조회</span>
          )
        }
      />

      <SyncBanners snap={snap} unit="회" onRetry={refresh} onForget={onForget} />

      {stats.rolls === 0 ? (
        snap.status === "done" &&
        (inPeriod.length > 0 ? (
          <Card>
            <WorldStrip tallies={groups} off={groupsOff} onToggle={toggleGroup} />
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">꺼 둔 월드의 기록만 있음</p>
          </Card>
        ) : (
          <Empty>이 기간에 잠재능력 기록 없음</Empty>
        ))
      ) : (
        <>
          <Card>
            <WorldStrip tallies={groups} off={groupsOff} onToggle={toggleGroup} />
            <div className="grid items-end gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:p-7">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-muted-foreground">사용 메소 · {period.label}</span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <b className="font-num text-[38px] leading-[1.05] lg:text-[52px]">{eok(stats.spent)}</b>
                  <span className="text-sm text-muted-foreground">메소</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {tiles.map((t) => (
                  <div key={t.label} className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                    <b className="truncate font-num text-lg">{t.value}</b>
                  </div>
                ))}
              </div>
            </div>
            <p className="px-5 pb-3.5 text-xs text-muted-foreground lg:px-7">
              아이템 {stats.pieces.length}개 ·{" "}
              <Link href="/ev" className="underline underline-offset-2 hover:text-foreground">
                주스탯 환산 = 기댓값 계산기 값
              </Link>
            </p>
          </Card>

          <ViewTabs views={VIEWS} value={view} onChange={setView} />

          {view === "insight" && <PotInsight stats={stats} found={icons} onOpen={setOpenPiece} />}
          {view === "log" && <RollsView entries={entries} characters={stats.characters} found={icons} />}
          {view === "items" && <PiecesView pieces={stats.pieces} found={icons} onOpen={setOpenPiece} />}
          <PieceDialog key={openPiece} piece={stats.pieces.find((p) => p.key === openPiece) ?? null} entries={entries} found={icons} onClose={() => setOpenPiece("")} />
        </>
      )}
    </div>
  );
}
