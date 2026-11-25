"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Package, Pencil } from "lucide-react";
import { NumberField, Segment, eok, parseNum } from "@/components/ev/ui";
import { CARD_PAGE, CharacterFilter, ItemFilter, NO_ITEM_FILTER, PICK_W, ROW_PAGE, itemMatches, liveFilter } from "@/components/enhance/board-bits";
import { CHIP, Card, Delta, Empty, Gauge, EventFields, EventStrip, ItemIcon, PickedTotal, RankCard, RoundsIn, SKIP_LABEL, type EventTally, SortMenu, type Sort, Tile, TryBadges, signed, signedShort, tone } from "@/components/enhance/parts";
import { Pager, usePage } from "@/components/pager";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ItemOverrides } from "@/lib/enhance/items";
import { starAfter } from "@/lib/enhance/judge";
import { dayStart, kstFull, kstShort, kstWeekday } from "@/lib/enhance/kst";
import { eventGroups, roundsPerCard, splitGroup, starEventKind, type EventGroup, type EventScope } from "@/lib/enhance/events";
import { buildStats, entryKey, reachedFloor, type Entry, type ItemStat, type Stats, type Tally } from "@/lib/enhance/stats";
import { FLOOR_STAR } from "@/lib/ev/starforce";
import { Reveal } from "@/components/ui/reveal";
import { Digits } from "@/components/ui/digits";
import { MenuSelect } from "@/components/ui/menu-select";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* ───────────── 한눈에 ───────────── */

function Duo({ good, bad }: { good: Box; bad: Box }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pt-2 pb-3.5">
      <DuoBox {...good} className="bg-gain/10" />
      <DuoBox {...bad} className="bg-loss/10" />
    </div>
  );
}
/** `onOpen` = the box is an item: pressing it opens that item's tries. */
type Box = { label: string; title: string; value: number | null; sub: string; onOpen?: () => void };
function DuoBox({ label, title, value, sub, onOpen, className }: Box & { className: string }) {
  const body = (
    <>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {/* One line: a name on two lines made this box taller than the one next to it. */}
      <b className="truncate text-sm leading-snug" data-tip={title}>
        {title}
      </b>
      {value === null ? <b className="font-num text-lg text-muted-foreground">—</b> : <Delta v={value} className="text-lg" />}
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </>
  );
  const css = cn("flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5", className);
  if (!onOpen) return <div className={css}>{body}</div>;
  return (
    <button type="button" onClick={onOpen} className={cn(css, "text-left outline-none transition-[filter,scale] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:brightness-125")}>
      {body}
    </button>
  );
}

const tallyBox = (label: string, title: string, t: Tally): Box => ({
  label,
  title,
  value: t.tries ? t.delta : null,
  sub: t.tries ? `${t.tries.toLocaleString("ko-KR")}회 · 사용 ${eok(t.spent)}` : "기록 없음",
});
const itemBox = (label: string, it: ItemStat | undefined, onOpen: (key: string) => void): Box =>
  it
    ? { label, title: it.item, value: it.delta, sub: `${it.judged.toLocaleString("ko-KR")}회 · 파괴 ${it.destroy} · 사용 ${eok(it.spent)}`, onOpen: () => onOpen(it.key) }
    : { label, title: "해당 없음", value: null, sub: "" };

/** How a ranking card reads an item. Each ranking adds its own line under the name (after the character) and its value. */
const ITEM_RANK = { rowKey: (it: ItemStat) => it.key, name: (it: ItemStat) => it.item, info: (it: ItemStat) => it.info };

export function InsightView({ stats, onOpen }: { stats: Stats; onOpen: (key: string) => void }) {
  const judged = stats.items.filter((it) => it.judged > 0);
  const best = judged.filter((it) => it.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const worst = judged.filter((it) => it.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  // A run of one is not a streak. Whole lists: the cards show the top three.
  const wins = stats.items.filter((it) => it.win.n > 1).sort((a, b) => b.win.n - a.win.n || b.win.to - a.win.to);
  const booms = stats.items.filter((it) => it.destroy > 0).sort((a, b) => b.destroy - a.destroy || a.tries - b.tries);
  const fails = stats.items.filter((it) => it.streak.n > 1).sort((a, b) => b.streak.n - a.streak.n || b.streak.star - a.streak.star);
  const peak = Math.max(1, ...stats.weekdays.map(Math.abs));

  return (
    <>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-1 text-sm font-bold">
            <Package className="size-4 text-primary-text" aria-hidden="true" />
            행운의 아이템
          </h2>
          <Duo good={itemBox("행운", best, onOpen)} bad={itemBox("저주", worst, onOpen)} />
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-1 text-sm font-bold">
            <CalendarDays className="size-4 text-primary-text" aria-hidden="true" />
            이벤트 때 vs 평소
          </h2>
          <Duo good={tallyBox("이벤트 때", "할인 · 파괴 감소", stats.event)} bad={tallyBox("평소", "이벤트 없음", stats.plain)} />
        </Card>
      </div>
      {/* Wide screens: the three rankings in one row, weekdays underneath. Narrower: two by two. */}
      <div className="grid items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <RankCard {...ITEM_RANK} title="연속 성공이 많았던 아이템" empty="연속 성공 없음" rows={wins} sub={(it) => `${it.who} · ${it.win.from}성 → ${it.win.to}성`} value={(it) => `${it.win.n}번 연속 성공`} color="text-gain" onOpen={onOpen} />
        <RankCard {...ITEM_RANK} title="연속 실패가 많았던 아이템" empty="연속 실패 없음" rows={fails} sub={(it) => `${it.who} · ${it.streak.star}성에서`} value={(it) => `${it.streak.n}번 연속 실패`} color="text-loss" onOpen={onOpen} />
        <RankCard {...ITEM_RANK} title="파괴가 많았던 아이템" empty="파괴 없음" rows={booms} sub={(it) => `${it.who} · 강화 ${it.tries.toLocaleString("ko-KR")}번`} value={(it) => `파괴 ${it.destroy}번`} color="text-destructive" onOpen={onOpen} />
        <Card className="xl:col-span-3">
          <h2 className="px-4 pt-3.5 pb-1 text-sm font-bold">요일별 손익</h2>
          <div className="grid grid-cols-7 gap-1.5 px-4 pt-2 pb-4">
            {stats.weekdays.map((v, i) => (
              <div key={i} className="flex min-w-0 flex-col items-center gap-[3px]">
                <span className="flex h-12 items-end">
                  <span className="w-[22px] rounded-t-[3px] bg-gain" style={{ height: v > 0 ? Math.max(2, Math.round((v / peak) * 48)) : 0 }} />
                </span>
                <span className="h-px w-full bg-border" />
                <span className="flex h-12 items-start">
                  <span className="w-[22px] rounded-b-[3px] bg-loss" style={{ height: v < 0 ? Math.max(2, Math.round((-v / peak) * 48)) : 0 }} />
                </span>
                <b className="text-xs">{WEEKDAYS[i]}</b>
                {/* The short form, as in the calendar: seven columns on a phone are about 39px each. */}
                <span className={cn("font-num text-[11px] whitespace-nowrap", tone(v))}>{v === 0 ? "—" : signedShort(v)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

/* ───────────── 강화 내역 ───────────── */

const RESULT = {
  success: { label: "성공", text: "text-gain", bar: "var(--gain)" },
  fail: { label: "실패", text: "text-loss", bar: "var(--loss)" },
  destroy: { label: "파괴", text: "text-destructive", bar: "var(--destructive)" },
} as const;
const RESULT_OPTIONS = [{ value: "", label: "모든 결과" }, ...Object.entries(RESULT).map(([value, r]) => ({ value, label: r.label }))];

/** One try. `showItem` = with the item's picture and name (the log); the item window leaves them out. */
function TryRow({ entry, showItem }: { entry: Entry; showItem: boolean }) {
  const { row, j, info } = entry;
  const res = RESULT[row.r];
  return (
    <div
      className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:gap-3"
      style={{ boxShadow: `inset 3px 0 0 ${res.bar}` }}
    >
      <span className="flex flex-col gap-0.5">
        <b className={cn("text-xs", res.text)}>{res.label}</b>
        <b className="font-num text-[15px] whitespace-nowrap sm:text-base">
          <Digits>{`${row.from} → ${starAfter(row, j.restored)}`}</Digits>
        </b>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        {showItem && (
          <span className="flex min-w-0 items-center gap-2.5">
            <ItemIcon info={info} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-sm" data-tip={row.item}>
                {row.item}
              </b>
              <span className="truncate text-xs text-muted-foreground" data-tip={row.who}>
                {row.who}
              </span>
            </span>
          </span>
        )}
        <TryBadges row={row} restored={j.restored} />
      </span>
      <span className="flex flex-col items-end gap-0.5">
        {j.ok && (
          <span className="font-num text-[11px] whitespace-nowrap text-muted-foreground">
            {/* The struck price stays plain text: a line-through is not drawn across the boxes Digits puts each digit in. */}
            {j.list > j.cost + 0.5 && <s className="mr-1 opacity-70">{eok(j.list)}</s>}
            <Digits>{eok(j.cost)}</Digits>
          </span>
        )}
        {j.ok ? <Delta v={j.delta} className="text-sm" /> : <span className="text-xs whitespace-nowrap text-muted-foreground">{j.why ? SKIP_LABEL[j.why] : ""}</span>}
        <span className="text-[11px] whitespace-nowrap text-muted-foreground">{kstFull(row.t)}</span>
      </span>
    </div>
  );
}

const PAGE = 100;

const sfTally = (s: Stats): EventTally => ({ count: s.total, spent: s.spent, delta: s.judged > 0 ? s.delta : null });

/** The tries of one event, all of them and per round, counted as the cards count them (one buildStats each). */
function eventStats(entries: Entry[], group: EventGroup) {
  const split = splitGroup(entries, group, (e) => e.row.t, (e) => starEventKind(e.row));
  const all = buildStats(split.all);
  const rounds = split.rounds.map(buildStats);
  return { all, rounds, tallies: [all, ...rounds].map(sfTally), cards: roundsPerCard(split.rounds, entryKey) };
}

export function LogView({ entries, characters, hideLow, onHideLow }: { entries: Entry[]; characters: string[]; hideLow: boolean; onHideLow: (v: boolean) => void }) {
  const [who, setWho] = useState("");
  const [picked, setItem] = useState(NO_ITEM_FILTER);
  const [result, setResult] = useState("");
  // Items of the chosen character (every item when no character is chosen).
  const items = [...new Set(entries.filter((e) => !who || e.row.who === who).map((e) => e.row.item))].sort((a, b) => a.localeCompare(b, "ko"));
  const item = liveFilter(picked, items);
  const list = entries.filter(
    (e) => (!who || e.row.who === who) && itemMatches(e.row.item, item) && (!result || e.row.r === result) && (!hideLow || e.row.from >= FLOOR_STAR)
  );
  // Newest first, a page at a time (user, 2026-11-13: pages rather than a list that grows with "더 보기").
  const pager = usePage(`${who}|${item.picked}|${item.query}|${result}|${hideLow}`, list.length, ROW_PAGE);
  const top = useRef<HTMLDivElement>(null);
  const shown = list.slice(list.length - pager.to, list.length - pager.from).reverse();

  return (
    <Card className="overflow-hidden">
      {/* The count has a line of its own, as in 모아보기: next to the fields, a change of its digits moved the field
          that had just been used. */}
      <div ref={top} className="flex scroll-mt-4 flex-col gap-2.5 border-b border-border px-4 py-3">
        <b className="text-sm">
          강화 내역 <span className="font-medium text-muted-foreground">{list.length.toLocaleString("ko-KR")}건</span>
        </b>
        <div className="flex flex-wrap items-center gap-2.5">
          <CharacterFilter names={characters} value={who} onChange={(name) => (setWho(name), setItem(NO_ITEM_FILTER))} className={PICK_W.who} />
          <ItemFilter names={items} value={item} onChange={setItem} className={PICK_W.item} />
          <MenuSelect label="결과" value={result} onChange={setResult} options={RESULT_OPTIONS} />
          <label className="relative inline-flex items-center gap-1.5 text-[13px] after:absolute after:-inset-2">
            <input type="checkbox" checked={hideLow} onChange={(e) => onHideLow(e.target.checked)} className="size-4 accent-primary" />
            12성 미만 숨기기
          </label>
        </div>
      </div>
      {shown.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">해당 기록 없음</p>}
      {shown.map((e) => (
        <TryRow key={e.row.id} entry={e} showItem />
      ))}
      <Pager page={pager.page} pages={pager.pages} onPage={pager.go} anchor={top} className="border-t border-border py-3" />
    </Card>
  );
}

/* ───────────── 모아보기 ───────────── */

export function ItemsView({
  stats,
  entries,
  overrides,
  onOverrides,
  onOpen,
  hideLow,
  onHideLow,
}: {
  stats: Stats;
  entries: Entry[];
  overrides: ItemOverrides;
  onOverrides: (next: ItemOverrides) => void;
  /** `scope` = the picked event (and round): the window then counts the same tries as the card. */
  onOpen: (key: string, scope?: EventScope) => void;
  hideLow: boolean;
  onHideLow: (v: boolean) => void;
}) {
  const [sort, setSort] = useState<Sort>("spent");
  const [editing, setEditing] = useState("");
  const [picked, setFilter] = useState(NO_ITEM_FILTER);
  // One character, as in the 강화 내역 (user, 2026-11-14): the item list next to it follows it.
  const [pickedWho, setWho] = useState("");
  // One event, then one of its rounds (A안, user 2026-11-16): the cards count only the tries with that event on.
  const groups = useMemo(() => eventGroups(entries, (e) => e.row.t, (e) => starEventKind(e.row)), [entries]);
  const [pick, setPick] = useState({ group: "", round: "" });
  const group = groups.find((g) => g.label === pick.group);
  const round = group?.rounds.find((r) => r.id === pick.round);
  const scope = group ? { group, round } : undefined;
  const ev = useMemo(() => {
    const g = groups.find((x) => x.label === pick.group);
    return g ? eventStats(entries, g) : null;
  }, [groups, pick.group, entries]);
  const shown = !ev || !group ? stats : round ? ev.rounds[group.rounds.indexOf(round)] : ev.all;
  // Items whose level is unknown come first: they are the ones waiting for an answer.
  const unknown = (it: ItemStat) => (it.info.level > 0 ? 0 : 1);
  const visible = shown.items.filter((it) => !hideLow || reachedFloor(it));
  const characters = [...new Set(visible.map((it) => it.who))].sort((a, b) => a.localeCompare(b, "ko"));
  // A character with nothing left on screen (another period, the low-star switch) is dropped, like a picked item.
  const who = characters.includes(pickedWho) ? pickedWho : "";
  const ofWho = visible.filter((it) => !who || it.who === who);
  const names = ofWho.map((it) => it.item);
  const filter = liveFilter(picked, names);
  const items = ofWho
    .filter((it) => itemMatches(it.item, filter))
    .sort(
    (a, b) => unknown(b) - unknown(a) || (sort === "spent" ? b.spent - a.spent : sort === "delta" ? b.delta - a.delta : b.last - a.last) || b.tries - a.tries
  );
  const pager = usePage(`${pick.group}|${round?.id ?? ""}|${sort}|${hideLow}|${who}|${filter.picked}|${filter.query}`, items.length, CARD_PAGE);
  const top = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* B안 (user, 2026-11-14): the title, then one row of fields — character and item find a name, the round, and the
          order with the low-star switch in its menu. On a phone the fields go two to a row. */}
      <div ref={top} className="flex scroll-mt-4 flex-col gap-2.5">
        <b className="text-sm">
          아이템별 모아보기 <span className="font-medium text-muted-foreground">{items.length}개</span>
        </b>
        <div className="flex flex-wrap items-center gap-2">
          <CharacterFilter names={characters} value={who} onChange={setWho} className={PICK_W.who} />
          <ItemFilter names={names} value={filter} onChange={setFilter} className={PICK_W.item} />
          <EventFields groups={groups} group={group} round={round} onPick={(g, r) => setPick({ group: g, round: r })} tallies={ev?.tallies ?? []} unit="강화" className={PICK_W.event} />
          <SortMenu value={sort} onChange={setSort} hideLow={hideLow} onHideLow={onHideLow} className="ml-auto" />
        </div>
      </div>
      {!!(group && ev) && (
        <div>
        {group && ev && (
          <EventStrip group={group} round={round} tally={round ? ev.tallies[group.rounds.indexOf(round) + 1] : ev.tallies[0]} unit="강화" deltaLabel="기댓값 대비" destroy={shown.items.reduce((sum, it) => sum + it.destroy, 0)} />
        )}
      </div>
      )}
      {!!filter.picked && items.length > 0 && (
        <div>
        {filter.picked && items.length > 0 && (
          <PickedTotal spent={items.reduce((sum, it) => sum + it.spent, 0)} delta={items.some((it) => it.judged > 0) ? items.reduce((sum, it) => sum + (it.judged > 0 ? it.delta : 0), 0) : null} />
        )}
      </div>
      )}
      {items.length === 0 && <Empty>{visible.length === 0 ? "12성 이상 아이템 없음" : "해당 아이템 없음"}</Empty>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {/* The card being typed in stays on screen wherever it sorts to: a level typed into an unknown item makes it
            known after two digits, which moved it to another page and took the field away mid-number
            (Codex review, 2026-11-13). */}
        {items
          .filter((it, i) => (i >= pager.from && i < pager.to) || it.key === editing)
          .map((it) => {
          const noLevel = it.info.level <= 0;
          const open = editing === it.key || noLevel;
          return (
            <Card key={it.key} className="relative flex flex-col items-center p-3.5 text-center transition-[box-shadow] hover:shadow-tile-hover">
              {/* The whole card opens the item's tries; the pencil and the fields sit above this button. It lies over
                  the name, so the full name (cut to one line below) is its tooltip. Corner = the card's 16 less its
                  1px border. */}
              <button
                type="button"
                aria-label={`${it.item} 강화 내역 보기`}
                data-tip={it.item}
                data-tip-parent
                onClick={() => onOpen(it.key, scope)}
                className="absolute inset-0 rounded-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <span className="absolute top-3.5 left-3.5 text-xs text-muted-foreground">
                {kstShort(it.first)} ~ {kstShort(it.last)}
              </span>
              {!noLevel && (
                <button
                  type="button"
                  aria-label={`${it.item} 레벨 · 노작 가격 고치기`}
                  aria-expanded={open}
                  onClick={() => setEditing(open ? "" : it.key)}
                  className="absolute top-1.5 right-2 z-10 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none after:absolute after:-inset-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              )}
              <ItemIcon info={it.info} size={48} />
              <b className="mt-2 max-w-full truncate text-[15px]">{it.item}</b>
              <span className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">
                {noLevel ? "레벨 모름" : `Lv.${it.info.level}`} · {it.who}
                {it.copies > 1 && ` · ${it.copy}번째`}
              </span>
              <b className="mt-2.5 font-num text-[17px] whitespace-nowrap">
                ★{it.start} → ★{it.now}
              </b>
              {it.judged > 0 ? (
                <>
                  <b className="mt-1.5 font-num text-[28px] leading-[1.1] whitespace-nowrap">{eok(it.spent)}</b>
                  {it.worth > 0 ? (
                    <div className="mt-2 self-stretch text-left">
                      <Gauge label="사용 메소" used={it.spent} mean={it.worth}>
                        <span className="text-muted-foreground">기댓값</span> <b>{eok(it.worth)}</b>
                      </Gauge>
                    </div>
                  ) : (
                    <span className="mt-[3px] text-xs text-muted-foreground">사용 메소</span>
                  )}
                </>
              ) : (
                <span className="mt-2 text-xs text-muted-foreground">{noLevel ? "레벨 입력 → 손익 계산" : it.skip ? `${SKIP_LABEL[it.skip]} · 손익 제외` : ""}</span>
              )}
              {/* Pushed to the bottom: the cards of a row differ above it (a gauge, a line, nothing). */}
              <div className="mt-auto grid grid-cols-[1fr_1fr_1.4fr] gap-1.5 self-stretch pt-3">
                <Tile label="강화">
                  <b className="font-num text-sm whitespace-nowrap">{it.tries.toLocaleString("ko-KR")}번</b>
                </Tile>
                <Tile label="파괴">
                  <b className="font-num text-sm whitespace-nowrap">{it.destroy}번</b>
                </Tile>
                <Tile label="손익" className={it.judged > 0 && it.delta > 0 ? "bg-gain/10" : it.judged > 0 && it.delta < 0 ? "bg-loss/10" : ""}>
                  {it.judged > 0 ? <Delta v={it.delta} className="text-sm" /> : <b className="text-[13px] text-muted-foreground">제외</b>}
                </Tile>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                {it.top.success > 0 && <span className={cn(CHIP, "tile-edge")}>성공 {it.top.success}</span>}
                {it.top.fail > 0 && <span className={cn(CHIP, "tile-edge")}>실패 {it.top.fail}</span>}
                {it.top.destroy > 0 && <span className={cn(CHIP, "border-input bg-muted")}>파괴 {it.top.destroy}</span>}
              </div>
              {it.streak.n > 1 && (
                <span className={cn(CHIP, "mt-1.5 border-primary/50 bg-primary-soft text-primary-text")}>
                  {it.streak.star}성 · {it.streak.n}번 연속 실패
                </span>
              )}
              {group && ev && !round && group.rounds.length > 1 && <RoundsIn group={group} n={ev.cards.get(it.key) ?? 0} />}
              {/* Typing a level makes the item "known": keep its row open while the user is in it. */}
              <Reveal open={open} className="relative z-10 -mx-3.5 mt-3 self-stretch text-left" onFocus={() => setEditing(it.key)}>
                <ItemEdit it={it} overrides={overrides} onOverrides={onOverrides} />
              </Reveal>
            </Card>
          );
        })}
      </div>
      {/* Turning the page ends the typing: the card being typed in would follow to every page. */}
      <Pager page={pager.page} pages={pager.pages} onPage={(page) => (setEditing(""), pager.go(page))} anchor={top} />
    </>
  );
}

/** Every try of one item (one piece), newest first. Opened from a 모아보기 card or a ranking row. */
export function ItemDialog({ item: live, entries, onClose }: { item: ItemStat | null; entries: Entry[]; onClose: () => void }) {
  const [limit, setLimit] = useState(PAGE);
  // The window stays mounted between items (a `key` unmounted it in one frame, before its exit could play). While it
  // closes there is no item any more, so it goes on showing the last one it had.
  const [kept, setKept] = useState(live);
  if (live && live !== kept) setKept(live);
  const item = live ?? kept;
  // Every opening starts from the first page again, and so does another item.
  const liveKey = live?.key ?? "";
  const [openKey, setOpenKey] = useState(liveKey);
  if (liveKey !== openKey) {
    setOpenKey(liveKey);
    if (liveKey) setLimit(PAGE);
  }
  // Focus goes to the list itself when the window opens. Left to the default it lands on the first button inside,
  // which is "더 보기" at the very bottom of a long list, and the list opens scrolled down to it.
  const listRef = useRef<HTMLDivElement>(null);
  const list = item ? entries.filter((e) => entryKey(e) === item.key) : [];
  const shown = list.slice(-limit).reverse();
  const tiles = item
    ? [
        { label: "사용 메소", node: <b className="font-num text-lg leading-tight whitespace-nowrap">{eok(item.spent)}</b> },
        { label: "기댓값", node: <b className="font-num text-lg leading-tight whitespace-nowrap">{item.worth > 0 ? eok(item.worth) : "—"}</b> },
        { label: "손익", node: <Delta v={item.delta} className="text-lg leading-tight" /> },
      ]
    : [];

  return (
    <Dialog open={live !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent initialFocus={listRef} className="flex max-h-[86dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-clarity-mask="true">
        {item && (
          <>
            <div className="flex flex-col gap-3 border-b border-border p-4">
              {/* Room on the right for the close button. */}
              <div className="flex items-center gap-3 pr-9">
                <ItemIcon info={item.info} size={44} />
                <div className="flex min-w-0 flex-col gap-1">
                  {/* Not cut: this is where a name that is cut in the lists can be read whole. */}
                  <DialogTitle className="text-base leading-tight font-bold">{item.item}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {item.info.level > 0 ? `Lv.${item.info.level}` : "레벨 모름"} · {item.who}
                    {item.copies > 1 && ` · ${item.copy}번째`} · ★{item.start} → ★{item.now} · 강화 {item.tries.toLocaleString("ko-KR")}번 · 파괴 {item.destroy}번
                  </DialogDescription>
                </div>
              </div>
              {item.judged > 0 && (
                <div className="grid grid-cols-3 divide-x divide-border rounded-lg bg-muted py-2.5">
                  {tiles.map((t) => (
                    <div key={t.label} className="flex min-w-0 flex-col items-center gap-1 px-2">
                      <span className="text-xs text-muted-foreground">{t.label}</span>
                      {t.node}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div ref={listRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none">
              {shown.map((e) => (
                <TryRow key={e.row.id} entry={e} showItem={false} />
              ))}
              {list.length > limit && (
                <button type="button" onClick={() => setLimit(limit + PAGE)} className="press-static w-full border-t border-border py-3 text-[13px] font-semibold text-primary-text outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
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

/** Level and spare price typed by the user. Keeps its own text so "0." can be typed on the way to "0.5". */
function ItemEdit({ it, overrides, onOverrides }: { it: ItemStat; overrides: ItemOverrides; onOverrides: (next: ItemOverrides) => void }) {
  const [levelText, setLevelText] = useState(overrides.levels[it.item] ? String(overrides.levels[it.item]) : "");
  const [spareText, setSpareText] = useState(overrides.spares[it.item] !== undefined ? String(overrides.spares[it.item]) : "");
  const setLevel = (text: string) => {
    setLevelText(text);
    const levels = { ...overrides.levels };
    const n = Math.round(parseNum(text, 0));
    // Under 10 is someone still typing "250": do not judge the item as a Lv.2 one in between.
    if (n >= 10) levels[it.item] = Math.min(300, n);
    else delete levels[it.item];
    onOverrides({ ...overrides, levels });
  };
  const setSpare = (text: string) => {
    setSpareText(text);
    const spares = { ...overrides.spares };
    if (text === "") delete spares[it.item];
    else spares[it.item] = parseNum(text, 0);
    onOverrides({ ...overrides, spares });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-3.5 py-2.5">
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        레벨
        <NumberField label={`${it.item} 레벨`} value={levelText} onChange={setLevel} placeholder={it.info.level > 0 ? String(it.info.level) : "입력"} inputClassName="h-8 w-16" />
      </label>
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        노작
        <NumberField label={`${it.item} 노작 가격 (억)`} value={spareText} onChange={setSpare} decimal suffix="억" placeholder={String(it.info.spare / 1e8)} inputClassName="h-8 w-16" />
      </label>
    </div>
  );
}

/* ───────────── 달력 ───────────── */

const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const k = y * 12 + (m - 1) + n;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
};

function Step({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="relative flex size-8 items-center justify-center tile-sm outline-none after:absolute after:-inset-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** `from` · `to` = the period on screen (KST days): the calendar moves month by month or year by year inside it. */
export function CalendarView({ stats, from, to }: { stats: Stats; from: string; to: string }) {
  const first = from.slice(0, 7);
  const last = to.slice(0, 7);
  const [mode, setMode] = useState<"month" | "year">("month");
  const [picked, setPicked] = useState("");
  const clamp = (m: string) => (m < first ? first : m > last ? last : m);
  // Opens on the latest month that has tries.
  const ym = clamp(picked || (stats.months.at(-1)?.ym ?? last));
  const [year, mon] = ym.split("-").map(Number);
  const byMonth = new Map(stats.months.map((m) => [m.ym, m]));

  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const yearTotal = yearMonths.reduce((sum, m) => sum + (byMonth.get(m)?.delta ?? 0), 0);
  const peak = Math.max(1, ...yearMonths.map((m) => Math.abs(byMonth.get(m)?.delta ?? 0)));
  const month = byMonth.get(ym);
  const total = mode === "month" ? (month?.delta ?? 0) : yearTotal;

  const step = mode === "month" ? 1 : 12;
  const canBack = mode === "month" ? ym > first : year > Number(first.slice(0, 4));
  const canNext = mode === "month" ? ym < last : year < Number(last.slice(0, 4));
  const move = (n: number) => setPicked(clamp(addMonths(ym, n * step)));

  const lead = kstWeekday(dayStart(`${ym}-01`));
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  const scope = mode === "month" ? ym : `${year}-`;
  const lucky = [...stats.days.values()]
    .filter((d) => d.delta > 0 && d.date.startsWith(scope))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  return (
    <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="flex flex-col gap-3 p-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <Step label={mode === "month" ? "이전 달" : "이전 해"} disabled={!canBack} onClick={() => move(-1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Step>
            {/* One width for (nearly) every month and centred in it, digits of one width: the next button stays under
                the pointer while the months are stepped through. */}
            <h2 className="text-center font-num text-[15px] font-bold whitespace-nowrap min-[360px]:min-w-[12.5rem] sm:min-w-[14rem]">
              <Digits>{mode === "month" ? `${year}년 ${mon}월` : `${year}년`}</Digits> ·{" "}
              <span className={tone(total)}>
                <Digits>{signed(total)}</Digits>
              </span>
            </h2>
            <Step label={mode === "month" ? "다음 달" : "다음 해"} disabled={!canNext} onClick={() => move(1)}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Step>
          </div>
          <Segment
            label="달력 단위"
            value={mode}
            onChange={setMode}
            options={[
              { id: "month", label: "월" },
              { id: "year", label: "년" },
            ]}
            className="w-[112px]"
          />
        </div>

        {mode === "month" ? (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <span key={i} />;
                const day = stats.days.get(`${ym}-${String(d).padStart(2, "0")}`);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex h-[42px] min-w-0 flex-col justify-between rounded-md p-[5px] lg:h-[52px]",
                      !day ? "bg-muted/60 text-muted-foreground" : day.delta >= 0 ? "bg-gain/15" : "bg-loss/15"
                    )}
                  >
                    <span className="flex items-center gap-[3px] text-[11px] font-semibold">
                      {d}
                      {day?.event && <span className="size-[5px] rounded-full bg-primary" />}
                    </span>
                    {day && <span className={cn("font-num text-[10px] font-semibold whitespace-nowrap", tone(day.delta))}>{signedShort(day.delta)}</span>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
            {yearMonths.map((m, i) => {
              const data = byMonth.get(m);
              const inside = m >= first && m <= last;
              const v = data?.delta ?? 0;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!inside}
                  onClick={() => (setPicked(m), setMode("month"))}
                  className={cn(
                    "flex flex-col items-center gap-[3px] rounded-md px-0.5 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    inside ? "hover:bg-muted" : "opacity-50"
                  )}
                >
                  <span className="flex h-12 items-end">
                    <span className="w-[18px] rounded-t-[3px] bg-gain" style={{ height: v > 0 ? Math.max(2, Math.round((v / peak) * 48)) : 0 }} />
                  </span>
                  <span className="h-px w-full bg-border" />
                  <span className="flex h-12 items-start">
                    <span className="w-[18px] rounded-b-[3px] bg-loss" style={{ height: v < 0 ? Math.max(2, Math.round((-v / peak) * 48)) : 0 }} />
                  </span>
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {i + 1}월{data?.event && <span className="ml-[3px] inline-block size-[5px] rounded-full bg-primary align-middle" />}
                  </span>
                  <span className={cn("font-num text-[11px] whitespace-nowrap", data ? tone(v) : "text-muted-foreground")}>{data ? signedShort(v) : "—"}</span>
                </button>
              );
            })}
          </div>
        )}
        <span className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-gain" />
            이득
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-loss" />
            손해
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary" />
            이벤트
          </span>
        </span>
      </Card>
      <Card className="flex flex-col gap-2.5 p-[18px]">
        <h2 className="text-[15px] font-bold">운 좋은 날</h2>
        {lucky.length === 0 && <p className="border-t border-border pt-4 text-[13px] text-muted-foreground">이득 본 날 없음</p>}
        {lucky.map((d) => (
          <div key={d.date} className="flex items-center gap-3 border-t border-border py-2.5">
            <span className="w-11 shrink-0 font-num text-[13px] text-muted-foreground">
              <Digits>{`${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`}</Digits>
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]" data-tip={d.best?.label ?? `강화 ${d.tries}번`}>
              {d.best?.label ?? `강화 ${d.tries}번`}
            </span>
            <Delta v={d.delta} className="text-sm" />
          </div>
        ))}
      </Card>
    </div>
  );
}
