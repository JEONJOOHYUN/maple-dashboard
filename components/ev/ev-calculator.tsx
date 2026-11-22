"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AbilityTab } from "@/components/ev/ability-tab";
import { FlameTab } from "@/components/ev/flame-tab";
import { PotentialTab } from "@/components/ev/potential-tab";
import { SoulTab } from "@/components/ev/soul-tab";
import { StarforceTab } from "@/components/ev/starforce-tab";
import type { ClassAbility } from "@/lib/ev/ability-classes";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "starforce", label: "스타포스" },
  { id: "potential", label: "잠재능력" },
  { id: "flame", label: "추가옵션" },
  { id: "soul", label: "소울" },
  { id: "ability", label: "어빌리티" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function EvCalculator({ abilityClasses }: { abilityClasses: ClassAbility[] }) {
  const [tab, setTab] = useState<TabId>("starforce");

  return (
    <div className="flex flex-col gap-2">
      {/* One description for every tab so switching tabs never moves the tab row. */}
      <PageHeader title="기댓값 계산기" description="목표까지 평균 메소 · 횟수 (넥슨 공식 확률)" />
      <div role="tablist" aria-label="계산 종류" className="grid grid-cols-5 gap-0.5 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ev-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="ev-panel"
            onClick={() => setTab(t.id)}
            title={t.label}
            className={cn(
              "h-10 min-w-0 truncate rounded-lg text-[13px] transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] sm:text-sm",
              // The transparent border is the tab's edge where shadows are not drawn (forced colours); it takes its 1px
              // from the padding.
              tab === t.id ? "border border-transparent bg-card px-[3px] font-bold text-primary-text shadow-tile" : "px-1 text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="ev-panel" role="tabpanel" aria-labelledby={`ev-tab-${tab}`}>
        {tab === "starforce" && <StarforceTab />}
        {tab === "potential" && <PotentialTab />}
        {tab === "flame" && <FlameTab />}
        {tab === "soul" && <SoulTab />}
        {tab === "ability" && <AbilityTab classes={abilityClasses} />}
      </div>
    </div>
  );
}
