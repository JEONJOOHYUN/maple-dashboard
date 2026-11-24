"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCharacters } from "@/app/homework/actions";
import { CharCard, GoButton, NameSearch, Tabs, charGrid, headBtn } from "@/components/revenue/pick-parts";
import { ACCOUNT_COLORS, focus } from "@/components/revenue/styles";
import type { PickData } from "@/lib/homework/server";
import { useStored } from "@/lib/use-stored";
import { cn } from "@/lib/utils";

/**
 * Whose homework the page shows: every character of the member's accounts, the ones on show already picked. The
 * same pieces as boss revenue's picker. Saved in this browser when the member is done.
 */
export function Picker({ data, onDone }: { data: PickData; onDone: () => void }) {
  const [picked, setPicked] = useState(data.picked);
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState("all");
  const [world, setWorld] = useState("all");
  const [saving, startSaving] = useTransition();
  // What boss revenue follows in this browser: one press picks the same characters here.
  const [revenue] = useStored<string[]>("revenue:picked", []);

  const several = data.accounts.length > 1;
  // The ones on show when the picker opened come first and stay there: nothing jumps while picking.
  const all = useMemo(() => {
    const first = new Set(data.picked);
    const rows = data.accounts.flatMap((a, i) => a.chars.map((c) => ({ ...c, account: String(a.id), color: several ? ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] : undefined })));
    return [...rows.filter((c) => first.has(c.ocid)), ...rows.filter((c) => !first.has(c.ocid))];
  }, [data, several]);
  const worlds = useMemo(() => [...new Set(all.map((c) => c.world))], [all]);
  const set = new Set(picked);
  const word = q.trim();
  const shown = all.filter((c) => (acc === "all" || c.account === acc) && (world === "all" || c.world === world) && (!word || c.name.includes(word)));
  const full = set.size >= data.max;
  // More than the limit can come in from the automatic choice of many accounts: it has to come down before saving.
  const over = picked.length - data.max;
  const blocked = data.missing > 0 ? `계정 ${data.missing}개의 캐릭터를 못 받음 → 새로 고침 뒤 다시` : over > 0 ? `${over}명 더 빼야 저장` : "";
  const toggle = (ocid: string) => setPicked(set.has(ocid) ? picked.filter((x) => x !== ocid) : [...picked, ocid]);
  const fromRevenue = useMemo(() => {
    const mine = new Set(all.map((c) => c.ocid));
    return revenue.filter((o) => mine.has(o)).slice(0, data.max);
  }, [revenue, all, data.max]);
  const sameAsRevenue = fromRevenue.length === picked.length && fromRevenue.every((o) => set.has(o));

  return (
    // Nothing can be picked while the pick is being saved: a late press would be lost.
    <div className="flex flex-col gap-2" inert={saving}>
      <section className="flex flex-col gap-3 tile px-[18px] py-4">
        {/* What is picked and the way out, first: the list under it can be a hundred characters long. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <b>숙제 볼 캐릭터 고르기</b>
            <p className="text-[13px] text-muted-foreground">
              <b className="font-num text-foreground">{picked.length}</b>명 고름 · {picked.length === 0 ? "안 고르면 계정마다 레벨 높은 12명" : `최대 ${data.max}명 · 이 브라우저에 저장`}
            </p>
            {blocked && (
              <p role="alert" className="text-[13px] font-semibold text-destructive">
                {blocked}
              </p>
            )}
          </div>
          {/* On a phone the two take the whole line, the way out that saves being the wide one. */}
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <button type="button" onClick={onDone} disabled={saving} className={cn("h-11 rounded-[10px] px-3.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50", focus)}>
              취소
            </button>
            <GoButton
              busy={saving}
              disabled={saving || !!blocked}
              onClick={() =>
                startSaving(async () => {
                  await saveCharacters(picked);
                  onDone();
                })
              }
              className="flex-1 justify-center sm:flex-none"
            >
              숙제 현황 보기
            </GoButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NameSearch value={q} onChange={setQ} />
          {several && <Tabs label="계정" value={acc} onChange={setAcc} items={[{ id: "all", label: "모든 계정" }, ...data.accounts.map((a, i) => ({ id: String(a.id), label: a.name || `넥슨 계정 ${i + 1}` }))]} />}
        </div>
        {/* An account can have characters in a dozen worlds: the tabs wrap inside the tile. */}
        {worlds.length > 1 && <Tabs label="월드" value={world} onChange={setWorld} items={[{ id: "all", label: "전체" }, ...worlds.map((w) => ({ id: w, label: w }))]} />}
      </section>

      <section className="tile p-4">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-2 px-1.5 pb-2.5">
          <b className="text-[15px]">
            캐릭터 <span className="font-num text-muted-foreground">{shown.length}</span>
          </b>
          <div className="flex items-center gap-1">
            {fromRevenue.length > 0 && !sameAsRevenue && (
              <button type="button" onClick={() => setPicked(fromRevenue)} className={headBtn}>
                보스 수익과 같게
              </button>
            )}
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])} className={headBtn}>
                모두 빼기
              </button>
            )}
          </div>
        </div>
        <div className={charGrid}>
          {shown.map((c) => (
            <CharCard key={c.ocid} c={c} on={set.has(c.ocid)} color={c.color} onToggle={() => toggle(c.ocid)} disabled={full} />
          ))}
        </div>
        {shown.length === 0 && <p className="px-1.5 text-[13px] text-muted-foreground">맞는 캐릭터 없음</p>}
      </section>
    </div>
  );
}
