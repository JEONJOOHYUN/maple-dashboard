"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ExternalLink, Lightbulb, Loader2, RotateCw, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { refreshSpec } from "@/app/spec/actions";
import { PageHeader } from "@/components/page-header";
import type { Miss, SpecResult } from "@/lib/spec/check";
import { periodGroups } from "@/lib/spec/period-rows";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

export type SpecView =
  | { kind: "empty" }
  | { kind: "result"; result: SpecResult; at: number; optimizer: string | null }
  | { kind: "notFound" | "quota" | "failed"; name: string };

// Recent characters (this browser only): people come back to check a fix (user, 2026-11-16).
const RECENT_KEY = "spec-recent";
const RECENT_MAX = 8;

const CHECKED =
  "공용 · 직업 0차 스킬 · 성향 · 유니온 아티팩트 · 칭호 · 캐시 장비 · 펫 기간 · 마스터라벨 플러스 · 5차 · 하이퍼 스탯 · 하이퍼 패시브 · 펫 버프 · 링크 · 어빌리티";

const kstTime = (ms: number) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(ms))
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);

function fetchedAt(ms: number) {
  const t = kstTime(ms);
  return `${t.month}/${t.day} ${t.hour}:${t.minute}`;
}

/** "부족: 공격력/마력 Lv.1 · 크리티컬 확률 Lv.10" — each " · " item stays on one line; breaks only between items. */
function DetailLine({ text }: { text: string }) {
  const items = text.split(" · ");
  return (
    <span className="text-[13px] leading-normal text-muted-foreground">
      {items.map((it, i) => (
        <span key={i}>
          <span className="whitespace-nowrap">{it}</span>
          {i < items.length - 1 && " · "}
        </span>
      ))}
    </span>
  );
}

/** Misses of the same category under one title, in check order. */
function groupByCat(list: Miss[]) {
  const groups: { cat: string; items: Miss[] }[] = [];
  for (const m of list) {
    const g = groups.find((x) => x.cat === m.cat);
    if (g) g.items.push(m);
    else groups.push({ cat: m.cat, items: [m] });
  }
  return groups;
}

function MissGroup({ cat, items, tip }: { cat: string; items: Miss[]; tip?: boolean }) {
  return (
    <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-border px-4 py-3 sm:px-[18px]">
      <span
        className={cn(
          "flex size-[30px] items-center justify-center rounded-lg",
          tip ? "bg-primary-soft text-primary-text" : "bg-[rgba(226,80,79,0.14)] text-[#E2504F]",
        )}
      >
        {tip ? <Lightbulb className="size-4" aria-hidden="true" /> : <AlertCircle className="size-4" aria-hidden="true" />}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <b className="text-sm leading-[30px]">{cat}</b>
        {items.map((m, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold">{m.what}</span>
            {m.detail.map((d, j) => (
              <DetailLine key={j} text={d} />
            ))}
            {m.rows && (
              <div className="mt-1 grid grid-cols-[auto_auto_auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground tabular-nums">
                {m.rows.map((r, j) =>
                  r.map((c, k) => (
                    <span key={`${j}-${k}`} className={cn("whitespace-nowrap", k === 2 && "text-right", k === 3 && "whitespace-normal")}>
                      {c}
                    </span>
                  )),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stat cash items · pets · 마스터라벨 플러스 (시안 B, user 2026-11-17): title per kind, rows of what · date · days. */
function Periods({ result }: { result: SpecResult }) {
  const groups = periodGroups(result.periods ?? [], result.labelPlus ?? null);
  if (!groups.length) return null;
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      <b className="px-3.5 py-2.5 text-[13px]">남은 기간</b>
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-1.5 px-3.5 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <b className="text-[13px]">{g.title}</b>
            {g.value && <b className={cn("text-[13px]", g.warn ? "text-[#E2504F]" : "text-foreground")}>{g.value}</b>}
          </div>
          {g.rows.map((r) => (
            <div key={`${r.what}-${r.date}`} className="grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-baseline gap-x-3">
              <DetailLine text={r.what} />
              <span className="font-num text-[13px] text-muted-foreground tabular-nums">{r.date}</span>
              <b className={cn("text-right font-num text-[13px] tabular-nums", r.warn && "text-[#E2504F]")}>{r.days}</b>
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

type ResultProps = { result: SpecResult; at: number; optimizer: string | null; refreshing: boolean; refreshNote: string; onRefresh: () => void };

function Result({ result, at, optimizer, refreshing, refreshNote, onRefresh }: ResultProps) {
  const [open, setOpen] = useState(true);
  const n = result.misses.length;
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
    <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <span className="flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
            {result.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.image} alt={`${result.name} 캐릭터`} className="size-[230px] max-w-none shrink-0 object-contain" />
            ) : (
              <span className="text-[11px] text-muted-foreground">캐릭터</span>
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <b className="font-heading text-[22px] leading-tight break-all">{result.name}</b>
            <span className="text-[13px] text-muted-foreground">
              Lv.{result.level} · {result.cls} · {result.world}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => n && setOpen((o) => !o)}
          aria-expanded={n ? open : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left",
            n
              ? "cursor-pointer border-[rgba(226,80,79,0.5)] bg-[rgba(226,80,79,0.12)] text-[#E2504F]"
              : "cursor-default border-[rgba(76,175,110,0.5)] bg-[rgba(76,175,110,0.12)] text-[#3FA765]",
          )}
        >
          {n ? <ShieldAlert className="size-[22px] shrink-0" aria-hidden="true" /> : <ShieldCheck className="size-[22px] shrink-0" aria-hidden="true" />}
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]">{n ? `놓친 스펙 ${n}개` : "빠진 것 없음"}</b>
            <span className="text-xs opacity-85">{n ? "보스 기준 · 돈 거의 안 드는 것부터" : "확인한 항목 모두 채움"}</span>
          </span>
          {n > 0 && <span className="ml-auto text-xs font-bold">{open ? "목록 닫기" : "목록 보기"}</span>}
        </button>

        <Periods result={result} />

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {presetText && <span>보스 프리셋: {presetText}</span>}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>같은 캐릭터 3시간 동안 저장된 결과 · {fetchedAt(at)} 조회</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden="true" />
              다시 조회
            </button>
          </span>
          {refreshNote && <span className="text-[#E2504F]">{refreshNote}</span>}
          {!result.known && <span>새 직업 → 직업별 기준 없음, 공용 항목만 확인</span>}
        </div>

        {optimizer && (
          <a
            href={optimizer}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-[13px] font-semibold hover:bg-secondary"
          >
            하이퍼 스탯 효율 배분 보기
            <span className="text-xs font-normal text-muted-foreground">외부 사이트</span>
            <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {n > 0 && open && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 sm:px-[18px]">
              <b className="text-[15px]">놓친 스펙</b>
              <span className="text-xs text-muted-foreground">보스 프리셋 기준</span>
            </div>
            {groupByCat(result.misses).map((g) => (
              <MissGroup key={g.cat} cat={g.cat} items={g.items} />
            ))}
          </>
        )}
        {n === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[rgba(76,175,110,0.16)] text-[#3FA765]">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base">빠진 것 없음</b>
            <span className="text-[13px] text-muted-foreground">확인하는 항목 모두 채움</span>
          </div>
        )}
        {n > 0 && !open && <div className="px-4 py-9 text-center text-[13px] text-muted-foreground">왼쪽 배지 → 목록 열기</div>}
        {result.tips.length > 0 && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border px-4 py-3 sm:px-[18px]">
              <b className="text-[13px]">참고</b>
              <span className="text-xs text-muted-foreground">개수에 안 셈 · 메소나 시간이 드는 것</span>
            </div>
            {groupByCat(result.tips).map((g) => (
              <MissGroup key={g.cat} cat={g.cat} items={g.items} tip />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function Message({ title, sub }: { title: string; sub: string }) {
  return (
    <section className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
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
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader title="숨은 스펙업" description="닉네임 → 돈 거의 안 들이고 채울 수 있는데 놓친 스펙 찾기" />

      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-card px-4 focus-within:border-primary">
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
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "조회 중" : "검색"}
        </button>
      </form>

      {recentList.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-muted-foreground">최근 검색</span>
          {recentList.map((n) => (
            <span
              key={n}
              className={cn(
                "inline-flex items-center rounded-full border text-[13px]",
                n === found ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-card",
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
            optimizer={view.optimizer}
            refreshing={pending}
            refreshNote={refreshNote}
            onRefresh={refresh}
          />
        )}
        {view.kind === "empty" && <Message title="닉네임 검색" sub="보스 프리셋 기준으로 공용 스킬 · 아티팩트 · 5차 · 링크 · 어빌리티 등 확인" />}
        {view.kind === "notFound" && <Message title={`"${view.name}" 캐릭터 없음`} sub="닉네임 확인 · 2023년 12월 이후 접속 기록이 있어야 조회됨" />}
        {view.kind === "quota" && <Message title="오늘 조회 한도 다 씀" sub="넥슨 API 하루 한도 → 내일 다시 · 이미 조회한 캐릭터는 3시간 동안 바로 보임" />}
        {view.kind === "failed" && <Message title="조회 실패" sub="넥슨 API 응답 오류 → 잠시 뒤 다시" />}
      </div>

      <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <span>확인하는 것: {CHECKED}</span>
        <span>기준: 직업별 상위 캐릭터 대부분의 선택 · 보스 프리셋(장비 · 하이퍼 · 링크 · 어빌)을 찾아 그 세팅으로 확인</span>
        <span>Data based on NEXON Open API</span>
      </div>
    </div>
  );
}
