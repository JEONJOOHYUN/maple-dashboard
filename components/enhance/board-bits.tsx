"use client";

// What the star force board and the potential board share: the period, the sync wiring and its banners, the tab row.
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertCircle, ChevronDown, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { eok } from "@/components/ev/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ApiErrorKind } from "@/lib/enhance/client";
import { addDays, kstDate } from "@/lib/enhance/kst";
import type { HistorySync, SyncSnap } from "@/lib/enhance/sync";
import { GROUP_LABEL, WORLD_GROUPS, type GroupTally, type WorldGroup } from "@/lib/enhance/worlds";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

type PeriodId = "7d" | "30d" | "1y" | "all" | "custom";
// `short` = what the button says: the row also holds the "계산 기준" button.
const PERIODS: { id: PeriodId; label: string; short: string; days: number }[] = [
  { id: "7d", label: "최근 7일", short: "7일", days: 7 },
  { id: "30d", label: "최근 30일", short: "30일", days: 30 },
  { id: "1y", label: "최근 1년", short: "1년", days: 365 },
  // The API keeps two years.
  { id: "all", label: "전체 2년", short: "2년", days: 730 },
  { id: "custom", label: "기간 설정", short: "기간 설정", days: 0 },
];

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음 → 키 다시 입력",
  quota: "이 키의 호출 한도 초과 (개발 단계 키 = 하루 1,000건) → 받은 기록까지만 표시 · 내일 이어받기",
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
  // Opens on everything the API keeps (user, 2026-11-13): a service-stage key takes two years in seconds. A period
  // picked before stays as it was saved.
  const [period, setPeriod] = useStored<PeriodId>("enhance:period", "all");
  const [custom, setCustom] = useStored<{ from: string; to: string }>("enhance:custom", { from: "", to: "" });
  const days = PERIODS.find((p) => p.id === period)?.days ?? 730;
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

/**
 * Rows (user, 2026-11-13). First: `lead` (the star force · potential switch) on the left, when the records were
 * read and the refresh button on the right. Second, under the switch: the period buttons on the left, `aside` (the
 * "계산 기준" button) on the right. The date fields come last. The world groups are not here: they are the top
 * line of the summary card (WorldStrip).
 * Changing or forgetting the key is in the menu next to the page title.
 */
export function PeriodBar({
  state,
  status,
  loading,
  onRefresh,
  lead,
  aside,
}: {
  state: PeriodState;
  status: ReactNode;
  loading: boolean;
  onRefresh: () => void;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  const { period, setPeriod, custom, setCustom, today, oldest, from, to } = state;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {lead}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!loading && status}
          <button type="button" onClick={onRefresh} disabled={loading} className={cn(plainButton, "inline-flex items-center gap-1.5 disabled:opacity-50")}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
            새로 고침
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="기간" className="flex flex-wrap gap-[3px] rounded-lg border border-border p-[3px]">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.label}
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "h-8 rounded-md px-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  period === p.id ? "bg-primary-soft font-bold text-primary-text" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.short}
              </button>
            ))}
          </div>
        </div>
        {aside}
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

/** World groups left out of both boards, remembered in this browser. Event worlds start left out (user, 2026-11-12). */
export function useGroupsOff() {
  const [off, setOff] = useStored<WorldGroup[]>("enhance:groupsOff", ["event"]);
  // From what is saved, not from what this render saw: two presses in a row must both count.
  const toggle = useCallback((id: WorldGroup) => setOff((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id])), [setOff]);
  return [off, toggle] as const;
}

const NO_GROUPS: WorldGroup[] = [];

/**
 * The world groups to list for an account: the ones in the period on screen plus every group its records were ever
 * seen in (kept in this browser, shared by the two boards). Without this the whole row went away when the period was
 * made short enough to hold regular-world records only, and came back on a longer one (user, 2026-11-13: "월드는
 * 어디갔어?"). A group with nothing in the period is listed with no amount.
 */
export function useKnownGroups(account: string, tallies: GroupTally[]): GroupTally[] {
  const [seen, setSeen] = useStored<WorldGroup[]>(`enhance:groupsSeen:${account}`, NO_GROUPS);
  useEffect(() => {
    const fresh = tallies.map((t) => t.id).filter((id) => !seen.includes(id));
    if (fresh.length > 0) setSeen((prev) => [...new Set([...prev, ...fresh])]);
  }, [tallies, seen, setSeen]);
  return useMemo(
    () => WORLD_GROUPS.filter((id) => seen.includes(id) || tallies.some((t) => t.id === id)).map((id) => tallies.find((t) => t.id === id) ?? { id, n: 0, spent: 0 }),
    [seen, tallies]
  );
}

/** Nothing to tell apart when every record is a regular-world one. A seasonal or event group shows even alone:
 * that is how one sees what the records are, and the only place to leave them out. */
export const worldsShown = (tallies: GroupTally[], off: WorldGroup[]) => !tallies.every((t) => t.id === "regular" && !off.includes(t.id));

/**
 * 일반 · 챌린저스 · 버닝 · 이벤트, as the top line of the summary card (user, 2026-11-13: they filter the numbers of
 * that card, so that is where they are): press to leave a group out of everything below. Each shows the meso it
 * holds (no counts), so what was spent in a seasonal or event world reads apart from the rest. A group that is
 * switched off stays listed, so it can be switched back on. Nothing when there is nothing to tell apart.
 */
export function WorldStrip({ tallies, off, onToggle }: { tallies: GroupTally[]; off: WorldGroup[]; onToggle: (id: WorldGroup) => void }) {
  if (!worldsShown(tallies, off)) return null;
  return (
    <div className="border-b border-border px-5 py-2.5 lg:px-7">
      <WorldChips tallies={tallies} off={off} onToggle={onToggle} />
    </div>
  );
}

function WorldChips({ tallies, off, onToggle }: { tallies: GroupTally[]; off: WorldGroup[]; onToggle: (id: WorldGroup) => void }) {
  return (
    <div role="group" aria-label="월드" className="flex max-w-full flex-wrap gap-[3px]">
      {tallies.map(({ id, spent }) => {
        const on = !off.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "bg-primary-soft font-bold text-primary-text" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {GROUP_LABEL[id]}
            {spent > 0 && <span className="font-num text-xs font-medium">{eok(spent)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "계산 기준": what the numbers are worked out with (MVP · PC room, the price of a prime cube), set once and rarely
 * changed — one button that says what is set now and opens a small window, at the right end of the row (user, 2026-11-13).
 */
export function BasisButton({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className={cn(plainButton, "ml-auto inline-flex items-center gap-1.5")}>
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        계산 기준
        <span className="text-muted-foreground">{summary}</span>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="계산 기준" className="w-72 gap-3.5 p-3.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** One setting of the window: its name on the left, the control on the right. */
export function BasisRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span>{label}</span>
      {children}
    </div>
  );
}

/** A plain on · off switch (no box around it). */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("flex h-6 w-10 shrink-0 rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50", on ? "justify-end bg-primary" : "justify-start bg-input")}
    >
      <span className="size-5 rounded-full bg-white shadow-sm" />
    </button>
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

const plain = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** Whether an item passes the 모아보기 filter: the one picked in the list, else any name that has the typed text in it. */
export const itemMatches = (name: string, filter: ItemFilterState) => (filter.picked ? name === filter.picked : plain(name).includes(plain(filter.query)));

export type ItemFilterState = { query: string; picked: string };
export const NO_ITEM_FILTER: ItemFilterState = { query: "", picked: "" };

/**
 * The filter as it applies to the items on screen now: an item picked earlier that is no longer among them (another
 * period, a world group switched off, the low-star switch) is dropped. Left in, the list would read "모든 아이템"
 * while every card stayed hidden behind a name that is not there (Codex review, 2026-11-12).
 */
export const liveFilter = (filter: ItemFilterState, names: string[]): ItemFilterState => (filter.picked && !names.includes(filter.picked) ? { ...filter, picked: "" } : filter);

const ALL_ITEMS = "__all__";

/**
 * Finds one item among the 모아보기 cards (user, 2026-11-13).
 * - The search box does not filter while it is typed in: it lists, right under it, the item names that have the text
 *   in them ("언" → 컴플리트 언더컨트롤), to take one with a click or the arrow keys. Enter with none taken shows
 *   every card whose name has the text; emptying the box shows everything again.
 * - The button next to it opens every item as a list a few rows tall, the rest by scrolling.
 */
export function ItemFilter({ names, value, onChange }: { names: string[]; value: ItemFilterState; onChange: (next: ItemFilterState) => void }) {
  const all = useMemo(() => [...new Set(names)].sort((a, b) => a.localeCompare(b, "ko")), [names]);
  const [text, setText] = useState(value.picked || value.query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const hits = text.trim() ? all.filter((name) => plain(name).includes(plain(text))) : [];
  const shown = open && hits.length > 0;
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (name: string) => {
    setText(name);
    close();
    onChange({ query: "", picked: name });
  };
  return (
    <>
      <span className="relative inline-flex">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          role="combobox"
          aria-label="아이템 검색"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="아이템 검색"
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            setActive(-1);
            setOpen(true);
            // An emptied box is "everything again" at once; anything else waits for Enter or a pick.
            if (next === "") onChange(NO_ITEM_FILTER);
          }}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              if (hits.length === 0) return;
              e.preventDefault();
              setOpen(true);
              setActive((i) => (e.key === "ArrowDown" ? (i + 1) % hits.length : i <= 0 ? hits.length - 1 : i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown && active >= 0 && hits[active]) pick(hits[active]);
              else {
                close();
                onChange({ query: text.trim(), picked: "" });
              }
            } else if (e.key === "Escape") close();
          }}
          className="h-8 w-40 rounded-md bg-card pl-8 text-[13px] md:text-[13px]"
        />
        {shown && (
          <ul id={listId} role="listbox" aria-label="아이템" className="absolute top-full left-0 z-30 mt-1 max-h-60 w-64 max-w-[80vw] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {hits.map((name, i) => (
              <li
                key={name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // The press must not take the focus out of the box (that would close the list before the click lands).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-default truncate rounded-md px-2 py-1.5 text-[13px]", i === active && "bg-accent text-accent-foreground")}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="아이템 고르기"
          className="relative inline-flex h-8 max-w-[180px] min-w-0 items-center rounded-md border border-border bg-card pr-8 pl-2.5 text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate">{value.picked || "모든 아이템"}</span>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 w-60">
          <DropdownMenuRadioGroup
            value={value.picked || ALL_ITEMS}
            onValueChange={(next) => {
              const name = next === ALL_ITEMS ? "" : String(next);
              setText(name);
              onChange({ query: "", picked: name });
            }}
          >
            <DropdownMenuRadioItem value={ALL_ITEMS} closeOnClick>
              모든 아이템
            </DropdownMenuRadioItem>
            {all.map((name) => (
              <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                <span className="truncate">{name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Cards on one page of a 모아보기 grid (four rows of three) and rows on one page of a 내역 list. */
export const CARD_PAGE = 12;
export const ROW_PAGE = 50;

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
