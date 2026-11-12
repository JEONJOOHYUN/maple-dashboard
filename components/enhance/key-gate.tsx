"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { ApiError, accountId, createApi, type ApiErrorKind } from "@/lib/enhance/client";
import { kstDate } from "@/lib/enhance/kst";

export type Connected = { key: string; account: string };

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음",
  quota: "이 키의 호출 한도 초과 (하루 1,000회) → 내일 다시",
  param: "넥슨 API 응답 오류 → 잠시 뒤 다시",
  busy: "넥슨 API 점검 중 → 잠시 뒤 다시",
  network: "넥슨 서버 연결 실패 → 잠시 뒤 다시",
  failed: "넥슨 API 응답 오류 → 잠시 뒤 다시",
};

const STEPS = [
  <>
    <b>openapi.nexon.com</b> → 넥슨 계정 로그인
  </>,
  <>
    내 애플리케이션 → <b>애플리케이션 등록</b> (메이플스토리)
  </>,
  <>
    발급된 <b>API 키 복사</b> → 왼쪽 칸에 붙여 넣기
  </>,
];

export function KeyGate({ onConnect }: { onConnect: (value: Connected, remember: boolean) => void }) {
  const [text, setText] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const key = text.trim();
    if (!key || busy) return;
    setBusy(true);
    setError("");
    try {
      // One small call tells whether the key works for the history API.
      await createApi(key).get("history/starforce", { count: "10", date: kstDate(Date.now()) });
      onConnect({ key, account: await accountId(key) }, remember);
    } catch (err) {
      setError(ERRORS[err instanceof ApiError ? err.kind : "failed"]);
      setBusy(false);
    }
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-5 lg:p-7">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="size-3.5" aria-hidden="true" />
            넥슨 Open API 키
          </span>
          <input
            type="password"
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-clarity-mask="true"
            autoComplete="off"
            spellCheck={false}
            placeholder="발급받은 키 붙여 넣기"
            aria-invalid={error ? true : undefined}
            className="h-[46px] rounded-lg border border-input bg-background px-3.5 text-[15px] text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 aria-invalid:border-destructive"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-primary" />
          이 브라우저에 키 기억
        </label>
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-bold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          강화 기록 보기
        </button>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <ul className="flex list-disc flex-col gap-1 pl-[18px] text-xs leading-relaxed text-muted-foreground">
          <li>키 · 기록 = 이 브라우저에만 저장, 우리 서버로 안 보냄</li>
          <li>키를 발급한 넥슨 계정의 기록만 조회</li>
          <li>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              개인정보처리방침
            </Link>
          </li>
        </ul>
      </form>

      <section className="flex flex-col gap-3 rounded-lg bg-muted p-5 lg:p-7">
        <h2 className="font-heading text-base font-bold">API 키 받는 법</h2>
        {STEPS.map((step, i) => (
          <p key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
            <b className="font-num text-primary-text">0{i + 1}</b>
            <span>{step}</span>
          </p>
        ))}
        <a
          href="https://openapi.nexon.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          openapi.nexon.com 열기
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
