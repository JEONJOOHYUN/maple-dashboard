"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyGuide } from "@/components/enhance/key-guide";
import { Spinner } from "@/components/ui/spinner";
import { SwapIcon } from "@/components/ui/swap-icon";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ApiError, accountId, createApi, fetchMainCharacter, type ApiErrorKind } from "@/lib/enhance/client";
import { keyLabel, type SavedKey } from "@/lib/enhance/keys";
import { kstDate } from "@/lib/enhance/kst";
import { hasRecords } from "@/lib/enhance/sync";

export type Connected = { key: string; account: string };

/** What a key check that failed for NEXON's side says, here and on 보스 수익 (each says its own key and quota lines). */
export const SOON_AGAIN = {
  param: "넥슨 API 응답 오류 → 잠시 뒤 다시",
  busy: "넥슨 API 점검 중 → 잠시 뒤 다시",
  network: "넥슨 서버 연결 실패 → 잠시 뒤 다시",
  failed: "넥슨 API 응답 오류 → 잠시 뒤 다시",
} satisfies Partial<Record<ApiErrorKind, string>>;

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음",
  quota: "이 키의 호출 한도 초과 (개발 단계 키 = 하루 1,000건) → 내일 다시",
  ...SOON_AGAIN,
};

/**
 * Saved keys without a name get their account's highest character (one call each — the same character/list the
 * page asks anyway, so usually none of its own). Used by the key gate for the list it shows and by 강화 기록 for the
 * key in use. `onNamed` may be a new function each render: the keys are what decide the calls.
 */
export function useKeyNames(keys: { key: string; account: string }[], onNamed: ((account: string, name: string) => void) | undefined) {
  const named = useRef(onNamed);
  useEffect(() => {
    named.current = onNamed;
  });
  const signature = onNamed ? keys.map((k) => `${k.account}:${k.key}`).join(",") : "";
  useEffect(() => {
    if (!signature) return;
    const stop = new AbortController();
    for (const part of signature.split(",")) {
      const at = part.indexOf(":");
      const account = part.slice(0, at);
      fetchMainCharacter(createApi(part.slice(at + 1), account), stop.signal)
        .then((who) => {
          if (who && !stop.signal.aborted) named.current?.(account, who);
        })
        .catch(() => {});
    }
    return () => stop.abort();
  }, [signature]);
}
/** Pressed with nothing in the field (the button stays on: a greyed one would not say why). */
const NO_KEY = "API 키 먼저 붙여 넣기";

/** One small call that tells whether a key works for what the page asks NEXON. */
const checkHistory = (key: string) => createApi(key).get("history/starforce", { count: "10", date: kstDate(Date.now()) });

/**
 * `saved` = the keys remembered in this browser: one click goes back to that account, its records still here.
 * The boss revenue page uses the same gate with its own button words, check and notes.
 */
export function KeyGate({
  saved,
  onConnect,
  onForgetAll,
  onNamed,
  action = "강화 기록 보기",
  check = checkHistory,
  savedHint = "저장된 키 → 기록 그대로",
  notes = ["키 · 기록 = 이 브라우저에만 저장, 우리 서버로 안 보냄", "키를 발급한 넥슨 계정의 기록만 조회 · 키마다 따로 저장"],
}: {
  saved: SavedKey[];
  onConnect: (value: Connected, remember: boolean) => void;
  onForgetAll?: () => void;
  /** A saved key without a name gets its account's highest character (one call each, when the gate shows). */
  onNamed?: (account: string, name: string) => void;
  action?: string;
  check?: (key: string) => Promise<unknown>;
  savedHint?: string;
  notes?: string[];
}) {
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
  useKeyNames(
    saved.filter((k) => !k.name),
    onNamed
  );
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The button stays on with an empty field: pressing it says what is missing and goes to the field.
  const field = useRef<HTMLInputElement>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const key = text.trim();
    if (busy) return;
    if (!key) {
      setError(NO_KEY);
      field.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await check(key);
      onConnect({ key, account: await accountId(key) }, remember);
    } catch (err) {
      setError(ERRORS[err instanceof ApiError ? err.kind : "failed"]);
      setBusy(false);
    }
  };

  return (
    <div className="grid items-start gap-2 lg:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-3.5 tile p-5 lg:p-7">
        {saved.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-border pb-4" data-clarity-mask="true">
            <span className="text-[13px] text-muted-foreground">{savedHint}</span>
            <div className="flex flex-wrap gap-2">
              {saved.map((k, i) => (
                <button
                  key={k.account}
                  type="button"
                  // Not while a new key is being checked: its answer would land after this choice and undo it.
                  disabled={busy}
                  onClick={() => onConnect({ key: k.key, account: k.account }, true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg tile-edge bg-background pr-3 pl-2.5 text-[13px] font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
            ref={field}
            type="password"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error === NO_KEY) setError("");
            }}
            data-clarity-mask="true"
            autoComplete="off"
            spellCheck={false}
            placeholder="발급받은 키 붙여 넣기"
            aria-invalid={error ? true : undefined}
            // 16px on a phone: iOS zooms the page in on a field with smaller text.
            className="h-[46px] rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 aria-invalid:border-destructive sm:text-[15px]"
          />
        </label>
        <label className="relative inline-flex items-center gap-2 text-[13px] after:absolute after:-inset-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-primary" />
          이 브라우저에 키 기억
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {/* The spinner hangs to the left of the words: they stay in the middle whether it shows or not. */}
          <span className="relative">
            <SwapIcon className="absolute top-1/2 right-full mr-2 -translate-y-1/2" on={busy} from={<span className="size-4" />} to={<Spinner />} />
            {action}
          </span>
        </button>
        {!!error && (
          <div>
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        </div>
        )}
        <ul className="flex list-disc flex-col gap-1 pl-[18px] text-xs leading-relaxed text-muted-foreground">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              개인정보처리방침
            </Link>
          </li>
        </ul>
        {onForgetAll && (saved.length > 0 || left) && (
          <button
            type="button"
            // Nor a wipe: the key being checked would be saved again right after it.
            disabled={busy}
            onClick={() => {
              if (!sure) return setSure(true);
              onForgetAll?.();
              setLeft(false);
              setSure(false);
            }}
            className={`relative self-start text-xs underline underline-offset-2 outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${sure ? "font-semibold text-destructive" : "text-muted-foreground hover:text-foreground"}`}
          >
            {sure ? "한 번 더 누르면 모두 삭제" : "이 브라우저의 키 · 기록 모두 지우기"}
          </button>
        )}
      </form>

      <KeyGuide />
    </div>
  );
}
