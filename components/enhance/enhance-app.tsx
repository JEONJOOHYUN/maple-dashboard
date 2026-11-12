"use client";

import { useEffect, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Segment } from "@/components/ev/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KeyGate, type Connected } from "@/components/enhance/key-gate";
import { PotentialBoard } from "@/components/enhance/potential-board";
import { StarforceBoard } from "@/components/enhance/starforce-board";
import { PageHeader } from "@/components/page-header";
import { createApi, fetchMainCharacter, forgetPace } from "@/lib/enhance/client";
import { withKey, withName, withoutKey, type SavedKey } from "@/lib/enhance/keys";
import { clearAccount, clearEverything } from "@/lib/enhance/sync";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";

type Kind = "starforce" | "potential";

/**
 * 강화 기록: the visitor's own NEXON Open API key, kept in this browser only (localStorage when "기억" is on,
 * otherwise just this tab's memory). The key and the records never reach our server.
 * More than one key can be remembered (a second account, a friend's key): the records are stored apart by account,
 * so going back to a key does not fetch its days again.
 */
export function EnhanceApp() {
  // 0 until the browser has taken over: the saved key is not readable before that.
  const ready = useNow() > 0;
  // The key in use (remembered), every remembered key, and a key that is only held for this visit.
  const [saved, setSaved] = useStored<Connected | null>("enhance:key", null);
  const [keys, setKeys] = useStored<SavedKey[]>("enhance:keys", []);
  const [session, setSession] = useState<Connected | null>(null);
  const [kind, setKind] = useStored<Kind>("enhance:kind", "starforce");
  const active = saved ?? session;
  // A key remembered before there was a list belongs in it.
  const list = saved ? withKey(keys, saved) : keys;

  const connect = (value: Connected, remember: boolean) => {
    if (!remember) return setSession(value);
    setKeys((prev) => withKey(prev, value));
    setSaved(value);
  };
  /** Back to the key screen with everything kept: the key stays in the list and its records stay saved. */
  const change = () => {
    if (saved) setKeys((prev) => withKey(prev, saved));
    setSaved(null);
    setSession(null);
  };
  /** What this browser keeps for one key besides its records: the pace found for it and its MVP · PC room setting. */
  const dropSettings = (account: string) => {
    forgetPace(account);
    try {
      localStorage.removeItem(`enhance:discount:${account}`);
      localStorage.removeItem(`enhance:groupsSeen:${account}`);
    } catch {
      // nothing to remove
    }
  };
  const forget = () => {
    if (active) {
      void clearAccount(active.account);
      dropSettings(active.account);
      setKeys((prev) => withoutKey(prev, active.account));
    }
    setSaved(null);
    setSession(null);
  };
  const forgetAll = () => {
    void clearEverything();
    // Every key's settings by their names, not by the list: a key used with "기억" off is in no list.
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("enhance:pace:") || k.startsWith("enhance:discount:") || k.startsWith("enhance:groupsSeen:")) localStorage.removeItem(k);
    } catch {
      // nothing to remove
    }
    setKeys([]);
    setSaved(null);
    setSession(null);
  };
  // The list shows the account's main character (its highest level) instead of the key: asked once, for a
  // remembered key that has no name yet. A failure only leaves it as "저장된 키 n" until the next visit.
  const unnamed = saved && !list.find((k) => k.account === saved.account)?.name ? saved : null;
  const unnamedKey = unnamed?.key;
  const unnamedAccount = unnamed?.account;
  useEffect(() => {
    if (!unnamedKey || !unnamedAccount) return;
    const stop = new AbortController();
    fetchMainCharacter(createApi(unnamedKey, unnamedAccount), stop.signal)
      .then((who) => {
        if (who && !stop.signal.aborted) setKeys((prev) => withName(withKey(prev, { key: unnamedKey, account: unnamedAccount }), unnamedAccount, who));
      })
      .catch(() => {});
    return () => stop.abort();
  }, [unnamedKey, unnamedAccount, setKeys]);

  // Layout C (user, 2026-11-13): the switch sits in the board's tool row with the period and refresh; what is done
  // to the key (rarely) is in a menu next to the title.
  const switcher = (
    <Segment
      label="기록 종류"
      value={kind}
      onChange={setKind}
      options={[
        { id: "starforce", label: "스타포스" },
        { id: "potential", label: "잠재능력" },
      ]}
      className="w-[180px]"
    />
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]">
      <PageHeader
        title="강화 기록"
        description="스타포스 · 잠재능력 기록 · 기댓값보다 얼마나 이득 · 손해"
        pinAside
        aside={
          ready &&
          active && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="키 관리"
                className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-40">
                <DropdownMenuItem onClick={change}>키 바꾸기</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={forget}>
                  키 · 기록 지우기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      {!ready ? null : !active ? (
        <KeyGate saved={list} onConnect={connect} onForgetAll={forgetAll} />
      ) : kind === "potential" ? (
        <PotentialBoard key={active.account} apiKey={active.key} account={active.account} onForget={forget} switcher={switcher} />
      ) : (
        <StarforceBoard key={active.account} apiKey={active.key} account={active.account} onForget={forget} switcher={switcher} />
      )}
    </div>
  );
}
