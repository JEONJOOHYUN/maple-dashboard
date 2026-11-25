"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Map as MapIcon, Minus, Plus, RotateCcw, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Chip, NumberField, parseNum } from "@/components/ev/ui";
import type { Roulette } from "@/lib/third-party/roulette/roulette";
import { useStored } from "@/lib/use-stored";
import { Digits } from "@/components/ui/digits";
import { Spinner } from "@/components/ui/spinner";
import { SwapLabel } from "@/components/ui/swap-icon";
import { cn } from "@/lib/utils";

type Entry = { name: string; count: number };
type Rule = "first" | "last";

const PAL_DARK = ["#FF7429", "#FFC15E", "#F4F0E8", "#FF8F7A", "#8CC9B0", "#78AEFF", "#D9A273", "#F2A7C3"];
const PAL_LIGHT = ["#F26A22", "#E0A21F", "#3A352D", "#E5604B", "#3E9A7A", "#2B67CF", "#A9713F", "#D2618E"];
const DEFAULT_ENTRIES: Entry[] = [
  { name: "파티장", count: 1 },
  { name: "파티원 1", count: 1 },
  { name: "파티원 2", count: 1 },
  { name: "파티원 3", count: 1 },
];
const MAX_PEOPLE = 30;
// Marbles on the board, everyone together (user, 2026-11-19: "100개 이런식도", like the original's "이름*100").
// One person may hold them all. The cap = the most that never slows down (user, 2026-11-20: "속도 안 늦어지는 선 안에
// 맥시멈"), measured at a 60 Hz frame rate: a PC stays at 60 frames a second at every speed up to 550 (5x: 550 →
// 58.5 ~ 59, 600 → 57.5), and a phone with a 4x slower CPU keeps 1x smooth there (about 70% busy).
const MAX_TOTAL = 550;
const SPEEDS = [1, 2, 3, 5];

/** Digits typed → a marble count from 1 to `max`; nothing usable keeps `fallback`. */
function countFrom(text: string, fallback: number, max: number): number {
  const n = Math.floor(parseNum(text, NaN));
  return Number.isFinite(n) ? Math.min(Math.max(1, n), Math.max(1, max)) : fallback;
}

/**
 * What the browser kept, read as a list the board can take: whole counts from 1, at most MAX_PEOPLE people and
 * MAX_TOTAL marbles together. A page from before a lower cap, or a hand-edited store, would otherwise line up any
 * number of marbles. Names stay as they are (an empty one is a name being typed).
 */
function cleanEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return DEFAULT_ENTRIES;
  const valid = raw.filter((e): e is Entry => !!e && typeof e === "object" && typeof (e as Entry).name === "string").slice(0, MAX_PEOPLE);
  let total = 0;
  return valid.map((e, i) => {
    // Everyone after this one keeps a marble, so nobody drops out when the stored counts are too many.
    const later = valid.length - i - 1;
    const count = Math.min(Math.max(1, Math.floor(Number(e.count)) || 1), MAX_TOTAL - total - later);
    total += count;
    return { name: e.name, count };
  });
}

type Snapshot = { finished: string[]; live: string[] };

export function PinballGame() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const palette = dark ? PAL_DARK : PAL_LIGHT;
  const [stored, setEntries] = useStored<Entry[]>("pinball:entries", DEFAULT_ENTRIES);
  // Edits go through this cleaned list (update(i) writes it back), so indexes always match what is shown.
  const entries = useMemo(() => cleanEntries(stored), [stored]);
  const [rule, setRule] = useState<Rule>("first");
  const [speed, setSpeed] = useState(1);
  // The map of the course on the board: open unless it was closed in this browser.
  const [mapOpen, setMapOpen] = useStored<boolean>("pinball:map", true);
  const [open, setOpen] = useState(-1);
  const [nameDraft, setNameDraft] = useState("");
  // The open chip's marble count as typed; it becomes the count on Enter or when the box is left.
  const [countDraft, setCountDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "running" | "done" | "error">("loading");
  const [snap, setSnap] = useState<Snapshot>({ finished: [], live: [] });
  // The engine stopped its frame loop after a race (every marble in): the ranks are final, nothing is left to poll.
  const [resting, setResting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Roulette | null>(null);

  // Same name twice would merge two people; keep names unique and non-empty.
  const people = useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((e) => {
      const n = e.name.trim();
      if (!n || seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [entries]);
  const colorOf = (i: number) => palette[i % palette.length];
  // Plain coloured marbles (no game art: Nexon's IP guide, 2026-11-09). Colour follows the person's place among `people`.
  const colorFor = (name: string) => {
    const i = people.findIndex((p) => p.name.trim() === name.trim());
    return i >= 0 ? colorOf(i) : "var(--muted-foreground)";
  };
  const members = people.map((p, i) => ({ name: p.name.trim(), count: p.count, color: colorOf(i) }));
  const membersKey = JSON.stringify(members);

  // Create the engine once (box2d loads its wasm), destroy it when leaving the page.
  useEffect(() => {
    let game: Roulette | null = null;
    let alive = true;
    import("@/lib/third-party/roulette/roulette")
      .then(({ Roulette }) => {
        if (!alive || !boardRef.current) return;
        game = new Roulette(boardRef.current);
        gameRef.current = game;
        game.addEventListener("ready", () => setStatus("ready"));
        game.addEventListener("goal", () => setStatus("done"));
        game.addEventListener("rest", () => {
          if (game) setSnap({ finished: game.finishOrder(), live: game.liveOrder() });
          setResting(true);
        });
        game.addEventListener("error", () => setStatus("error"));
      })
      .catch(() => setStatus("error"));
    return () => {
      alive = false;
      game?.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setTheme(dark ? "dark" : "light");
  }, [dark, status]);

  useEffect(() => {
    gameRef.current?.setSpeed(speed);
  }, [speed, status]);

  useEffect(() => {
    gameRef.current?.setMinimap(mapOpen);
  }, [mapOpen, status]);

  // Line up the marbles whenever the people change (not during a race).
  useEffect(() => {
    const game = gameRef.current;
    if (!game || status === "loading" || status === "running") return;
    game.setMembers(JSON.parse(membersKey));
    setSnap({ finished: [], live: game.liveOrder() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersKey, status === "loading"]);

  // Poll the race for the ranking list, until the engine rests.
  useEffect(() => {
    if ((status !== "running" && status !== "done") || resting) return;
    const id = window.setInterval(() => {
      const game = gameRef.current;
      if (game) setSnap({ finished: game.finishOrder(), live: game.liveOrder() });
    }, 200);
    return () => window.clearInterval(id);
  }, [status, resting]);

  function start() {
    const game = gameRef.current;
    if (!game || status === "loading" || members.length < 1) return;
    if (status === "running" || status === "done") game.setMembers(members);
    game.setSpeed(speed);
    game.start(rule === "last", rule === "first" ? "1등 당첨" : "꼴등 당첨");
    setSnap({ finished: [], live: game.liveOrder() });
    setResting(false);
    setStatus("running");
  }

  /** Back to the start: the marbles lined up at the top again, the ranks cleared, nothing running. */
  function reset() {
    const game = gameRef.current;
    if (!game || status === "loading" || status === "error") return;
    game.setMembers(members);
    setSnap({ finished: [], live: game.liveOrder() });
    setResting(false);
    setStatus("ready");
  }

  // One rank per person: by their first marble in (1등) or their last marble in (꼴등).
  const ranking = people.map((p, i) => {
    const name = p.name.trim();
    const done = snap.finished.reduce<number[]>((acc, n, k) => (n === name ? [...acc, k] : acc), []);
    const decided = rule === "first" ? done.length > 0 : done.length >= p.count;
    const key = rule === "first" ? Math.min(...done, 1e9) : Math.max(...done, -1);
    const liveIdx = snap.live.indexOf(name);
    return { name, color: colorOf(i), decided, key, left: p.count - done.length, progress: liveIdx === -1 ? 1e9 : liveIdx };
  });
  const decidedList = ranking.filter((r) => r.decided).sort((a, b) => a.key - b.key);
  const pending = ranking.filter((r) => !r.decided).sort((a, b) => a.progress - b.progress);
  const ordered = [...decidedList, ...pending];
  const allDecided = ranking.length > 0 && pending.length === 0;
  const winner = rule === "first" ? (decidedList[0]?.name ?? null) : allDecided ? (decidedList[decidedList.length - 1]?.name ?? null) : null;
  const totalMarbles = people.reduce((s, p) => s + p.count, 0);

  function update(i: number, patch: Partial<Entry>) {
    setEntries((prev) => cleanEntries(prev).map((e, k) => (k === i ? { ...e, ...patch } : e)));
  }
  /** The most marbles person `i` may hold: what everyone else leaves of MAX_TOTAL. */
  const roomFor = (i: number) => MAX_TOTAL - entries.reduce((s, e, k) => (k === i ? s : s + e.count), 0);
  /** Save the typed count (1 ~ the room left); text that is not a number keeps the old count. */
  function setCount(i: number, text: string) {
    const e = entries[i];
    if (!e) return;
    const count = countFrom(text, e.count, roomFor(i));
    setCountDraft(String(count));
    if (count !== e.count) update(i, { count });
  }
  /** Save the edited name; an empty name or one another person already has keeps the old name. */
  function rename(i: number) {
    const name = nameDraft.trim().slice(0, 12);
    const taken = entries.some((e, k) => k !== i && e.name.trim() === name);
    if (!name || taken) {
      setNameDraft(entries[i]?.name ?? "");
      return;
    }
    if (name !== entries[i]?.name) update(i, { name });
  }

  function addDraft() {
    const names = draft
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    setEntries((prev) => {
      const next = cleanEntries(prev);
      let total = next.reduce((s, e) => s + e.count, 0);
      for (const raw of names) {
        // "이름*3" = three marbles, like the original; a count past the room left is cut to it.
        const m = raw.match(/^(.*?)\s*\*\s*(\d+)$/);
        const name = (m ? m[1] : raw).slice(0, 12);
        if (!name || next.some((e) => e.name.trim() === name) || next.length >= MAX_PEOPLE || total >= MAX_TOTAL) continue;
        const count = m ? countFrom(m[2], 1, MAX_TOTAL - total) : 1;
        next.push({ name, count });
        total += count;
      }
      return next;
    });
    setDraft("");
  }

  const running = status === "running";
  // Every marble place taken: nobody more can come in (each person needs one), so adding is closed.
  const full = entries.reduce((s, e) => s + e.count, 0) >= MAX_TOTAL;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="핀볼 추첨" description="보스 드롭 주인 · 파티 순서 정하기" />
      {/* Wide screens (user, 2026-11-13): the left side (people · settings · ranks) is exactly as tall as the board —
          the ranks take the room that is left — and when the window is shorter than the board (the page zoomed in)
          it is pinned next to it and scrolls on its own, so the ranks stay in view while the page follows the
          marbles down. On a phone the wrapper is not a box: people, board, ranks stack in that order. */}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="contents lg:sticky lg:top-4 lg:-m-1 lg:flex lg:max-h-[calc(100dvh-1.5rem)] lg:flex-col lg:gap-2 lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]">
        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-none lg:shrink-0">
          <section className="flex flex-col gap-3 tile p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-[15px]">
                참가자 {people.length}명 · 구슬 {totalMarbles.toLocaleString("ko-KR")}개
                {full && <span className="text-primary-text"> · 최대</span>}
              </b>
              <span className="text-xs text-muted-foreground">이름 누르면 이름 · 구슬 수 수정</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entries.map((e, i) =>
                open === i ? (
                  <span key={i} className="inline-flex h-9 items-center gap-1 rounded-full border border-primary bg-primary-soft pr-1 pl-2.5 text-[13px]">
                    <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: colorFor(e.name) }} />
                    <input
                      aria-label="참가자 이름 고치기"
                      value={nameDraft}
                      disabled={running}
                      maxLength={12}
                      onChange={(ev) => setNameDraft(ev.target.value)}
                      onBlur={() => rename(i)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !ev.nativeEvent.isComposing) {
                          rename(i);
                          setOpen(-1);
                        }
                      }}
                      // Round like the pill around it (18 = 14 + the 4px between). 16px on a phone: smaller, and iOS zooms in.
                      className="h-7 w-20 min-w-0 rounded-full border border-primary/40 bg-card px-2 text-base font-bold outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-[13px]"
                    />
                    <button type="button" disabled={running || e.count <= 1} onClick={() => setCount(i, String(e.count - 1))} aria-label={`${e.name} 구슬 하나 빼기`} className="flex size-7 items-center justify-center rounded-full hover:bg-card disabled:opacity-50">
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    {/* Typed straight in (user, 2026-11-19), saved on Enter or when the box is left.
                        While nobody is typing in it, the number is drawn over the box with digits of one width: the
                        number font's digits are not, and under the − / + buttons the centred number shook. */}
                    <span
                      className="group/count relative inline-flex"
                      onBlur={() => setCount(i, countDraft)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !ev.nativeEvent.isComposing) {
                          setCount(i, countDraft);
                          setOpen(-1);
                        }
                      }}
                    >
                      <NumberField
                        label={`${e.name} 구슬 수`}
                        value={countDraft}
                        onChange={setCountDraft}
                        disabled={running}
                        inputClassName="h-7 w-14 rounded-full border-primary/40 bg-card px-1 text-center text-base font-bold text-transparent focus:text-foreground focus:ring-ring/50 disabled:opacity-50 sm:text-[13px]"
                      />
                      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 flex items-center justify-center font-num text-base font-bold text-foreground group-focus-within/count:hidden sm:text-[13px]", running && "opacity-50")}>
                        <Digits>{/^\d+$/.test(countDraft) ? Number(countDraft).toLocaleString("ko-KR") : countDraft}</Digits>
                      </span>
                    </span>
                    <button type="button" disabled={running || e.count >= roomFor(i)} onClick={() => setCount(i, String(e.count + 1))} aria-label={`${e.name} 구슬 하나 더하기`} className="flex size-7 items-center justify-center rounded-full hover:bg-card disabled:opacity-50">
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        setEntries((prev) => cleanEntries(prev).filter((_, k) => k !== i));
                        setOpen(-1);
                      }}
                      aria-label={`${e.name} 빼기`}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-destructive disabled:opacity-50"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setOpen(i);
                      setNameDraft(e.name);
                      setCountDraft(String(e.count));
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full tile-edge px-3 text-[13px]"
                  >
                    <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: colorFor(e.name) }} />
                    <span className="max-w-24 truncate" data-tip={e.name}>
                      {e.name}
                    </span>
                    <span className={cn("font-num text-xs font-bold", e.count > 1 ? "text-primary-text" : "text-muted-foreground")}>
                      ×<Digits>{e.count.toLocaleString("ko-KR")}</Digits>
                    </span>
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <input
                aria-label="참가자 이름"
                value={draft}
                disabled={running}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !full) addDraft();
                }}
                placeholder={full ? `구슬 최대 ${MAX_TOTAL}개` : "이름 추가 (쉼표로 여러 명, 이름*3)"}
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm"
              />
              <button type="button" onClick={addDraft} disabled={running || full} className="h-10 rounded-lg tile-edge px-4 text-[13px] font-semibold disabled:opacity-50">
                추가
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 tile p-4">
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="당첨">
              <Chip on={rule === "first"} disabled={running} onClick={() => setRule("first")}>
                1등이 당첨
              </Chip>
              <Chip on={rule === "last"} disabled={running} onClick={() => setRule("last")}>
                꼴등이 당첨
              </Chip>
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="배속">
              {SPEEDS.map((s) => (
                <Chip key={s} on={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </Chip>
              ))}
            </div>
            {/* Two buttons (user, 2026-11-13): back to the start without running, and start. */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-1.5">
              <button
                type="button"
                onClick={reset}
                disabled={status !== "running" && status !== "done"}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg tile-edge pr-3 pl-2.5 text-[13px] font-semibold disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                기본으로 돌리기
              </button>
              <button
                type="button"
                onClick={start}
                disabled={status === "loading" || status === "error" || people.length === 0}
                className="flex h-11 items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-50"
              >
                <SwapLabel
                  on={status === "loading"}
                  from="시작하기"
                  to={
                    <>
                      <Spinner />
                      준비 중…
                    </>
                  }
                />
              </button>
            </div>
            {(status === "error") && (
              <div className="text-xs text-destructive">
              물리 엔진 불러오기 실패 · 새로고침
            </div>
            )}
          </section>
        </div>
          {/* The card takes the room left under the settings; a longer list scrolls inside it instead of spilling out
              below the card when the window is short (user, 2026-11-14). */}
          <section className="order-3 flex min-w-0 flex-col gap-2 tile p-4 lg:order-none lg:min-h-44 lg:flex-1 lg:gap-3 lg:overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-[15px]">순위</b>
              <span className="text-xs text-muted-foreground">한 사람은 한 번만 · {rule === "first" ? "가장 먼저 들어온 구슬로" : "가장 늦게 들어온 구슬로"}</span>
            </div>
            {ordered.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">참가자 없음</p>}
            {/* The scroll box is a little larger than the list (lg), so the rows' shadow edges are not cut at its sides. */}
            <ol className="flex flex-col gap-1 lg:-mx-2 lg:-my-1 lg:min-h-0 lg:flex-1 lg:gap-1.5 lg:overflow-y-auto lg:px-2 lg:py-1 lg:[scrollbar-width:thin]">
              {ordered.map((r, k) => {
                const win = winner === r.name;
                return (
                  <li
                    key={r.name}
                    // Every row carries the 1px border (padding 1px less for it), so a row keeps its size as it is decided.
                    className={cn(
                      "grid grid-cols-[36px_16px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-transparent px-[9px] py-[5px] text-[13px] lg:py-[7px]",
                      win ? "bg-primary font-bold text-primary-foreground" : r.decided ? "bg-muted" : "text-muted-foreground shadow-tile"
                    )}
                  >
                    <b className="font-num">
                      <Digits>{`${k + 1}등`}</Digits>
                    </b>
                    <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="truncate" data-tip={r.name}>
                      {r.name}
                    </span>
                    <span className="text-xs">
                      {win ? "당첨" : r.decided ? "확정" : status === "running" || status === "done" ? (r.left > 1 ? `구슬 ${r.left}개 남음` : "진행 중") : "대기"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <section className="relative order-2 min-w-0 overflow-hidden tile lg:order-none lg:col-start-2">
          <div ref={boardRef} className="h-[480px] w-full sm:h-[600px] lg:h-[720px]" aria-label="핀볼 판" role="img" />
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner />판 준비 중…
            </div>
          )}
          {/* The map is at the right edge of the board (drawn by the engine); this opens and closes it. */}
          <button
            type="button"
            aria-pressed={mapOpen}
            onClick={() => setMapOpen(!mapOpen)}
            // after: the press area reaches 6px past the 32px button. The site's focus outline keeps its shadow edge.
            className="absolute top-2 left-2 inline-flex h-8 items-center gap-1.5 rounded-md tile-edge bg-card/90 pr-2.5 pl-2 text-xs font-semibold after:absolute after:-inset-1.5"
          >
            <MapIcon className="size-3.5" aria-hidden="true" />
            <SwapLabel on={mapOpen} from="맵 열기" to="맵 닫기" />
          </button>
          {mapOpen && (
            <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
            맵에 올리면 그 자리 보기
          </div>
          )}
        </section>

      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        lazygyu 의 Marble Roulette 기반(MIT) · 코스 = 원본의 Wheel of fortune · 물리 엔진 box2d-wasm(Zlib) · 참가자 목록은 이 브라우저에만 저장
      </p>
    </div>
  );
}
