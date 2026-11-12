"use client";

import { useState } from "react";
import { Segment } from "@/components/ev/ui";
import { KeyGate, type Connected } from "@/components/enhance/key-gate";
import { PotentialBoard } from "@/components/enhance/potential-board";
import { StarforceBoard } from "@/components/enhance/starforce-board";
import { PageHeader } from "@/components/page-header";
import { clearAccount } from "@/lib/enhance/sync";
import { useNow } from "@/lib/use-now";
import { useStored } from "@/lib/use-stored";

type Kind = "starforce" | "potential";

/**
 * 강화 기록: the visitor's own NEXON Open API key, kept in this browser only (localStorage when "기억" is on,
 * otherwise just this tab's memory). The key and the records never reach our server.
 */
export function EnhanceApp() {
  // 0 until the browser has taken over: the saved key is not readable before that.
  const ready = useNow() > 0;
  const [saved, setSaved] = useStored<Connected | null>("enhance:key", null);
  const [session, setSession] = useState<Connected | null>(null);
  const [kind, setKind] = useStored<Kind>("enhance:kind", "starforce");
  const active = saved ?? session;

  const forget = () => {
    if (active) void clearAccount(active.account);
    setSaved(null);
    setSession(null);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-[22px]">
      <PageHeader
        title="강화 기록"
        description="스타포스 · 잠재능력 기록 · 기댓값보다 얼마나 이득 · 손해"
        aside={
          ready &&
          active && (
            <Segment
              label="기록 종류"
              value={kind}
              onChange={setKind}
              options={[
                { id: "starforce", label: "스타포스" },
                { id: "potential", label: "잠재능력" },
              ]}
              className="w-[200px]"
            />
          )
        }
      />
      {!ready ? null : !active ? (
        <KeyGate onConnect={(value, remember) => (remember ? setSaved(value) : setSession(value))} />
      ) : kind === "potential" ? (
        <PotentialBoard key={active.account} apiKey={active.key} account={active.account} onForget={forget} />
      ) : (
        <StarforceBoard key={active.account} apiKey={active.key} account={active.account} onForget={forget} />
      )}
    </div>
  );
}
