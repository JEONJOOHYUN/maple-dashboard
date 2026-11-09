"use client";

import { useState } from "react";
import { eok, Label, LuckBox, NumberField, Panel, parseNum, ResultCard, Segment } from "@/components/ev/ui";
import { LUCK_LEVELS, percentileOf } from "@/lib/ev/luck";
import { DEFAULT_ETHER_EOK, SOUL_STAGES, soulPlan } from "@/lib/ev/soul";
import { cn } from "@/lib/utils";

const stageLabel = (i: number) => (i === 0 ? "강화 전" : `${i}단계`);

export function SoulTab() {
  const [now, setNow] = useState(0);
  const [goal, setGoal] = useState(4);
  const [failText, setFailText] = useState("0");
  const [ether, setEther] = useState(DEFAULT_ETHER_EOK.map(String));

  const target = Math.max(goal, now + 1);
  const fails = Math.min(SOUL_STAGES[now].cap, Math.floor(parseNum(failText, 0)));
  const prices = ether.map((t, i) => parseNum(t, DEFAULT_ETHER_EOK[i]));
  // Cheap enough to recompute on every render.
  const plan = soulPlan(now, target, fails, prices);
  const used = (i: number) => i >= now && i < target;
  const stage = SOUL_STAGES[now];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <div className="flex flex-col gap-0.5">
          <b className="text-[15px]">소울 증폭</b>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>지금 단계</Label>
          <Segment
            label="지금 단계"
            value={String(now)}
            onChange={(v) => {
              setNow(Number(v));
              setFailText("0");
            }}
            options={[0, 1, 2, 3].map((i) => ({ id: String(i), label: stageLabel(i) }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>목표 단계</Label>
          <Segment
            label="목표 단계"
            value={String(target)}
            onChange={(v) => Number(v) > now && setGoal(Number(v))}
            options={[1, 2, 3, 4].map((i) => ({ id: String(i), label: <span className={cn(i <= now && "opacity-40")}>{i}단계</span> }))}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <b className="text-[13px]">이미 실패한 횟수</b>
            <span className="text-[11px] text-muted-foreground">
              {stageLabel(now)}에서 도전 중 · 지금 {fails >= stage.cap ? 100 : Math.round(Math.min(1, stage.first + stage.step * fails) * 1000) / 10}% · {Math.max(0, stage.cap - fails)}번 더 실패하면 확정
            </span>
          </span>
          <NumberField label="이미 실패한 횟수" value={failText} onChange={setFailText} suffix="번" inputClassName="w-16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>에테르 시세 (1개, 억 메소)</Label>
          <div className="grid grid-cols-4 gap-2">
            {ether.map((t, i) => (
              <label key={i} className={cn("flex flex-col gap-1 text-[11px] text-muted-foreground", !used(i) && "opacity-45")}>
                {i + 1}단계
                <NumberField
                  label={`${i + 1}단계 에테르 시세`}
                  value={t}
                  decimal
                  onChange={(v) => setEther(ether.map((x, k) => (k === i ? v : x)))}
                  inputClassName="w-full"
                />
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <section className="flex min-w-0 flex-col gap-3">
        <ResultCard
          label={`${stageLabel(now)} → ${target}단계까지`}
          big={eok(plan.avgMeso)}
          unit="메소"
          side={`평균 ${(Math.round(plan.avgTries * 10) / 10).toLocaleString("ko-KR")}번`}
          foot={`에테르 평균 ${(Math.round(plan.avgTries * 10) / 10).toLocaleString("ko-KR")}개 + 강화비`}
        />
        <div className="grid grid-cols-3 gap-2">
          {LUCK_LEVELS.map((l) => {
            const n = percentileOf(plan.dist, l.q);
            return <LuckBox key={l.q} label={l.label} value={eok(plan.costAt(l.q))} sub={`${n}번`} />;
          })}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_84px_56px] gap-2 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>단계</span>
            <span className="text-right">처음 확률</span>
            <span className="text-right">천장</span>
            <span className="text-right">평균</span>
          </div>
          {SOUL_STAGES.map((s, i) => (
            <div key={i} className={cn("grid grid-cols-[minmax(0,1fr)_64px_84px_56px] items-center gap-2 border-t border-border px-4 py-2.5 text-[13px]", used(i) ? "bg-primary-soft" : "opacity-55")}>
              <span className="flex min-w-0 flex-col">
                <b>
                  {stageLabel(i)} → {i + 1}단계
                </b>
                <span className="text-[11px] text-muted-foreground">
                  실패마다 +{Math.round(s.step * 1000) / 10}%p · 강화비 {s.feeEok}억
                </span>
              </span>
              <span className="text-right font-num">{Math.round(s.first * 1000) / 10}%</span>
              <span className="text-right font-num text-muted-foreground">{s.cap}번 실패 후</span>
              <b className="text-right font-num">{plan.stages[i].avgTries.toFixed(1)}번</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
