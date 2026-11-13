"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Map as MapIcon, Minus, Plus, RotateCcw, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Chip } from "@/components/ev/ui";
import type { Roulette } from "@/lib/third-party/roulette/roulette";
import { useStored } from "@/lib/use-stored";
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
const MAX_MARBLES = 10;
const SPEEDS = [1, 2, 3, 5];

type Snapshot = { finished: string[]; live: string[] };

export function PinballGame() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const palette = dark ? PAL_DARK : PAL_LIGHT;
  const [entries, setEntries] = useStored<Entry[]>("pinball:entries", DEFAULT_ENTRIES);
  const [rule, setRule] = useState<Rule>("first");
  const [speed, setSpeed] = useState(1);
  // The map of the course on the board: open unless it was closed in this browser.
  const [mapOpen, setMapOpen] = useStored<boolean>("pinball:map", true);
  const [open, setOpen] = useState(-1);
  const [nameDraft, setNameDraft] = useState("");
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
    setEntries((prev) => prev.map((e, k) => (k === i ? { ...e, ...patch } : e)));
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
      const next = [...prev];
      for (const raw of names) {
        // "이름*3" = three marbles, like the original.
        const m = raw.match(/^(.*?)\s*\*\s*(\d+)$/);
        const name = (m ? m[1] : raw).slice(0, 12);
        const count = m ? Math.min(MAX_MARBLES, Math.max(1, Number(m[2]))) : 1;
        if (name && !next.some((e) => e.name.trim() === name) && next.length < MAX_PEOPLE) next.push({ name, count });
      }
      return next;
    });
    setDraft("");
  }

  const running = status === "running";

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader title="핀볼 추첨" description="보스 드롭 주인 · 파티 순서 정하기" />
      {/* Wide screens (user, 2026-11-13): the left side (people · settings · ranks) is exactly as tall as the board —
          the ranks take the room that is left — and when the window is shorter than the board (the page zoomed in)
          it is pinned next to it and scrolls on its own, so the ranks stay in view while the page follows the
          marbles down. On a phone the wrapper is not a box: people, board, ranks stack in that order. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="contents lg:sticky lg:top-4 lg:-m-1 lg:flex lg:max-h-[calc(100dvh-1.5rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]">
        <div className="order-1 flex min-w-0 flex-col gap-3 lg:order-none lg:shrink-0">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-[15px]">
                참가자 {people.length}명 · 구슬 {totalMarbles}개
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
                      className="h-7 w-20 min-w-0 rounded-md border border-primary/40 bg-card px-1.5 text-[13px] font-bold outline-none focus:border-primary"
                    />
                    <button type="button" disabled={running} onClick={() => update(i, { count: Math.max(1, e.count - 1) })} aria-label={`${e.name} 구슬 하나 빼기`} className="flex size-7 items-center justify-center rounded-full hover:bg-card disabled:opacity-40">
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <b className="w-6 text-center font-num">×{e.count}</b>
                    <button type="button" disabled={running} onClick={() => update(i, { count: Math.min(MAX_MARBLES, e.count + 1) })} aria-label={`${e.name} 구슬 하나 더하기`} className="flex size-7 items-center justify-center rounded-full hover:bg-card disabled:opacity-40">
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        setEntries((prev) => prev.filter((_, k) => k !== i));
                        setOpen(-1);
                      }}
                      aria-label={`${e.name} 빼기`}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-destructive disabled:opacity-40"
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
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] hover:border-primary/60"
                  >
                    <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: colorFor(e.name) }} />
                    <span className="max-w-24 truncate">{e.name}</span>
                    <span className={cn("font-num text-xs", e.count > 1 ? "font-bold text-primary-text" : "text-muted-foreground")}>×{e.count}</span>
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
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) addDraft();
                }}
                placeholder="이름 추가 (쉼표로 여러 명)"
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/40"
              />
              <button type="button" onClick={addDraft} disabled={running} className="h-10 rounded-lg border border-border px-4 text-[13px] font-semibold disabled:opacity-50">
                추가
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
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
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                기본으로 돌리기
              </button>
              <button
                type="button"
                onClick={start}
                disabled={status === "loading" || status === "error" || people.length === 0}
                className="h-11 rounded-lg bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-50"
              >
                {status === "loading" ? "준비 중…" : "시작하기"}
              </button>
            </div>
            {status === "error" && <span className="text-xs text-destructive">물리 엔진 불러오기 실패 · 새로고침</span>}
          </section>
        </div>
          <section className="order-3 flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 lg:order-none lg:min-h-44 lg:flex-1 lg:gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-[15px]">순위</b>
              <span className="text-xs text-muted-foreground">한 사람은 한 번만 · {rule === "first" ? "가장 먼저 들어온 구슬로" : "가장 늦게 들어온 구슬로"}</span>
            </div>
            <ol className="flex flex-col gap-1 lg:gap-1.5">
              {ordered.map((r, k) => {
                const win = winner === r.name;
                return (
                  <li
                    key={r.name}
                    className={cn(
                      "grid grid-cols-[36px_16px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] lg:py-2",
                      win ? "bg-primary font-bold text-primary-foreground" : r.decided ? "bg-muted" : "text-muted-foreground ring-1 ring-border ring-inset"
                    )}
                  >
                    <b className="font-num">{k + 1}등</b>
                    <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="truncate">{r.name}</span>
                    <span className="text-xs">
                      {win ? "당첨" : r.decided ? "확정" : status === "running" || status === "done" ? (r.left > 1 ? `구슬 ${r.left}개 남음` : "진행 중") : "대기"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <section className="relative order-2 min-w-0 overflow-hidden rounded-lg border border-border bg-card lg:order-none lg:col-start-2">
          <div ref={boardRef} className="h-[480px] w-full sm:h-[600px] lg:h-[720px]" aria-label="핀볼 판" role="img" />
          {status === "loading" && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">판 준비 중…</div>}
          {/* The map is at the right edge of the board (drawn by the engine); this opens and closes it. */}
          <button
            type="button"
            aria-pressed={mapOpen}
            onClick={() => setMapOpen(!mapOpen)}
            className="absolute top-2 left-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 text-xs font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MapIcon className="size-3.5" aria-hidden="true" />
            {mapOpen ? "맵 닫기" : "맵 열기"}
          </button>
          {mapOpen && <span className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">맵에 올리면 그 자리 보기</span>}
        </section>

      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        lazygyu 의 Marble Roulette 기반(MIT) · 코스 = 원본의 Wheel of fortune · 물리 엔진 box2d-wasm(Zlib) · 참가자 목록은 이 브라우저에만 저장
      </p>
    </div>
  );
}
