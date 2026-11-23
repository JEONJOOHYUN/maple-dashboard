"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { KeyGate, type Connected } from "@/components/enhance/key-gate";
import { PageHeader } from "@/components/page-header";
import { Board } from "@/components/revenue/board";
import { Picker, type AccountView } from "@/components/revenue/picker";
import { useRevenueData, type Char } from "@/components/revenue/use-data";
import { createApi, type ApiErrorKind } from "@/lib/enhance/client";
import { keyLabel, withKey, withName, type SavedKey } from "@/lib/enhance/keys";
import { bossRows, lastWeekDate, monthlyThisWeek, weekId } from "@/lib/revenue/calc";
import { MAX_PICKED, SCAN_MIN_LEVEL } from "@/lib/revenue/data";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";
import { focus } from "@/components/revenue/styles";

const ERRORS: Record<ApiErrorKind, string> = {
  badKey: "API 키가 올바르지 않음 → 빼고 다시 추가",
  quota: "이 키의 호출 한도 초과 → 내일 다시",
  param: "넥슨 API 응답 오류 → 잠시 뒤 다시",
  busy: "넥슨 API 점검 중 → 잠시 뒤 다시",
  network: "넥슨 서버 연결 실패 → 잠시 뒤 다시",
  failed: "넥슨 API 응답 오류 → 잠시 뒤 다시",
};
/** One colour per account, in the order they were added. */
const COLORS = ["oklch(0.72 0.16 45)", "oklch(0.70 0.13 230)", "oklch(0.70 0.14 150)", "oklch(0.70 0.15 320)", "oklch(0.75 0.13 95)"];

/**
 * 보스 수익: this week's crystals and checked rewards of the characters the user follows, from the scheduler of every
 * NEXON key in use. Keys are the ones remembered for 강화 기록 too (same list, same browser), so a returning visitor
 * clicks one instead of pasting it again; nothing reaches our server.
 */
export function RevenueApp() {
  const now = useNow();
  const ready = now > 0;
  const [saved] = useStored<Connected | null>("enhance:key", null);
  const [keys, setKeys] = useStored<SavedKey[]>("enhance:keys", []);
  const [session, setSession] = useState<SavedKey[]>([]);
  const [using, setUsing] = useStored<string[]>("revenue:accounts", []);
  const [picked, setPicked] = useStored<string[]>("revenue:picked", []);
  const [autoPicked, setAutoPicked] = useStored<string[]>("revenue:autoPicked", []);
  const [view, setView] = useState<"pick" | "board" | null>(null);
  const [adding, setAdding] = useState(false);

  // Every key this browser knows (a key remembered before there was a list belongs in it), then the ones in use.
  const known = useMemo(() => {
    const list = saved ? withKey(keys, saved) : keys;
    return [...list, ...session.filter((s) => !list.some((k) => k.account === s.account))];
  }, [saved, keys, session]);
  const active = useMemo(() => using.map((id) => known.find((k) => k.account === id)).filter((k): k is SavedKey => !!k), [using, known]);
  const { accounts, states, prev, faces, load, loadPrev, loadFaces, refresh, retryAccounts, loadedAt } = useRevenueData(active, weekId(now), lastWeekDate(now));

  const views: AccountView[] = useMemo(() => active.map((k, i) => {
    const a = accounts[k.account];
    const chars = a?.chars ?? [];
    const name = k.name || chars[0]?.name;
    return {
      account: k.account,
      label: name ? `${name} 계정` : keyLabel(k, i),
      color: COLORS[i % COLORS.length],
      chars,
      loading: !a,
      error: a?.status === "error" ? ERRORS[a.error ?? "failed"] : undefined,
    };
  }), [active, accounts]);
  const allChars = useMemo(() => {
    const seen = new Set<string>();
    return views.flatMap((v) => v.chars).filter((c) => !seen.has(c.ocid) && !!seen.add(c.ocid));
  }, [views]);
  const byOcid = useMemo(() => new Map(allChars.map((c) => [c.ocid, c])), [allChars]);
  const pickedChars = useMemo(() => [...new Set(picked)].map((o) => byOcid.get(o)).filter((c): c is Char => !!c).sort((a, b) => b.level - a.level).slice(0, MAX_PICKED), [picked, byOcid]);
  const shown = useMemo(() => pickedChars.map((c) => c.ocid), [pickedChars]);
  const setShown = (next: string[]) => setPicked((prev) => [...prev.filter((o) => !byOcid.has(o)), ...new Set(next)]);
  const current = !active.length || adding ? "keys" : (view ?? (picked.length ? "board" : "pick"));

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
        title="보스 수익"
        pinAside
        aside={
          ready &&
          current === "board" && (
            <div className="flex items-center gap-1.5">
              <span className="hidden h-[30px] items-center rounded-full bg-muted px-3 text-[13px] font-semibold text-muted-foreground sm:inline-flex">
                API 키 {active.length}개 · 이 브라우저
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
      {!ready ? null : current === "keys" ? (
        <div className="flex flex-col gap-2">
          {adding && active.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className={cn("self-start px-1 text-[13px] font-semibold text-primary-text hover:underline", focus)}>
              ← 돌아가기
            </button>
          )}
          <KeyGate
            saved={known.filter((k) => !using.includes(k.account))}
            onConnect={connect}
            onNamed={(account, name) => setKeys((prev) => withName(prev, account, name))}
            action="보스 수익 보기"
            check={(key) => createApi(key).get("character/list", {})}
            savedHint="저장된 키 → 누르면 바로 (강화 기록에 저장한 키도 여기)"
            notes={["키 = 이 브라우저에만 저장, 우리 서버로 안 보냄", "키 하나 = 그 키를 만든 넥슨 계정 · 여러 개 등록하면 합쳐서 봄"]}
          />
        </div>
      ) : current === "pick" ? (
        <Picker accounts={views} chars={allChars} states={states} picked={shown} onPick={setShown} onDone={() => setView("board")} onAdd={() => setAdding(true)} onRemove={remove} onRetry={retryAccounts} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* A key whose character list did not come: its characters are missing from the board, so say so. */}
          {views
            .filter((v) => v.error)
            .map((v) => (
              <div key={v.account} role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-[13px] font-semibold text-destructive">
                <span>
                  {v.label} · {v.error}
                </span>
                <button type="button" onClick={retryAccounts} className={cn("h-8 shrink-0 rounded-lg px-2.5 font-bold hover:bg-destructive/10", focus)}>
                  다시
                </button>
              </div>
            ))}
          <Board chars={pickedChars} states={states} prev={prev} faces={faces} loadedAt={loadedAt} now={now} onRefresh={() => refresh(pickedChars)} />
        </div>
      )}
    </div>
  );
}
