"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Lightbulb, Loader2, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { Miss, SpecResult } from "@/lib/spec/check";
import { cn } from "@/lib/utils";

export type SpecView =
  | { kind: "empty" }
  | { kind: "result"; result: SpecResult; at: number }
  | { kind: "notFound" | "quota" | "failed"; name: string };

const CHECKED = "공용 · 직업 0차 스킬 · 성향 · 유니온 아티팩트 · 칭호 · 5차 · 하이퍼 스탯 · 하이퍼 패시브 · 펫 버프 · 링크 · 어빌리티";

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

function Result({ result, at }: { result: SpecResult; at: number }) {
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

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {presetText && <span>보스 프리셋: {presetText}</span>}
          <span>같은 캐릭터 3시간 동안 저장된 결과 · {fetchedAt(at)} 조회</span>
          {!result.known && <span>새 직업 → 직업별 기준 없음, 공용 항목만 확인</span>}
        </div>
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    startTransition(() => router.push(`/spec?name=${encodeURIComponent(q)}`));
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

      <div className={cn("transition-opacity", pending && "opacity-50")} aria-busy={pending}>
        {view.kind === "result" && <Result key={`${view.result.name}-${view.at}`} result={view.result} at={view.at} />}
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
