"use client";

import { startTransition, useActionState, useState, type MouseEvent } from "react";
import { KeyRound } from "lucide-react";
import { leave, removeKey, saveKey, type FormState } from "@/app/me/actions";
import { DotLine } from "@/components/auth/dot-line";
import { Spinner } from "@/components/ui/spinner";
import { SwapLabel } from "@/components/ui/swap-icon";
import { keyLabel, withKey, type SavedKey } from "@/lib/enhance/keys";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

export type NexonAccount = { id: number; name: string; world: string; added: string };

const NONE: FormState = {};
// 16px on a phone: iOS zooms the page in on a field with smaller text.
const FIELD =
  "min-w-0 flex-1 rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/40 aria-invalid:border-destructive sm:text-[15px]";
// The `after` box takes the 32px button to 44px for a finger, up to half of the 6px gap to the button next to it.
const SMALL =
  "relative h-8 rounded-lg tile-edge bg-card px-2.5 text-xs font-semibold whitespace-nowrap outline-none transition-[background-color,scale] after:absolute after:-inset-x-[3px] after:-inset-y-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-50";

/**
 * For a button that deletes: the first press only asks (the words change), the second one sends. The first press
 * is stopped here, in the event itself. Switching the button's type instead does not work: React has already drawn
 * the "submit" button by the time the browser acts on the click, so one press would send the form. Leaving the
 * button (onBlur) takes the question back.
 */
function askFirst(e: MouseEvent<HTMLButtonElement>, sure: boolean, setSure: (sure: boolean) => void) {
  if (sure) return;
  e.preventDefault();
  setSure(true);
}

/** The one line under a form: what went wrong, or what was done. */
function Result({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-[13px] font-semibold text-destructive">
        {state.error}
      </p>
    );
  if (state.done)
    return (
      <p role="status" className="text-[13px] font-semibold text-primary-text">
        {state.done}
      </p>
    );
  return null;
}

function KeyField({ invalid, small, id }: { invalid: boolean; small?: boolean; id?: string }) {
  return (
    <input
      id={id}
      name="key"
      type="password"
      data-clarity-mask="true"
      autoComplete="off"
      spellCheck={false}
      placeholder="발급받은 키 붙여 넣기"
      aria-invalid={invalid ? true : undefined}
      className={cn(FIELD, small ? "h-10" : "h-[46px]")}
    />
  );
}

/** One connected NEXON account: its main character, and the two things done to it. */
function AccountRow({ account, index }: { account: NexonAccount; index: number }) {
  const [swapping, setSwapping] = useState(false);
  const [sure, setSure] = useState(false);
  const [saved, save, saving] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await saveKey(prev, form);
    if (next.done) setSwapping(false);
    return next;
  }, NONE);
  const [removed, remove, removing] = useActionState(removeKey, NONE);
  const busy = saving || removing;
  const title = account.name || `넥슨 계정 ${index + 1}`;

  return (
    <li className="flex flex-col gap-2.5 rounded-[10px] tile-edge bg-background px-3.5 py-3" data-clarity-mask="true">
      <div className="flex items-center gap-3">
        <KeyRound className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
        <div className="flex min-w-0 flex-col">
          <b className="truncate text-sm">{title}</b>
          <DotLine className="text-xs text-muted-foreground" parts={[account.world, `${account.added} 등록`]} />
        </div>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button type="button" disabled={busy} aria-expanded={swapping} onClick={() => setSwapping((v) => !v)} className={cn(SMALL, "text-foreground")}>
            키 교체
          </button>
          <form action={remove} className="flex">
            <input type="hidden" name="row" value={account.id} />
            <button
              type="submit"
              disabled={busy}
              onClick={(e) => askFirst(e, sure, setSure)}
              onBlur={() => setSure(false)}
              className={cn(SMALL, "text-destructive")}
            >
              <SwapLabel on={sure} from="삭제" to="한 번 더" />
            </button>
          </form>
        </div>
      </div>
      {swapping && (
        <form action={save} className="flex gap-2">
          <input type="hidden" name="row" value={account.id} />
          <KeyField invalid={!!saved.error} small />
          <button
            type="submit"
            disabled={busy}
            className="h-10 shrink-0 rounded-lg bg-primary px-4 text-[13px] font-bold whitespace-nowrap text-primary-foreground outline-none transition-[background-color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-50"
          >
            <SwapLabel on={saving} from="교체" to={<Spinner size={14} />} />
          </button>
        </form>
      )}
      <Result state={removed.error ? removed : saved} />
    </li>
  );
}

/**
 * The field that connects one more NEXON account (or, with a key of a connected one, replaces its key). Above it,
 * the keys this browser remembers from 강화 기록 · 보스 수익 (the same list those two keep): one press sends that
 * key. A key named like an account already connected is left out — `names` are the connected accounts.
 */
function AddKey({ more, names }: { more: boolean; names: string[] }) {
  const [state, action, pending] = useActionState(saveKey, NONE);
  const [current] = useStored<SavedKey | null>("enhance:key", null);
  const [kept] = useStored<SavedKey[]>("enhance:keys", []);
  const here = (current ? withKey(kept, current) : kept).map((k, i) => ({ ...k, label: keyLabel(k, i) })).filter((k) => !k.name || !names.includes(k.name));
  return (
    <>
      {here.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-border pb-4" data-clarity-mask="true">
          <span className="text-[13px] text-muted-foreground">이 브라우저에 저장된 키 → 누르면 등록</span>
          <div className="flex flex-wrap gap-2">
            {here.map((k) => (
              <button
                key={k.account}
                type="button"
                disabled={pending}
                onClick={() => {
                  const form = new FormData();
                  form.set("key", k.key);
                  startTransition(() => action(form));
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg tile-edge bg-background pr-3 pl-2.5 text-[13px] font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <KeyRound className="size-3.5 text-primary-text" aria-hidden="true" />
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <form action={action} className="flex flex-col gap-1.5">
        <label htmlFor="member-key" className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted-foreground">
          <KeyRound className="size-3.5" aria-hidden="true" />
          {more ? "다른 넥슨 계정의 API 키" : "넥슨 Open API 키"}
        </label>
        <div className="flex gap-2">
          <KeyField id="member-key" invalid={!!state.error} />
          <button
            type="submit"
            disabled={pending}
            className="h-[46px] shrink-0 rounded-lg bg-primary px-5 text-[15px] font-bold whitespace-nowrap text-primary-foreground outline-none transition-[background-color,scale] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:opacity-50"
          >
            <SwapLabel on={pending} from="등록" to={<Spinner />} />
          </button>
        </div>
      </form>
      <Result state={state} />
    </>
  );
}

/** The NEXON accounts connected to the member, and the field that connects one more. */
export function KeyPanel({ accounts }: { accounts: NexonAccount[] }) {
  return (
    <section className="flex flex-col gap-3.5 tile p-5 lg:p-7">
      <h2 className="text-base font-bold">넥슨 계정</h2>
      {accounts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {accounts.map((a, i) => (
            <AccountRow key={a.id} account={a} index={i} />
          ))}
        </ul>
      )}
      {/* A new field whenever the list changes: the new or missing row already says what happened, so the line
          under the field ("등록됨", an old error) does not stay behind. */}
      <AddKey key={accounts.map((a) => a.id).join()} more={accounts.length > 0} names={accounts.map((a) => a.name)} />
      <ul className="flex list-disc flex-col gap-1 pl-[18px] text-xs leading-relaxed text-muted-foreground">
        <li>키 = 암호화해서 서버에 보관 · 삭제하면 바로 지워짐</li>
        <li>넥슨 계정 하나에 키 하나 · 여러 계정 등록 가능</li>
      </ul>
    </section>
  );
}

/** 회원 탈퇴, under the tiles: small on purpose, and it asks once before it goes. */
export function LeaveLink() {
  const [sure, setSure] = useState(false);
  const [state, action, pending] = useActionState(leave, NONE);
  return (
    <form action={action} className="mt-1 flex flex-col items-start gap-1.5 pl-5 lg:pl-7">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => askFirst(e, sure, setSure)}
        onBlur={() => setSure(false)}
        className={cn(
          "relative text-xs underline underline-offset-2 outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          sure ? "font-semibold text-destructive" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {sure ? "한 번 더 누르면 탈퇴 · 등록한 키 모두 삭제" : "회원 탈퇴"}
      </button>
      <Result state={state} />
    </form>
  );
}
