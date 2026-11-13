"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Chip, Label, NumberField, Panel, Segment, count, eok, parseNum, pct } from "@/components/ev/ui";
import { FLAMES, armorChance, bestWeaponGrade, hpScore, hpTarget, tierValues, weaponChance, xenonChips, DEFAULT_HP_WEIGHTS, DEFAULT_WEIGHTS, DEFAULT_XENON_WEIGHTS, type FlameJob } from "@/lib/ev/flame";
import { averageTries, triesAt } from "@/lib/ev/luck";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";

export function FlameTab() {
  const [equip, setEquip] = useState<"weapon" | "armor">("weapon");
  const [levelText, setLevelText] = useState("200");
  const [grade, setGrade] = useState(1);
  const [extraText, setExtraText] = useState("0");
  const [job, setJob] = useState<FlameJob>("stat");
  const [targetText, setTargetText] = useState("120");
  // Xenon: which chip is picked (null = a goal typed in). The chips follow the item level, and so does the goal.
  const [xenonChip, setXenonChip] = useState<number | null>(1);
  // Demon Avenger: the goal is said as "HP n추 + 공 m" and reached through the conversion below (user, 2026-11-13).
  const [hpGrade, setHpGrade] = useState(1);
  const [hpAtkText, setHpAtkText] = useState("0");
  // Price per try (억 메소): reset is fixed at 300만, abyss flame defaults to 5,000만 and can be changed.
  const [abyssText, setAbyssText] = useState("0.5");
  // 강력한 환생의 불꽃 has no meso price in game (event / cash); counted only when a price is typed.
  const [strongText, setStrongText] = useState("");
  // Conversion: what is on the item now, and the weights.
  // Xenon example = 커맨더 포스 이어링 of the character 제논 (STR · DEX · LUK 66 each, all stat 7 %; NEXON Open API 2026-11-12).
  const [now, setNow] = useState({ main: "64", sub: "40", atk: "5", all: "3", hp: "4200", hAtk: "6", hStr: "0", xStr: "66", xDex: "66", xLuk: "66", xAtk: "0", xAll: "7" });
  const [w, setW] = useState({ sub: String(DEFAULT_WEIGHTS.sub), attack: String(DEFAULT_WEIGHTS.attack), allStat: String(DEFAULT_WEIGHTS.allStat) });
  const [hw, setHw] = useState({ attack: String(DEFAULT_HP_WEIGHTS.attack), str: String(DEFAULT_HP_WEIGHTS.str) });
  const [xw, setXw] = useState({ attack: String(DEFAULT_XENON_WEIGHTS.attack), allStat: String(DEFAULT_XENON_WEIGHTS.allStat) });
  // Closed at first, like the potential tab's "환산 기준" (user, 2026-11-13).
  const [convOpen, setConvOpen] = useState(false);

  const level = Math.max(1, Math.round(parseNum(levelText, 200)));
  const extra = parseNum(extraText, 0);
  const chips = useMemo(() => (job === "xenon" ? xenonChips(level) : [100, 120, 140, 160]), [job, level]);
  const pickedChip = job === "xenon" && xenonChip !== null ? chips[xenonChip] : null;
  const target = pickedChip ?? parseNum(targetText, 0);
  const weights = { sub: parseNum(w.sub, 10) || 10, attack: parseNum(w.attack, 4), allStat: parseNum(w.allStat, 10) };
  const hpWeights = { attack: parseNum(hw.attack, DEFAULT_HP_WEIGHTS.attack), str: parseNum(hw.str, DEFAULT_HP_WEIGHTS.str) };
  const hpAtk = Math.max(0, parseNum(hpAtkText, 0));
  /** Max HP at "n추" on this level (Lv.200: 1추 4,200 · 2추 3,600 · 3추 3,000). */
  const hpAt = (n: number) => tierValues(level).hp * (8 - n);
  const hpNeed = hpTarget(level, hpGrade, hpAtk, hpWeights);
  const xenonWeights = { attack: parseNum(xw.attack, DEFAULT_XENON_WEIGHTS.attack), allStat: parseNum(xw.allStat, DEFAULT_XENON_WEIGHTS.allStat) };

  const rows = useMemo(
    () =>
      FLAMES.map((f) => ({
        ...f,
        p:
          equip === "weapon"
            ? weaponChance(f.id, grade, extra, level)
            : job === "hp"
              ? armorChance(f.id, level, hpNeed, job, weights, hpWeights, xenonWeights)
              : armorChance(f.id, level, target, job, weights, hpWeights, xenonWeights),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equip, grade, extra, level, target, job, hpNeed, weights.sub, weights.attack, weights.allStat, hpWeights.attack, hpWeights.str, xenonWeights.attack, xenonWeights.allStat]
  );
  const priceOf = (id: string) =>
    id === "eternal" ? 3_000_000 : id === "abyss" ? parseNum(abyssText, 0) * 1e8 : id === "strong" ? parseNum(strongText, 0) * 1e8 : 0;
  const mesoOf = (r: { id: string; p: number }) => (r.p > 0 && priceOf(r.id) > 0 ? averageTries(r.p) * priceOf(r.id) : Infinity);
  // Recommend the one that costs the least meso on average; without any price, the one that needs the fewest.
  const able = rows.filter((r) => r.p > 0);
  const priced = able.filter((r) => Number.isFinite(mesoOf(r)));
  const best = priced.length
    ? priced.reduce((a, b) => (mesoOf(b) < mesoOf(a) ? b : a))
    : able.length
      ? able.reduce((a, b) => (b.p > a.p ? b : a))
      : null;
  const bestMeso = best ? mesoOf(best) : Infinity;
  const nowScore =
    job === "hp"
      ? hpScore(parseNum(now.hp), parseNum(now.hAtk), parseNum(now.hStr), hpWeights)
      : job === "xenon"
        ? parseNum(now.xStr) + parseNum(now.xDex) + parseNum(now.xLuk) + parseNum(now.xAtk) * xenonWeights.attack + parseNum(now.xAll) * xenonWeights.allStat
        : parseNum(now.main) + parseNum(now.sub) / weights.sub + parseNum(now.atk) * weights.attack + parseNum(now.all) * weights.allStat;
  const unit = job === "hp" ? " HP" : "급";
  // The conversion of the job in view: is it still the default, and back to it.
  const convChanged =
    job === "hp"
      ? hpWeights.attack !== DEFAULT_HP_WEIGHTS.attack || hpWeights.str !== DEFAULT_HP_WEIGHTS.str
      : job === "xenon"
        ? xenonWeights.attack !== DEFAULT_XENON_WEIGHTS.attack || xenonWeights.allStat !== DEFAULT_XENON_WEIGHTS.allStat
        : weights.sub !== DEFAULT_WEIGHTS.sub || weights.attack !== DEFAULT_WEIGHTS.attack || weights.allStat !== DEFAULT_WEIGHTS.allStat;
  const resetConv = () => {
    if (job === "hp") setHw({ attack: String(DEFAULT_HP_WEIGHTS.attack), str: String(DEFAULT_HP_WEIGHTS.str) });
    else if (job === "xenon") setXw({ attack: String(DEFAULT_XENON_WEIGHTS.attack), allStat: String(DEFAULT_XENON_WEIGHTS.allStat) });
    else setW({ sub: String(DEFAULT_WEIGHTS.sub), attack: String(DEFAULT_WEIGHTS.attack), allStat: String(DEFAULT_WEIGHTS.allStat) });
  };
  const hpGoal = `HP ${hpGrade}추${hpAtk > 0 ? ` + 공 ${hpAtk}` : ""}`;
  const goalText = equip === "weapon" ? `${grade}추 + ${extra}%급 이상` : job === "hp" ? `${hpGoal} 이상` : `${target}급 이상`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <Segment
          label="장비 종류"
          value={equip}
          onChange={setEquip}
          options={[
            { id: "weapon", label: "무기" },
            { id: "armor", label: "방어구 · 장신구" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
            장비 레벨
            <NumberField label="장비 레벨" value={levelText} onChange={setLevelText} inputClassName="w-16" />
          </span>
        </div>

        {equip === "weapon" ? (
          <div className="flex flex-col gap-2.5">
            <Label>목표 = 공격력(마력) 단계 + 보스 데미지 · 데미지 합</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} on={grade === n} onClick={() => setGrade(n)} className="px-0">
                  {n}추
                </Chip>
              ))}
            </div>
            <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
              {grade}추 +
              <NumberField label="보스 데미지 + 데미지 %" value={extraText} onChange={setExtraText} inputClassName="w-16" />
              %급 이상
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 5, 10, 15, 20].map((n) => (
                <Chip key={n} on={extra === n} onClick={() => setExtraText(String(n))} className="px-0">
                  +{n}%
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2.5">
            <Label
              aside={
                <Segment
                  label="직업 기준"
                  value={job}
                  onChange={(j) => {
                    setJob(j);
                    if (j === "xenon") setXenonChip(1);
                    else if (j === "stat") setTargetText("120");
                  }}
                  options={[
                    { id: "stat", label: "주스탯 직업" },
                    { id: "xenon", label: "제논" },
                    { id: "hp", label: "데몬어벤져" },
                  ]}
                  className="w-64"
                />
              }
            >
              {job === "hp" ? "목표 (환산 HP)" : "목표 (환산 급)"}
            </Label>
            {/* The same order for every job (user, 2026-11-13): the goal in a line, the chips to pick it with, then
                the conversion below. */}
            {job === "hp" ? (
              <>
                <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                  HP {hpAt(hpGrade).toLocaleString("ko-KR")} + 공
                  <NumberField label="공격력" value={hpAtkText} onChange={setHpAtkText} inputClassName="w-14" />
                  이상
                  <span className="font-normal text-muted-foreground">= 환산 {Math.round(hpNeed).toLocaleString("ko-KR")}</span>
                </span>
                {/* The two picks sit together, best first in both (공 7 under 1추); the chosen 공 comes off on a
                    second press = HP alone. */}
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Chip key={n} on={hpGrade === n} onClick={() => setHpGrade(n)} className="px-0">
                        {n}추
                      </Chip>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[7, 6, 5, 4, 3].map((n) => (
                      <Chip key={n} on={hpAtk === n} onClick={() => setHpAtkText(hpAtk === n ? "0" : String(n))} className="px-0">
                        공 {n}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <NumberField
                    label="목표"
                    value={pickedChip !== null ? String(pickedChip) : targetText}
                    onChange={(t) => {
                      setTargetText(t);
                      setXenonChip(null);
                    }}
                    inputClassName="w-20"
                  />
                  급 이상
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {chips.map((n, i) => (
                    <Chip
                      key={n}
                      on={target === n}
                      onClick={() => {
                        setTargetText(String(n));
                        setXenonChip(job === "xenon" ? i : null);
                      }}
                      className="px-0"
                    >
                      {n}급
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {/* At the foot of the panel: the same place for the three jobs, whichever has more chips (user, 2026-11-13). */}
            <div className="mt-auto flex flex-col gap-2 rounded-md border border-border bg-card p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setConvOpen((o) => !o)} aria-expanded={convOpen} className="flex items-center gap-1 text-[12px] font-bold">
                  <ChevronDown className={cn("size-3.5 transition-transform", !convOpen && "-rotate-90")} aria-hidden="true" />
                  지금 내 추옵 환산
                  {!convOpen && <span className="font-normal text-muted-foreground">· {convChanged ? "바꾼 값 사용 중" : "기본값"}</span>}
                </button>
                {convOpen && <b className="font-num text-sm text-primary-text">{Math.round(nowScore).toLocaleString("ko-KR")}{unit}</b>}
              </div>
              {convOpen && (
              <>
              <div className="grid grid-cols-[minmax(0,1fr)_80px_90px] items-center gap-x-2 gap-y-1.5 text-[13px]">
                <span className="text-[11px] text-muted-foreground">추옵</span>
                <span className="text-right text-[11px] text-muted-foreground">붙은 값</span>
                <span className="text-right text-[11px] text-muted-foreground">환산 기준</span>
                {job === "hp" ? (
                  <>
                    <b>최대 HP</b>
                    <NumberField label="최대 HP 값" value={now.hp} onChange={(t) => setNow({ ...now, hp: t })} inputClassName="w-full" />
                    <span className="text-right text-xs text-muted-foreground">× 1</span>
                    <b>공격력</b>
                    <NumberField label="공격력 값" value={now.hAtk} onChange={(t) => setNow({ ...now, hAtk: t })} inputClassName="w-full" />
                    <NumberField label="공격력 1 = HP" value={hw.attack} onChange={(t) => setHw({ ...hw, attack: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                    <b>STR</b>
                    <NumberField label="STR 값" value={now.hStr} onChange={(t) => setNow({ ...now, hStr: t })} inputClassName="w-full" />
                    <NumberField label="STR 1 = HP" value={hw.str} onChange={(t) => setHw({ ...hw, str: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                  </>
                ) : job === "xenon" ? (
                  <>
                    {(
                      [
                        ["xStr", "STR"],
                        ["xDex", "DEX"],
                        ["xLuk", "LUK"],
                      ] as const
                    ).map(([k, name]) => (
                      <Fragment key={k}>
                        <b>{name}</b>
                        <NumberField label={`${name} 값`} value={now[k]} onChange={(t) => setNow({ ...now, [k]: t })} inputClassName="w-full" />
                        <span className="text-right text-xs text-muted-foreground">× 1</span>
                      </Fragment>
                    ))}
                    <b>공격력</b>
                    <NumberField label="공격력 값" value={now.xAtk} onChange={(t) => setNow({ ...now, xAtk: t })} inputClassName="w-full" />
                    <NumberField label="공격력 1 = 스탯" value={xw.attack} onChange={(t) => setXw({ ...xw, attack: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                    <b>올스탯 %</b>
                    <NumberField label="올스탯 % 값" value={now.xAll} onChange={(t) => setNow({ ...now, xAll: t })} inputClassName="w-full" />
                    <NumberField label="올스탯 1% = 스탯" value={xw.allStat} onChange={(t) => setXw({ ...xw, allStat: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                  </>
                ) : (
                  <>
                    <b>주스탯</b>
                    <NumberField label="주스탯 값" value={now.main} onChange={(t) => setNow({ ...now, main: t })} inputClassName="w-full" />
                    <span className="text-right text-xs text-muted-foreground">× 1</span>
                    <b>부스탯 <span className="text-[11px] font-normal text-muted-foreground">÷</span></b>
                    <NumberField label="부스탯 값" value={now.sub} onChange={(t) => setNow({ ...now, sub: t })} inputClassName="w-full" />
                    <NumberField label="부스탯 몇 = 주스탯 1" value={w.sub} onChange={(t) => setW({ ...w, sub: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                    <b>공격력 · 마력</b>
                    <NumberField label="공격력 값" value={now.atk} onChange={(t) => setNow({ ...now, atk: t })} inputClassName="w-full" />
                    <NumberField label="공격력 1 = 주스탯" value={w.attack} onChange={(t) => setW({ ...w, attack: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                    <b>올스탯 %</b>
                    <NumberField label="올스탯 % 값" value={now.all} onChange={(t) => setNow({ ...now, all: t })} inputClassName="w-full" />
                    <NumberField label="올스탯 1% = 주스탯" value={w.allStat} onChange={(t) => setW({ ...w, allStat: t })} decimal className="justify-end" inputClassName="w-full border-primary/60" />
                  </>
                )}
              </div>
              <span className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                <button type="button" onClick={resetConv} className="rounded border border-border px-2 py-0.5">
                  기본값으로
                </button>
              </span>
              </>
              )}
            </div>
          </div>
        )}
      </Panel>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-lg bg-primary px-5 py-4 text-primary-foreground">
          <span className="text-[13px] font-semibold">{goalText} · {Number.isFinite(bestMeso) ? "가장 싸게" : "가장 적게"}</span>
          {best ? (
            <>
              <span className="flex flex-wrap items-baseline gap-x-3">
                {Number.isFinite(bestMeso) ? (
                  <span className="font-num text-[40px] leading-none font-bold">
                    {eok(bestMeso)}
                    <span className="ml-1 text-base">메소</span>
                  </span>
                ) : (
                  <span className="font-num text-[40px] leading-none font-bold">
                    {count(averageTries(best.p), "")}
                    <span className="ml-1 text-base">개</span>
                  </span>
                )}
                <b>
                  {best.name} · 평균 {count(averageTries(best.p), "개")}
                </b>
              </span>
              <span className="text-xs font-semibold opacity-85">
                {[0.1, 0.5, 0.9]
                  .map((q, i) => {
                    const n = triesAt(best.p, q);
                    const label = ["운 좋으면", "절반은", "운 나쁘면"][i];
                    return Number.isFinite(bestMeso) ? `${label} ${eok(n * priceOf(best.id))}` : `${label} ${koreanUnits(n)}개`;
                  })
                  .join(" · ")}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold">불꽃으로 불가 · 목표 낮추기</span>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_64px_84px] gap-2 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>불꽃</span>
            <span className="text-right">1개로 될 확률</span>
            <span className="text-right">평균 개수</span>
            <span className="text-right">평균 메소</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_72px_64px_84px] items-center gap-2 border-t border-border px-4 py-2.5 text-[13px]",
                r === best && "bg-primary-soft",
                !r.p && "opacity-55"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <b className="truncate">{r.name}</b>
                <span className="text-[11px] text-muted-foreground">
                  {equip === "weapon" ? `최고 ${bestWeaponGrade(r.id)}추까지` : "추옵 재설정"}
                  {r.id === "eternal" && " · 1번 300만 메소"}
                </span>
                {(r.id === "abyss" || r.id === "strong") && (
                  <span className="mt-1 inline-flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="whitespace-nowrap">1개 가격</span>
                    <NumberField
                      label={`${r.name} 1개 가격 (억 메소)`}
                      value={r.id === "abyss" ? abyssText : strongText}
                      onChange={r.id === "abyss" ? setAbyssText : setStrongText}
                      decimal
                      suffix="억"
                      inputClassName="h-7 w-14 text-xs"
                    />
                  </span>
                )}
              </span>
              <span className="text-right font-num">{pct(r.p)}</span>
              <span className="text-right font-num">{r.p ? count(1 / r.p, "개") : "—"}</span>
              <b className={cn("text-right font-num", r === best && Number.isFinite(bestMeso) && "text-primary-text")}>
                {Number.isFinite(mesoOf(r)) ? eok(mesoOf(r)) : r.p ? "가격 필요" : "—"}
              </b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
