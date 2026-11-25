"use client";

import { memo, useActionState, useCallback, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCw, Users } from "lucide-react";
import { loadCharacters, refreshHomework, type RefreshState } from "@/app/homework/actions";
import { Picker } from "@/components/homework/picker";
import { Message } from "@/components/message";
import { PageHeader } from "@/components/page-header";
import { Face } from "@/components/revenue/face";
import { SheetHead } from "@/components/revenue/sheet-head";
import { ACCOUNT_COLORS, DIFF_STYLE, chip, focus, problemLine, sheetPanel } from "@/components/revenue/styles";
import { buttonVariants } from "@/components/ui/button";
import { Digits } from "@/components/ui/digits";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ViewTabs } from "@/components/ui/view-tabs";
import type { Item, Tally } from "@/lib/homework/model";
import { startingPick } from "@/lib/homework/pick";
import type { AccountBoard, AccountProblem, BoardData, Card, PickData, Sum } from "@/lib/homework/server";
import { useStored } from "@/lib/use-stored";
import { KEPT_KEY_PROBLEMS } from "@/lib/auth/key-problems";
import { cn } from "@/lib/utils";

const NONE: RefreshState = {};
const PROBLEMS: Record<AccountProblem, string> = {
  ...KEPT_KEY_PROBLEMS,
  quota: "이 키의 호출 한도 초과 → 잠시 뒤 새로 고침",
  busy: "넥슨 API 점검 중 → 잠시 뒤 새로 고침",
  failed: "넥슨 서버 연결 실패 → 새로 고침",
};
/** The four bars of a card, in the in-game scheduler's order. */
const METERS = [
  ["오늘", "today"],
  ["주간", "week"],
  ["보스", "bosses"],
  ["월간", "monthly"],
] as const;
type Metered = Record<(typeof METERS)[number][1], { done: number; total: number }>;
/** The tab of every account together. */
const ALL = "all";
const NO_CARDS: Card[] = [];

const accountName = (a: AccountBoard, index: number) => (a.name ? `${a.name} 계정` : `넥슨 계정 ${index + 1}`);
const countOf = (done: number, total: number) => `${done}/${total}`;
/** A character picked by hand can have nothing on the in-game scheduler. */
const nothingRegistered = (of: Metered) => METERS.every(([, key]) => of[key].total === 0);
/** What a character's card (or its small one on 전체 요약) says to a screen reader. */
const cardLabel = (c: Card) => `${c.name} ${c.hw.left ? `남은 숙제 ${c.hw.left}개` : "숙제 다 끝남"} · 스케줄러 열기`;
/** What is left first, in the scheduler's order within each half. */
const leftFirst = (items: Item[]) => [...items].sort((a, b) => Number(a.done) - Number(b.done));

/** How much of a group is done. Nothing registered = a dashed track, so the rows of every card keep their place. */
function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  if (!total) return <span aria-hidden="true" className="block h-2 rounded-full border border-dashed border-border" />;
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="block h-2 overflow-hidden rounded-full bg-muted">
      <span className={cn("block h-full rounded-full", done === total ? "bg-muted-foreground/45" : "bg-primary")} style={{ width: `${(done / total) * 100}%` }} />
    </span>
  );
}

/** The title line. `pick` = the button that opens the picker (as on boss revenue), with how many characters are on show. */
function Head({ time, pick }: { time?: string; pick?: { count: number; busy: boolean; onOpen: () => void } }) {
  const [state, action, pending] = useActionState(refreshHomework, NONE);
  return (
    <PageHeader
      title="숙제 현황"
      // Where the list comes from, said once and first: nothing is set up here, the game's own scheduler is.
      description={time !== undefined && "게임 스케줄러에 등록한 숙제 그대로 · 게임에서 등록을 바꾸면 자동 반영"}
      aside={
        time !== undefined && (
          <form action={action} className="flex items-center gap-1 text-[13px] text-muted-foreground">
            {state.error ? (
              <span role="alert" className="font-semibold text-destructive">
                {state.error}
              </span>
            ) : (
              time && <span className="whitespace-nowrap">{time} 기준</span>
            )}
            <button type="submit" aria-label="새로 고침" disabled={pending} className={cn("grid size-10 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50", focus)}>
              {pending ? <Spinner /> : <RotateCw className="size-4" aria-hidden="true" />}
            </button>
            {pick && (
              <button type="button" onClick={pick.onOpen} disabled={pick.busy} className={cn("ml-1 inline-flex h-9 items-center gap-1.5 tile-sm px-3.5 text-[13px] font-bold text-foreground hover:bg-muted disabled:opacity-50", focus)}>
                {pick.busy ? <Spinner size={15} /> : <Users className="size-[15px]" aria-hidden="true" />}
                캐릭터 <span className="font-num">{pick.count}</span>명
              </button>
            )}
          </form>
        )
      }
    />
  );
}

/** One of the four numbers at the top. On a phone the reset and the count go under the bar, so nothing is cut. */
function Stat({ label, tally, reset }: { label: string; tally: Tally; reset: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-3 tile px-4 py-[18px] [grid-template-areas:'label_label''left_left''bar_bar''reset_count'] lg:px-5 lg:[grid-template-areas:'label_reset''left_count''bar_bar']">
      <b className="text-sm [grid-area:label]">{label}</b>
      <span className="text-xs whitespace-nowrap text-muted-foreground [grid-area:reset]">{reset}</span>
      <span className="flex items-baseline gap-1.5 [grid-area:left]">
        <span className={cn("font-num text-[30px] leading-none font-bold lg:text-[32px]", tally.left ? "text-primary-text" : "text-muted-foreground")}>{tally.left}</span>
        <span className="text-[13px] font-semibold whitespace-nowrap">개 남음</span>
      </span>
      <span className="text-right font-num text-[13px] font-bold whitespace-nowrap [grid-area:count]">
        {tally.done}
        <span className="font-light text-muted-foreground"> / {tally.total}</span>
      </span>
      <span className="[grid-area:bar]">
        <Bar done={tally.done} total={tally.total} label={label} />
      </span>
    </div>
  );
}

/** Done = a quiet check; left = how far it is, or "남음". */
function Mark({ item }: { item: Item }) {
  if (item.done) return <Check className="size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.5} role="img" aria-label="끝남" />;
  return <span className="shrink-0 font-num text-xs font-bold text-primary-text">{item.progress ?? "남음"}</span>;
}

/** The homework of the sheet as rows, what is left first; `two` = two columns once the sheet has the room. */
function Lines({ items, two }: { items: Item[]; two?: boolean }) {
  if (!items.length) return <p className="px-1 text-xs text-muted-foreground">등록한 것 없음</p>;
  return (
    <ul className={cn("grid gap-1", two && "@md:grid-cols-2 @md:gap-x-2")}>
      {leftFirst(items).map((it) => (
        <li key={`${it.name}|${it.diff ?? ""}`} className={cn("flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-2.5 text-[13px]", it.done ? "text-muted-foreground" : "bg-primary-soft font-semibold")}>
          {it.diff && (
            <span className={chip} style={DIFF_STYLE[it.diff]}>
              {it.diff}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate" data-tip={it.name}>
            {it.name}
            {it.done && it.progress && <span className="ml-1.5 font-num text-xs">{it.progress}</span>}
          </span>
          <Mark item={it} />
        </li>
      ))}
    </ul>
  );
}

const box = "flex min-w-0 flex-col gap-2.5 rounded-[14px] tile-edge bg-background p-3.5";
const SUB = "px-1 text-xs font-bold text-muted-foreground";

/** The title line of a box of the sheet, with the bar of what is done under it. */
function BoxHead({ title, note, done, total }: { title: string; note: React.ReactNode; done: number; total: number }) {
  return (
    <>
      <div className="flex items-baseline gap-2 px-1">
        <b className="shrink-0 text-sm">{title}</b>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{note}</span>
        {total > 0 && <span className="ml-auto shrink-0 font-num text-sm font-bold">{countOf(done, total)}</span>}
      </div>
      {total > 0 && (
        <div className="px-1">
          <Bar done={done} total={total} label={title} />
        </div>
      )}
    </>
  );
}

/** A titled list of the sheet: 계정 숙제 · 오늘 · 이번 주. */
function Box({ title, note, items, two }: { title: string; note: string; items: Item[]; two?: boolean }) {
  return (
    <section className={box}>
      <BoxHead title={title} note={note} done={items.filter((i) => i.done).length} total={items.length} />
      <Lines items={items} two={two} />
    </section>
  );
}

/** The bosses of the sheet: monthly first, then the week's, as the in-game scheduler lists them. */
function BossBox({ card }: { card: Card }) {
  const { bosses, monthly } = card.hw;
  return (
    <section className={box}>
      <BoxHead
        title="보스"
        note={
          card.limit > 0 && (
            <>
              주간 처치 제한{" "}
              <span className="font-num font-bold text-foreground">
                {card.clears} / {card.limit}
              </span>
            </>
          )
        }
        done={bosses.done}
        total={bosses.total}
      />
      <span className={SUB}>월간</span>
      <Lines items={monthly.items} two />
      <span className={SUB}>주간</span>
      <Lines items={bosses.items} two />
    </section>
  );
}

const badge = "ml-auto inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold whitespace-nowrap";

/** What is left of a character or an account, at the right end of its head line. */
function LeftBadge({ left, of }: { left: number; of: Metered }) {
  if (left > 0)
    return (
      <span className={cn(badge, "bg-primary-soft text-primary-text")}>
        <span className="font-num text-base leading-none font-bold">{left}</span>남음
      </span>
    );
  if (nothingRegistered(of)) return <span className={cn(badge, "bg-muted text-muted-foreground")}>등록한 숙제 없음</span>;
  return (
    <span className={cn(badge, "bg-muted pl-2.5 text-muted-foreground")}>
      <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />다 끝남
    </span>
  );
}

/** The four bars of a character or an account. `className` lays them out: a column on a character's card, two by two on an account's. */
function Meters({ of, className }: { of: Metered; className: string }) {
  return (
    <span className={className}>
      {METERS.map(([label, key]) => {
        const g = of[key];
        return (
          <span key={key} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-2.5">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            <Bar done={g.done} total={g.total} label={label} />
            <span className="text-right font-num text-[13px] font-bold">{g.total ? <Digits>{countOf(g.done, g.total)}</Digits> : "–"}</span>
          </span>
        );
      })}
    </span>
  );
}

/** One piece of an account's own homework: done, or left with how far it is. */
function SharedChip({ it }: { it: Item }) {
  return (
    <li className={cn("inline-flex h-8 max-w-full items-center gap-1.5 rounded-[9px] pl-2.5 text-[13px]", it.done ? "tile-edge bg-background pr-2 text-muted-foreground" : "bg-primary-soft pr-2.5 font-semibold")}>
      <span className="truncate">{it.name}</span>
      {it.done && it.progress && <span className="font-num text-xs">{it.progress}</span>}
      <Mark item={it} />
    </li>
  );
}

/** An account as the page groups it: its own homework in one list, its four numbers, its characters. */
type Group = { id: string; name: string; color: string; items: Item[]; done: number; sum: Sum; left: number; cards: Card[] };
type OpenCard = (ocid: string) => void;
type KeepRef = (ocid: string, el: HTMLButtonElement | null) => void;

/**
 * An account on the 전체 요약 tab: what is left of it, its four bars, its characters (press one for its scheduler)
 * and what is left of the account's own homework. The name opens the account's tab.
 */
function AccountCard({ group: g, faces, shownId, onTab, onOpen, onRef }: { group: Group; faces: Record<string, string>; shownId: string | null; onTab: (id: string) => void; onOpen: OpenCard; onRef: KeepRef }) {
  const left = g.items.filter((it) => !it.done);
  return (
    <section aria-label={g.name} className="@container flex flex-col gap-[18px] tile p-5">
      <div className="flex items-center gap-2">
        <i aria-hidden="true" className="size-[9px] shrink-0 rounded-full" style={{ background: g.color }} />
        <button type="button" onClick={() => onTab(g.id)} className={cn("-my-2 min-w-0 truncate rounded-md py-2 text-[17px] font-bold hover:text-primary-text", focus)}>
          {g.name}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          캐릭터 <span className="font-num">{g.cards.length}</span>명
        </span>
        <span className="ml-auto flex shrink-0 items-baseline gap-[5px]">
          <span className={cn("font-num text-[28px] leading-none font-bold", g.left ? "text-primary-text" : "text-muted-foreground")}>{g.left}</span>
          <span className="text-[13px] font-semibold whitespace-nowrap">개 남음</span>
        </span>
      </div>
      {/* Side by side once the card has the room for two bars of a readable length. */}
      <Meters of={g.sum} className="grid gap-2.5 @sm:grid-cols-2 @sm:gap-x-7" />
      {g.cards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(170px,100%),1fr))] gap-1.5">
          {g.cards.map((c) => (
            <button
              key={c.ocid}
              type="button"
              ref={(el) => onRef(c.ocid, el)}
              aria-haspopup="dialog"
              aria-label={cardLabel(c)}
              onClick={() => onOpen(c.ocid)}
              className={cn("flex min-h-14 items-center gap-2.5 rounded-xl tile-edge bg-background py-2 pr-3 pl-2 text-left", focus, shownId === c.ocid && "bg-muted")}
            >
              <Face src={faces[c.ocid]} name={c.name} />
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[13px]" data-tip={c.name}>
                  {c.name}
                </b>
                <span className="truncate text-xs text-muted-foreground">{c.chips.length ? c.chips.join(" · ") : nothingRegistered(c.hw) ? "등록한 숙제 없음" : "다 끝남"}</span>
              </span>
              {c.hw.left > 0 ? <span className="ml-auto shrink-0 font-num text-[17px] font-bold text-primary-text">{c.hw.left}</span> : <Check className="ml-auto size-4 shrink-0 text-muted-foreground/70" strokeWidth={2.5} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {/* Last in every card, so the cards of a row end on one line. */}
      <div className="mt-auto flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1.5">
        <b className="text-[13px]">계정 숙제</b>
        {g.items.length > 0 && <span className="font-num text-[13px] font-bold text-muted-foreground">{countOf(g.done, g.items.length)}</span>}
        {left.length > 0 ? (
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {left.map((it) => (
              <SharedChip key={it.name} it={it} />
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-muted-foreground">{g.items.length ? "다 끝남" : "등록한 것 없음"}</span>
        )}
      </div>
    </section>
  );
}

/**
 * A character's card. Kept from drawing again when another card's sheet opens or the sheet steps on: with 36
 * characters that is a few thousand elements each time.
 */
const CharCard = memo(function CharCard({ card: c, face, shown, onOpen, onRef }: { card: Card; face?: string; shown: boolean; onOpen: OpenCard; onRef: KeepRef }) {
  return (
    <button
      type="button"
      ref={(el) => onRef(c.ocid, el)}
      aria-haspopup="dialog"
      aria-label={cardLabel(c)}
      onClick={() => onOpen(c.ocid)}
      className={cn("flex min-h-[244px] flex-col gap-4 tile p-5 text-left hover:shadow-tile-hover", focus, shown && "shadow-tile-hover")}
    >
      <span className="flex items-center gap-3">
        <Face src={face} name={c.name} />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[15px]" data-tip={c.name}>
            {c.name}
          </b>
          <span className="truncate text-xs text-muted-foreground">
            Lv.{c.level} · {c.job}
          </span>
        </span>
        <LeftBadge left={c.hw.left} of={c.hw} />
      </span>
      <Meters of={c.hw} className="flex flex-col gap-2.5" />
      <span className="mt-auto flex min-h-7 flex-wrap content-start gap-1.5">
        {c.chips.map((chip) => (
          <span key={chip} className="inline-flex h-7 items-center rounded-lg tile-edge bg-background px-2.5 text-xs font-medium whitespace-nowrap normal-nums">
            {chip}
          </span>
        ))}
      </span>
    </button>
  );
});

/** A member's homework: four numbers, the account-wide homework, a card per character, and a character's scheduler in a sheet. */
export function Board({ data }: { data: BoardData | null }) {
  // Faces come from what boss revenue already keeps in this browser: no call is spent on them here.
  const [faces] = useStored<Record<string, string>>("revenue:faces", {});
  // `sheetId` stays after closing, so the sheet keeps its content while it leaves.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 전체 요약, or the id of the account on show (only with more than one account).
  const [tab, setTab] = useState(ALL);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // The picker: every character of the accounts, asked for when it opens (the lists are already kept on the server).
  const [choices, setChoices] = useState<PickData | null>(null);
  const [picking, setPicking] = useState(false);
  const [loadingChoices, startChoices] = useTransition();
  const openPicker = () =>
    startChoices(async () => {
      const found = await loadCharacters();
      if (!found) return;
      setChoices({ ...found, picked: startingPick(found, (data?.cards ?? []).map((c) => c.ocid)) });
      setPicking(true);
    });
  const open = useCallback((ocid: string) => {
    setSheetId(ocid);
    setSheetOpen(true);
  }, []);
  const keepRef = useCallback((ocid: string, el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(ocid, el);
    else cardRefs.current.delete(ocid);
  }, []);
  // Each account with its own homework (today's and the week's in one list) and its cards, once: the tabs, the
  // tiles and the sheet all read it. The cards come grouped by account (lib/homework/server.ts boardData).
  const groups = useMemo(
    () =>
      (data?.accounts ?? []).map((a, i): Group => ({
        id: String(a.id),
        name: accountName(a, i),
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
        items: [...a.shared.today.items, ...a.shared.week.items],
        done: a.shared.today.done + a.shared.week.done,
        sum: a.sum,
        left: a.left,
        cards: data!.cards.filter((c) => c.accountId === a.id),
      })),
    [data]
  );

  if (!data)
    return (
      <div className="flex flex-col gap-2">
        <Head time="" />
        <Message title="숙제를 불러오지 못함" sub="잠시 뒤 새로 고침" />
      </div>
    );
  const { accounts, cards, sum, daily, weekly } = data;
  if (accounts.length === 0)
    return (
      <div className="flex flex-col gap-2">
        <Head />
        <Message title="등록한 넥슨 계정 없음" sub="API 키를 등록하면 게임 스케줄러의 숙제가 여기에">
          <Link href="/me" className={cn(buttonVariants(), "mt-2 h-10 rounded-lg px-4 font-bold")}>
            내 정보에서 API 키 등록
          </Link>
        </Message>
      </div>
    );

  if (picking && choices)
    return (
      <div className="flex flex-col gap-2" data-clarity-mask="true">
        <Head />
        <Picker data={choices} onDone={() => setPicking(false)} />
      </div>
    );

  const weekReset = `${weekly.days}일 ${weekly.hours}시간 뒤`;
  // An account with nothing to show has no tab. One account = no tabs: the page is that account.
  const filled = groups.filter((g) => g.items.length > 0 || g.cards.length > 0);
  const tabbed = filled.length > 1;
  // undefined = 전체 요약 (also when the account of the tab is gone after a refresh).
  const group = tabbed ? filled.find((g) => g.id === tab) : filled[0];
  const shown = group?.cards ?? NO_CARDS;
  // The sheet steps through the characters of one account: the tab's, or on 전체 요약 the account of the one opened.
  const sheetGroup = group ?? filled.find((g) => g.cards.some((c) => c.ocid === sheetId));
  const stepped = sheetGroup?.cards ?? NO_CARDS;
  const sheetIdx = stepped.findIndex((c) => c.ocid === sheetId);
  const sheet = sheetIdx >= 0 ? stepped[sheetIdx] : null;
  const goSheet = (step: number) => setSheetId(stepped[(sheetIdx + step + stepped.length) % stepped.length].ocid);
  const totals = group?.sum ?? sum;
  const failed = accounts.reduce((n, a) => n + a.failed, 0);
  const nothing = filled.length === 0 && accounts.every((a) => !a.problem);

  return (
    <div className="flex flex-col gap-2" data-clarity-mask="true">
      <Head time={data.time} pick={{ count: cards.length, busy: loadingChoices, onOpen: openPicker }} />
      {accounts.map(
        (a, i) =>
          a.problem && (
            <p key={a.id} role="alert" className={problemLine}>
              {groups[i].name} · {PROBLEMS[a.problem]}
            </p>
          )
      )}
      {failed > 0 && <p className={problemLine}>{failed}명의 스케줄러를 못 받음 → 새로 고침</p>}

      {nothing ? (
        <Message title="게임 스케줄러에 등록한 숙제 없음" sub="게임에서 등록하면 여기에 보임 · 다른 캐릭터는 위의 캐릭터 버튼으로" />
      ) : (
        <>
          {/* People play an account at a time: a tab per NEXON account, and one that adds them up. */}
          {tabbed && <ViewTabs label="계정" views={[{ id: ALL, label: "전체 요약" }, ...filled.map((g) => ({ id: g.id, label: g.name }))]} value={group ? group.id : ALL} onChange={setTab} />}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="오늘" tally={totals.today} reset={`${daily.hours}시간 ${daily.minutes}분 뒤`} />
            <Stat label="주간" tally={totals.week} reset={weekReset} />
            <Stat label="주간 보스" tally={totals.bosses} reset={weekReset} />
            <Stat label="월간 보스" tally={totals.monthly} reset="매달" />
          </div>

          {!group && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-2">
              {filled.map((g) => (
                <AccountCard key={g.id} group={g} faces={faces} shownId={sheetOpen ? sheetId : null} onTab={setTab} onOpen={open} onRef={keepRef} />
              ))}
            </div>
          )}
          {/* What the account shares, then its characters: the shared homework belongs with the characters that can do it. */}
          {group && group.items.length > 0 && (
            <div className="flex flex-col gap-3 tile px-5 py-[18px]">
              <div className="flex items-baseline gap-2">
                <b className="shrink-0 text-[15px]">계정 숙제</b>
                <span className="min-w-0 truncate text-xs text-muted-foreground">어느 캐릭터로 하든 같이 끝남</span>
                <span className="ml-auto shrink-0 font-num text-sm font-bold">{countOf(group.done, group.items.length)}</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {group.items.map((it) => (
                  <SharedChip key={it.name} it={it} />
                ))}
              </ul>
            </div>
          )}
          {shown.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-2">
              {shown.map((c) => (
                <CharCard key={c.ocid} card={c} face={faces[c.ocid]} shown={sheetOpen && sheetId === c.ocid} onOpen={open} onRef={keepRef} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={sheetOpen && sheetIdx >= 0} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          // Back to the card of the character on show, which prev / next may have changed.
          finalFocus={() => (sheetId && cardRefs.current.get(sheetId)) || true}
          className={sheetPanel}
          data-clarity-mask="true"
        >
          {sheet && (
            <>
              <SheetHead face={faces[sheet.ocid]} name={sheet.name} index={sheetIdx} count={stepped.length} onStep={goSheet}>
                {/* On a phone the head has room for one fact: what is left. */}
                <span className="hidden sm:inline">
                  Lv.{sheet.level} · {sheet.job} ·{" "}
                </span>
                {sheet.hw.left ? (
                  <>
                    남은 숙제 <span className="font-num font-bold text-primary-text">{sheet.hw.left}</span>
                  </>
                ) : (
                  "숙제 다 끝남"
                )}
              </SheetHead>
              <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 lg:p-4">
                <div className="flex flex-col gap-2">
                  {sheetGroup && sheetGroup.items.length > 0 && <Box title="계정 숙제" note={`${sheetGroup.name} · 어느 캐릭터로 하든 같이 끝남`} items={sheetGroup.items} two />}
                  {/* The two halves stretch to one height, whatever each holds. */}
                  <div className="grid gap-2 @md:grid-cols-2">
                    <Box title="오늘" note={`${daily.hours}시간 ${daily.minutes}분 뒤 초기화`} items={sheet.hw.today.items} />
                    <Box title="이번 주" note="목요일 0시 초기화" items={sheet.hw.week.items} />
                  </div>
                  <BossBox card={sheet} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
