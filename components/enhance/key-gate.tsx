"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { ApiError, accountId, createApi, type ApiErrorKind } from "@/lib/enhance/client";
import { keyLabel, type SavedKey } from "@/lib/enhance/keys";
import { kstDate } from "@/lib/enhance/kst";
import { hasRecords } from "@/lib/enhance/sync";

export type Connected = { key: string; account: string };

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음",
  quota: "이 키의 호출 한도 초과 (하루 1,000회) → 내일 다시",
  param: "넥슨 API 응답 오류 → 잠시 뒤 다시",
  busy: "넥슨 API 점검 중 → 잠시 뒤 다시",
  network: "넥슨 서버 연결 실패 → 잠시 뒤 다시",
  failed: "넥슨 API 응답 오류 → 잠시 뒤 다시",
};

// The order of NEXON's own registration page (마이 페이지 → 애플리케이션 등록, seen 2026-11-12).
const STEPS = [
  <>
    아래 <b>애플리케이션 등록</b> 열기 → 넥슨 계정 로그인
  </>,
  <>
    약관 동의 → 게임 <b>메이플스토리</b> → <b>개발 단계</b> 선택
  </>,
  <>
    서비스명에 아무 이름 (예: 내 강화 기록) → <b>등록</b>
  </>,
  <>
    애플리케이션 목록 → <b>API Key 복사</b> → 왼쪽 칸에 붙여 넣기
  </>,
];
/** Signed out, NEXON sends this to its sign-in page and back (checked 2026-11-12). */
const REGISTER_URL = "https://openapi.nexon.com/ko/my-application/create-app/";

/** `saved` = the keys remembered in this browser: one click goes back to that account, its records still here. */
export function KeyGate({ saved, onConnect, onForgetAll }: { saved: SavedKey[]; onConnect: (value: Connected, remember: boolean) => void; onForgetAll: () => void }) {
  const [text, setText] = useState("");
  // Records can be left here without a remembered key (a key used with "기억" off): the way to delete them shows then too.
  const [left, setLeft] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    let on = true;
    void hasRecords().then((any) => on && setLeft(any));
    return () => {
      on = false;
    };
  }, []);
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
        {saved.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-border pb-4" data-clarity-mask="true">
            <span className="text-[13px] text-muted-foreground">저장된 키 → 기록 그대로</span>
            <div className="flex flex-wrap gap-2">
              {saved.map((k, i) => (
                <button
                  key={k.account}
                  type="button"
                  // Not while a new key is being checked: its answer would land after this choice and undo it.
                  disabled={busy}
                  onClick={() => onConnect({ key: k.key, account: k.account }, true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-semibold outline-none hover:border-primary/60 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <KeyRound className="size-3.5 text-primary-text" aria-hidden="true" />
                  {keyLabel(k, i)}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="size-3.5" aria-hidden="true" />
            {saved.length > 0 ? "다른 넥슨 Open API 키" : "넥슨 Open API 키"}
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
          <li>키를 발급한 넥슨 계정의 기록만 조회 · 키마다 따로 저장</li>
          <li>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              개인정보처리방침
            </Link>
          </li>
        </ul>
        {(saved.length > 0 || left) && (
          <button
            type="button"
            // Nor a wipe: the key being checked would be saved again right after it.
            disabled={busy}
            onClick={() => {
              if (!sure) return setSure(true);
              onForgetAll();
              setLeft(false);
              setSure(false);
            }}
            className={`self-start text-xs underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${sure ? "font-semibold text-destructive" : "text-muted-foreground hover:text-foreground"}`}
          >
            {sure ? "한 번 더 누르면 모두 삭제" : "이 브라우저의 키 · 기록 모두 지우기"}
          </button>
        )}
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
          href={REGISTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          애플리케이션 등록 열기 (openapi.nexon.com)
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <p className="text-xs leading-relaxed text-muted-foreground">개발 단계 키 = 하루 1,000건 → 최근 1년 · 전체 2년은 여러 날에 나눠 받음</p>
      </section>
    </div>
  );
}
