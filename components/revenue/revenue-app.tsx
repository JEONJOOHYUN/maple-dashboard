"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Users } from "lucide-react";
import { openRevenue } from "@/app/revenue/actions";
import { KeyGate, SOON_AGAIN, type Connected } from "@/components/enhance/key-gate";
import { IntentLink } from "@/components/intent-link";
import { PageHeader } from "@/components/page-header";
import { PageWaiting } from "@/components/page-waiting";
import { Board } from "@/components/revenue/board";
import { Picker, type AccountView } from "@/components/revenue/picker";
import { useRevenueData, type Char, type Problem } from "@/components/revenue/use-data";
import { useRevenueSettings } from "@/components/revenue/use-settings";
import { KEPT_KEY_PROBLEMS } from "@/lib/auth/key-problems";
import { characterList, createApi } from "@/lib/enhance/client";
import { keyLabel, withKey, withName, type SavedKey } from "@/lib/enhance/keys";
import { bossRows, lastWeekDate, monthlyThisWeek, weekId } from "@/lib/revenue/calc";
import { MAX_PICKED, SCAN_MIN_LEVEL } from "@/lib/revenue/data";
import type { MemberRevenue } from "@/lib/revenue/server";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";
import { ACCOUNT_COLORS, focus, lineTile } from "@/components/revenue/styles";

const ERRORS: Record<Problem, string> = {
  badKey: "API 키가 올바르지 않음 → 빼고 다시 추가",
  quota: "이 키의 호출 한도 초과 → 내일 다시",
  ...SOON_AGAIN,
  locked: KEPT_KEY_PROBLEMS.locked,
};

const TITLE = "보스 수익";
const noChange = () => () => {};
const isMarked = () => !!document.documentElement.dataset.member;
const TO_ME = "shrink-0 rounded-lg px-2.5 font-bold hover:underline";

/** One red line above the page's content, with what to do about it on the right. */
function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-[13px] font-semibold text-destructive">
      <span>{children}</span>
      {action}
    </div>
  );
}
function Again({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-8 shrink-0 rounded-lg px-2.5 font-bold hover:bg-destructive/10", focus)}>
      다시
    </button>
  );
}

/**
 * 보스 수익: this week's crystals and checked rewards of the characters the user follows.
 * A visitor: from the scheduler of every NEXON key in use, the keys remembered for 강화 기록 too (same list, same
 * browser); nothing reaches our server. A signed-in member: from the NEXON accounts connected on 내 정보 (our server
 * asks with the keys it keeps), and what is set here is kept with the account, so another device shows the same.
 * The page itself stays static: only a browser that carries the sign-in mark asks the server who it is.
 */
export function RevenueApp() {
  const now = useNow();
  // The mark the header shows the sign-in with (lib/auth/member-hint.ts, on <html> before the first paint): a
  // browser without it is a visitor's and nobody is asked. null = not known yet (server render, hydration).
  const marked = useSyncExternalStore(noChange, isMarked, () => null);
  const [found, setFound] = useState<MemberRevenue | "guest" | "failed" | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!marked) return;
    let on = true;
    openRevenue().then(
      (r) => on && setFound(r),
      () => on && setFound("failed")
    );
    return () => {
      on = false;
    };
  }, [marked, tries]);

  if (now <= 0 || marked === null) return <PageHeader title={TITLE} pinAside />;
  if (!marked) return <Screen now={now} member={null} />;
  if (found === null) return <PageWaiting title={TITLE} />;
  if (found === "failed")
    return (
      <div className="flex flex-col gap-2">
        <PageHeader title={TITLE} pinAside />
        <Notice
          action={
            <Again
              onClick={() => {
                setFound(null);
                setTries((n) => n + 1);
              }}
            />
          }
        >
          내 계정을 못 불러옴 → 잠시 뒤 다시
        </Notice>
      </div>
    );
  return <Screen now={now} member={found === "guest" ? null : found} />;
}

function Screen({ now, member }: { now: number; member: MemberRevenue | null }) {
  /** The NEXON accounts connected to the member, when there are any: they are what the page shows. */
  const registered = member?.accounts.length ? member : null;
  const settings = useRevenueSettings(useMemo(() => member && { who: member.who, settings: member.settings, accounts: member.accounts.map((a) => a.id) }, [member]));
  const { picked, setPicked, autoPicked, setAutoPicked } = settings;
  const [saved] = useStored<Connected | null>("enhance:key", null);
  const [keys, setKeys] = useStored<SavedKey[]>("enhance:keys", []);
  const [session, setSession] = useState<SavedKey[]>([]);
  const [using, setUsing] = useStored<string[]>("revenue:accounts", []);
  // Nothing picked yet: the picker stays up while the first characters are picked for the user (a member's first
  // visit would otherwise jump to the board the moment they are).
  const [view, setView] = useState<"pick" | "board" | null>(() => (picked.length ? null : "pick"));
  const [adding, setAdding] = useState(false);

  // Every key this browser knows (a key remembered before there was a list belongs in it), then the ones in use.
  const known = useMemo(() => {
    const list = saved ? withKey(keys, saved) : keys;
    return [...list, ...session.filter((s) => !list.some((k) => k.account === s.account))];
  }, [saved, keys, session]);
  const active = useMemo(() => (registered ? [] : using.map((id) => known.find((k) => k.account === id)).filter((k): k is SavedKey => !!k)), [registered, using, known]);
  const { accounts, states, prev, faces, load, loadPrev, loadFaces, refresh, retryAccounts, loadedAt, limited } = useRevenueData(active, registered, weekId(now), lastWeekDate(now));

  const views: AccountView[] = useMemo(() => {
    const inUse = registered ? registered.accounts.map((a) => ({ account: a.id, name: a.name, label: "" })) : active.map((k, i) => ({ account: k.account, name: k.name, label: keyLabel(k, i) }));
    return inUse.map((k, i) => {
      const a = accounts[k.account];
      const chars = a?.chars ?? [];
      const name = k.name || chars[0]?.name;
      return {
        account: k.account,
        label: name ? `${name} 계정` : k.label || `넥슨 계정 ${i + 1}`,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
        chars,
        loading: !a,
        error: a?.status === "error" ? (registered && a.error === "badKey" ? KEPT_KEY_PROBLEMS.badKey : ERRORS[a.error ?? "failed"]) : undefined,
      };
    });
  }, [registered, active, accounts]);
  const allChars = useMemo(() => {
    const seen = new Set<string>();
    return views.flatMap((v) => v.chars).filter((c) => !seen.has(c.ocid) && !!seen.add(c.ocid));
  }, [views]);
  const byOcid = useMemo(() => new Map(allChars.map((c) => [c.ocid, c])), [allChars]);
  const pickedChars = useMemo(() => [...new Set(picked)].map((o) => byOcid.get(o)).filter((c): c is Char => !!c).sort((a, b) => b.level - a.level).slice(0, MAX_PICKED), [picked, byOcid]);
  const shown = useMemo(() => pickedChars.map((c) => c.ocid), [pickedChars]);
  const setShown = (next: string[]) => setPicked((prev) => [...prev.filter((o) => !byOcid.has(o)), ...new Set(next)]);
  const current = !views.length || adding ? "keys" : (view ?? (picked.length ? "board" : "pick"));

  // Picking: ask the scheduler of every character high enough for weekly bosses.
  const toScan = useMemo(() => allChars.filter((c) => c.level >= SCAN_MIN_LEVEL), [allChars]);
  useEffect(() => {
    if (current === "pick") load(toScan);
  }, [current, toScan, load]);
  // The board: the picked characters.
  useEffect(() => {
    if (current === "board") {
      load(pickedChars);
      loadFaces(pickedChars);
    }
  }, [current, pickedChars, load, loadFaces]);

  // 2. A remembered key is named after its account's highest character as soon as that list is here, so lists of
  // keys (here and on 강화 기록) show a name instead of "저장된 키 n".
  useEffect(() => {
    for (const v of views) {
      const top = v.chars[0]?.name;
      if (top && keys.some((k) => k.account === v.account && !k.name)) setKeys((prev) => withName(prev, v.account, top));
    }
  }, [views, keys, setKeys]);

  // The first time an account's characters are all checked, pick the ones with a weekly boss list (highest first).
  useEffect(() => {
    if (views.some((v) => v.loading)) return;
    for (const v of views) {
      if (v.error || autoPicked.includes(v.account)) continue;
      const mine = v.chars.filter((c) => c.level >= SCAN_MIN_LEVEL);
      if (mine.some((c) => !(c.ocid in states))) continue;
      const add = mine.filter((c) => bossRows(states[c.ocid]).some((r) => !r.monthly)).map((c) => c.ocid);
      setPicked((prev) => {
        const room = MAX_PICKED - prev.filter((o) => byOcid.has(o)).length;
        return [...prev, ...add.filter((o) => !prev.includes(o)).slice(0, Math.max(0, room))];
      });
      setAutoPicked((prev) => [...prev, v.account]);
    }
  }, [views, states, autoPicked, setPicked, setAutoPicked, byOcid]);

  // A monthly boss cleared now: was it this week? Last week's scheduler says (only asked when that matters).
  const monthlyToCheck = useMemo(
    () => pickedChars.filter((c) => bossRows(states[c.ocid]).some((r) => r.monthly && r.done && monthlyThisWeek(r.boss, undefined, now) === null)),
    [pickedChars, states, now]
  );
  useEffect(() => {
    if (current === "board") loadPrev(monthlyToCheck);
  }, [current, monthlyToCheck, loadPrev]);

  const connect = (value: Connected, remember: boolean) => {
    if (remember) setKeys((prev) => withKey(prev, value));
    else setSession((prev) => [...prev.filter((s) => s.account !== value.account), value]);
    setUsing((prev) => (prev.includes(value.account) ? prev : [...prev, value.account]));
    setAdding(false);
    setView("pick");
  };
  const remove = (account: string) => {
    const kept = new Set(views.filter((v) => v.account !== account).flatMap((v) => v.chars.map((c) => c.ocid)));
    const gone = new Set(views.find((v) => v.account === account)?.chars.map((c) => c.ocid).filter((o) => !kept.has(o)));
    setUsing((prev) => prev.filter((x) => x !== account));
    setPicked((prev) => prev.filter((o) => !gone.has(o)));
    setAutoPicked((prev) => prev.filter((x) => x !== account));
  };

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title={TITLE}
        pinAside
        aside={
          current === "board" && (
            <div className="flex items-center gap-1.5">
              <span className="hidden h-[30px] items-center rounded-full bg-muted px-3 text-[13px] font-semibold text-muted-foreground sm:inline-flex">
                {registered ? `넥슨 계정 ${views.length}개` : `API 키 ${views.length}개`} · {member ? "설정은 내 계정에" : "이 브라우저"}
              </span>
              <button
                type="button"
                onClick={() => setView("pick")}
                className={cn("inline-flex h-9 items-center gap-1.5 tile-sm px-3.5 text-[13px] font-bold hover:bg-muted", focus)}
              >
                <Users className="size-[15px]" aria-hidden="true" />
                캐릭터 <span className="font-num">{pickedChars.length}</span>명
              </button>
            </div>
          )
        }
      />
      {/* A member's change that did not reach the account: said wherever the page is, it would be lost on leaving. */}
      {settings.unsaved === "guest" && (
        <Notice
          action={
            <IntentLink whole href="/login?next=/revenue" className={cn(TO_ME, focus)}>
              로그인
            </IntentLink>
          }
        >
          로그인이 풀려 바꾼 설정이 저장 안 됨
        </Notice>
      )}
      {settings.unsaved === "failed" && <Notice action={<Again onClick={settings.saveAgain} />}>바꾼 설정을 계정에 저장 못 함</Notice>}
      {current === "keys" ? (
        <div className="flex flex-col gap-2">
          {adding && active.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className={cn("self-start px-1 text-[13px] font-semibold text-primary-text hover:underline", focus)}>
              ← 돌아가기
            </button>
          )}
          {member && (
            <div className={cn(lineTile, "text-[13px]")}>
              <span>
                내 정보에 키를 등록하면 <b>다른 기기에서도 키 없이</b> 열림
              </span>
              <IntentLink href="/me" className={cn(TO_ME, "text-primary-text", focus)}>
                내 정보 →
              </IntentLink>
            </div>
          )}
          <KeyGate
            saved={known.filter((k) => !using.includes(k.account))}
            onConnect={connect}
            onNamed={(account, name) => setKeys((prev) => withName(prev, account, name))}
            action="보스 수익 보기"
            check={(key) => characterList(createApi(key))}
            savedHint="저장된 키 → 누르면 바로 (강화 기록에 저장한 키도 여기)"
            notes={[member ? "여기 넣은 키 = 이 브라우저에만 저장 · 파티원 · 가격 설정은 내 계정에" : "키 = 이 브라우저에만 저장, 우리 서버로 안 보냄", "키 하나 = 그 키를 만든 넥슨 계정 · 여러 개 등록하면 합쳐서 봄"]}
          />
        </div>
      ) : current === "pick" ? (
        <Picker accounts={views} chars={allChars} states={states} picked={shown} onPick={setShown} onDone={() => setView("board")} onAdd={() => setAdding(true)} onRemove={remove} onRetry={retryAccounts} registered={!!registered} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* An account whose character list did not come: its characters are missing from the board, so say so. */}
          {views
            .filter((v) => v.error)
            .map((v) => (
              <Notice key={v.account} action={<Again onClick={retryAccounts} />}>
                {v.label} · {v.error}
              </Notice>
            ))}
          {limited && <Notice>새로 고침이 너무 잦음 → 잠시 뒤 다시</Notice>}
          <Board chars={pickedChars} states={states} prev={prev} faces={faces} loadedAt={loadedAt} now={now} onRefresh={() => refresh(pickedChars)} settings={settings} />
        </div>
      )}
    </div>
  );
}
