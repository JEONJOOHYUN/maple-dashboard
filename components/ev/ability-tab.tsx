"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Chip,
  Label,
  NumberField,
  Panel,
  Segment,
  Switch,
  count,
  eok,
  parseNum,
} from "@/components/ev/ui";
import {
  ABILITY_OPTIONS,
  ABILITY_PRESETS,
  ABILITY_VALUES,
  abilityPlan,
  legendaryOnly,
  valueChoices,
  type AbilityKey,
  type AbilityMode,
  type AbilityPlan,
  type Method,
  type PlanAction,
} from "@/lib/ev/ability";
import { CREDIT_SHOP } from "@/lib/ev/defaults";
import { cn } from "@/lib/utils";

const fameText = (f: number) =>
  f >= 1e4
    ? `${Math.round(f / 1e4).toLocaleString("ko-KR")}만`
    : Math.round(f).toLocaleString("ko-KR");

export function AbilityTab() {
  const [presetId, setPresetId] = useState("pbs");
  const [mode, setMode] = useState<AbilityMode>("l3");
  const [sunday, setSunday] = useState(false);
  const [haveText, setHaveText] = useState("");
  const [fame5kText, setFame5kText] = useState("200");
  // Wanted value per option and grade; missing = the highest value.
  const [goals, setGoals] = useState<Record<string, number>>({});
  // Step 3: the option that actually showed up on line 2 / 3 (null = show every case).
  // Cleared when the preset or mode changes (another combination is another item).
  const [seen, setSeen] = useState<AbilityKey | null>(null);
  // Step 4: the second option that showed up after step 3. Kept with the plan it was picked on: any input that
  // changes the plan (goals, prices, Sunday) can change how step 3 was handled, so the pick no longer holds (Codex review).
  const [seen2Sel, setSeen2Sel] = useState<{
    plan: AbilityPlan;
    key: AbilityKey;
  } | null>(null);
  // Abyss circulator price (억), same default as the MVP credit shop.
  const [circText, setCircText] = useState(
    String(CREDIT_SHOP.find((x) => x.id === "circulator")?.auctionEok ?? ""),
  );

  const preset = ABILITY_PRESETS.find((p) => p.id === presetId)!;
  // L1+U2: the legendary line is the legendary-only option if there is one, else the first of the preset.
  const lead = Math.max(
    0,
    preset.keys.findIndex((k) => legendaryOnly(k)),
  );
  const famePerUnit = (parseNum(fame5kText, 0) * 1e4) / 5000;
  const unitOf = (k: AbilityKey) => ABILITY_VALUES[k].unit;
  const have = parseNum(haveText, 0);

  // Line order shown: in L1+U2 the legendary-only option has to be the first line.
  const order =
    mode === "l1u2"
      ? [preset.keys[lead], ...preset.keys.filter((_, i) => i !== lead)]
      : preset.keys;
  const gradeOf = (i: number) =>
    (mode === "l3" || i === 0 ? "legendary" : "unique") as
      "legendary" | "unique";
  const goalOf = (k: AbilityKey, g: "legendary" | "unique") =>
    goals[`${k}:${g}`] ?? Math.max(...valueChoices(k, g));
  const circPrice = parseNum(circText, 0) * 1e8;
  // Options, values and circulators planned together (when to lock, when to circulate).
  const plan = useMemo(
    () =>
      abilityPlan(
        presetKeys(presetId),
        mode,
        {
          sunday,
          famePricePerUnit: famePerUnit,
          values: {
            goal: (k, g) =>
              goals[`${k}:${g}`] ?? Math.max(...valueChoices(k, g)),
            circPrice,
          },
        },
        lead,
      ),
    [presetId, mode, sunday, famePerUnit, lead, goals, circPrice],
  );
  const other = useMemo(
    () =>
      abilityPlan(
        presetKeys(presetId),
        mode === "l3" ? "l1u2" : "l3",
        {
          sunday,
          famePricePerUnit: famePerUnit,
          values: {
            goal: (k, g) =>
              goals[`${k}:${g}`] ?? Math.max(...valueChoices(k, g)),
            circPrice,
          },
        },
        lead,
      ),
    [presetId, mode, sunday, famePerUnit, lead, goals, circPrice],
  );
  const seen2 = seen2Sel?.plan === plan ? seen2Sel.key : null;
  const pickSeen = (k: AbilityKey | null) => {
    setSeen(k);
    setSeen2Sel(null);
  };
  const choosePreset = (id: string) => {
    setPresetId(id);
    pickSeen(null);
  };
  const chooseMode = (m: AbilityMode) => {
    setMode(m);
    pickSeen(null);
  };
  const pickSeen2 = (k: AbilityKey | null) =>
    setSeen2Sel(k ? { plan, key: k } : null);
  type Cost = { fame: number; meso: number; circ: number };
  const total = (p: Cost) =>
    famePerUnit > 0 ? p.fame * famePerUnit + p.meso + p.circ * circPrice : null;
  const costText = (p: Cost) =>
    total(p) !== null
      ? `약 ${eok(total(p)!)}`
      : `${fameText(p.fame)}${p.meso > 0 ? ` + ${eok(p.meso)}` : ""}`;
  const circN = (n: number) =>
    `${(Math.round(n * 10) / 10).toLocaleString("ko-KR")}개`;
  /** Short "→" chain. two = the second option (both found lines are handled together). */
  const actionText = (a: PlanAction, two: boolean) =>
    a.kind === "keep"
      ? "그대로 계속"
      : a.kind === "lock"
        ? `잠금 → ${METHOD_NAME[a.method]}`
        : `서큘레이터로 ${two ? "두 줄 " : ""}목표 수치 → 잠금 → ${METHOD_NAME[a.method]}`;
  // Same move for every row → say it once in the step title.
  const sameAction = (list: { action: PlanAction }[]) =>
    list.every(
      (x) =>
        x.action.kind === list[0].action.kind &&
        x.action.method === list[0].action.method,
    );
  const firstSame = sameAction(plan.afterFirst);
  // Cheapest first; step 4 follows what the user picked in step 3.
  const costNum = (p: Cost) => total(p) ?? p.fame;
  const lowerRows = [...plan.afterFirstLower].sort(
    (a, b) => costNum(a) - costNum(b),
  );
  const picked = seen && lowerRows.some((r) => r.key === seen) ? seen : null;
  const twoRows = plan.afterTwo
    .filter((r) => !picked || r.keys[0] === picked)
    .sort((a, b) => costNum(a) - costNum(b));
  const pickedRow = picked ? lowerRows.find((r) => r.key === picked)! : null;
  // Step 4 chips only make sense once step 3 is picked (they list what can follow it).
  const pickedTwo =
    picked && seen2 ? (twoRows.find((r) => r.keys[1] === seen2) ?? null) : null;
  const view = pickedTwo ?? pickedRow ?? plan;
  const circMeso = view.circ * circPrice;
  const lowerSame = lowerRows.length > 0 && sameAction(lowerRows);
  const twoSame = twoRows.length > 0 && sameAction(twoRows);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <Label>자주 노리는 조합</Label>
        <div className="flex flex-wrap gap-1.5">
          {ABILITY_PRESETS.map((p) => (
            <Chip
              key={p.id}
              on={p.id === presetId}
              onClick={() => choosePreset(p.id)}
              title={p.keys.map((k) => ABILITY_OPTIONS[k].label).join(" · ")}
              className="rounded-full"
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <Label
          aside={
            <Segment
              label="노리는 등급"
              value={mode}
              onChange={chooseMode}
              options={[
                { id: "l3", label: "레전드리 3줄" },
                { id: "l1u2", label: "레 1 + 유 2" },
              ]}
              className="w-56"
            />
          }
        >
          목표 세 줄
        </Label>
        <div className="flex flex-col gap-1.5">
          {order.map((k, i) => {
            const legend = mode === "l3" || i === 0;
            return (
              <div
                key={k}
                className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2"
              >
                <span
                  title={legend ? "레전드리" : "유니크 이상"}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md font-num text-xs font-bold",
                    legend
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
                  )}
                >
                  {legend ? "L" : "U"}
                </span>
                <span className="flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background pr-1 pl-3 text-[13px]">
                  <span className="truncate">{ABILITY_OPTIONS[k].label}</span>
                  {valueChoices(k, gradeOf(i)).length > 1 ? (
                    <select
                      aria-label={`${ABILITY_OPTIONS[k].label} 목표 수치`}
                      value={goalOf(k, gradeOf(i))}
                      onChange={(e) =>
                        setGoals({
                          ...goals,
                          [`${k}:${gradeOf(i)}`]: Number(e.target.value),
                        })
                      }
                      className="h-7 rounded-md border border-input bg-card px-1.5 font-num text-xs"
                    >
                      {valueChoices(k, gradeOf(i)).map((v) => (
                        <option key={v} value={v}>
                          +{v}
                          {unitOf(k)} 이상
                        </option>
                      ))}
                    </select>
                  ) : (
                    <b className="px-2 font-num text-xs">
                      +{valueChoices(k, gradeOf(i))[0] ?? "-"}
                      {unitOf(k)}
                    </b>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            가진 명성치
            <NumberField
              label="가진 명성치"
              value={haveText}
              onChange={setHaveText}
              inputClassName="w-full"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            명성치 5,000당
            <NumberField
              label="명성치 5,000당 가격 (만 메소)"
              value={fame5kText}
              onChange={setFame5kText}
              decimal
              suffix="만"
              inputClassName="w-full"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            심연의 서큘레이터 1개 (억)
            <NumberField
              label="심연의 서큘레이터 1개 가격 (억 메소)"
              value={circText}
              onChange={setCircText}
              decimal
              inputClassName="w-full"
            />
          </label>
        </div>
        <Switch
          on={sunday}
          onChange={setSunday}
          label="썬데이 명성치 50% 할인"
          note="명성치 절반"
        />
      </Panel>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-lg bg-primary px-5 py-4 text-primary-foreground">
          <span className="text-[13px] font-semibold">
            {preset.label} ·{" "}
            {mode === "l3" ? "레전드리 3줄" : "레전드리 1 + 유니크 2"}{" "}
            {pickedTwo
              ? `· ${ABILITY_OPTIONS[pickedTwo.keys[0]].short} 다음 ${withSubject(ABILITY_OPTIONS[pickedTwo.keys[1]].short)} 뜬 뒤 남은 비용`
              : pickedRow
                ? `· ${withSubject(ABILITY_OPTIONS[pickedRow.key].short)} 둘째 · 셋째 줄에 뜬 뒤 남은 비용`
                : "띄우는 데 드는 것"}
          </span>
          {total(view) !== null ? (
            <span className="font-num text-[34px] leading-none font-bold sm:text-[40px]">
              {eok(total(view)!)}
              <span className="ml-1 text-base">메소</span>
            </span>
          ) : (
            <span className="font-num text-[34px] leading-none font-bold sm:text-[40px]">
              {fameText(view.fame)}
              <span className="ml-1 text-base">명성치</span>
            </span>
          )}
          <span className="text-xs font-semibold opacity-85">
            평균 · 명성치 {fameText(view.fame)}
            {view.meso > 0 ? ` + 재설정 ${eok(view.meso)}` : ""}
            {circMeso > 0 ? ` + 서큘레이터 ${eok(circMeso)}` : ""}
          </span>
          {pickedRow && total(plan) !== null && (
            <span className="text-xs font-semibold opacity-85">
              처음부터 평균 {eok(total(plan)!)} ·{" "}
              {total(view)! <= total(plan)!
                ? `${eok(total(plan)! - total(view)!)} 절약`
                : `${eok(total(view)! - total(plan)!)} 추가`}
            </span>
          )}
        </div>
        {!pickedRow && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">
              {mode === "l3" ? "레전드리 1 + 유니크 2" : "레전드리 3줄"}로 하면
            </span>
            <b className="font-num">{costText(other)}</b>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Box
            k="명성치"
            v={fameText(view.fame)}
            sub={
              have > 0
                ? have >= view.fame
                  ? "가진 걸로 충분"
                  : `${fameText(view.fame - have)} 모자람`
                : famePerUnit > 0
                  ? `약 ${eok(view.fame * famePerUnit)}`
                  : "평균"
            }
          />
          <Box
            k="재설정 메소"
            v={view.meso > 0 ? eok(view.meso) : "없음"}
            sub={view.meso > 0 ? "고급 재설정" : "명성치 재설정만"}
          />
          <Box k="재설정 횟수" v={count(view.resets)} sub="평균" />
          <Box
            k="서큘레이터"
            v={circN(view.circ)}
            sub={
              view.circ === 0
                ? "필요 없음"
                : circMeso > 0
                  ? `약 ${eok(circMeso)}`
                  : "수치 맞추기"
            }
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <b className="text-sm">가장 싼 순서</b>
          <Step n={1} title={`잠금 없이 ${METHOD_NAME[plan.start]}`} />
          <Step
            n={2}
            title={`첫째 줄에 먼저 뜨면${firstSame ? ` → ${actionText(plan.afterFirst[0].action, false)}` : ""}`}
            note={
              firstSame && plan.afterFirst[0].action.kind === "keep"
                ? "첫째 줄은 마지막에 채우는 게 쌈"
                : undefined
            }
          >
            {/* Rerolling from scratch leaves the whole cost, so the rows would only repeat the total. */}
            {!(firstSame && plan.afterFirst[0].action.kind === "keep") &&
              plan.afterFirst.map((b) => (
                <StepRow
                  key={b.key}
                  label={ABILITY_OPTIONS[b.key].short}
                  action={firstSame ? undefined : actionText(b.action, false)}
                  cost={costText(b)}
                />
              ))}
          </Step>
          <Step
            n={3}
            title={`둘째 · 셋째 줄에 먼저 뜨면${lowerSame ? ` → ${actionText(lowerRows[0].action, false)}` : ""}`}
            aside={
              <SeenChips
                label="실제로 뜬 옵션"
                keys={lowerRows.map((b) => b.key)}
                value={picked}
                onChange={pickSeen}
              />
            }
          >
            {lowerRows.map((b) => (
              <StepRow
                key={b.key}
                label={ABILITY_OPTIONS[b.key].short}
                action={lowerSame ? undefined : actionText(b.action, false)}
                extra={
                  b.action.kind === "circ"
                    ? `서큘레이터 ${circN(b.action.circCount)}`
                    : undefined
                }
                cost={costText(b)}
                selected={picked === b.key}
              />
            ))}
          </Step>
          <Step
            n={4}
            title={`${picked && twoRows.length ? `${ABILITY_OPTIONS[picked].short} 다음 ` : ""}하나 더 뜨면${twoSame ? ` → ${actionText(twoRows[0].action, true)}` : ""}`}
            note={
              picked && twoRows.length === 0
                ? `${withTopic(ABILITY_OPTIONS[picked].short)} 잠그지 않음 · 다음 결과로 2 · 3단계부터 다시`
                : undefined
            }
            aside={
              picked && twoRows.length > 0 ? (
                <SeenChips
                  label="두 번째로 뜬 옵션"
                  keys={twoRows.map((b) => b.keys[1])}
                  value={pickedTwo ? pickedTwo.keys[1] : null}
                  onChange={pickSeen2}
                />
              ) : undefined
            }
          >
            {twoRows.length > 0 &&
              twoRows.map((b) => (
                <StepRow
                  key={b.keys.join(">")}
                  label={
                    picked
                      ? ABILITY_OPTIONS[b.keys[1]].short
                      : b.keys
                          .map((k) => ABILITY_OPTIONS[k].short)
                          .join(" 다음 ")
                  }
                  action={twoSame ? undefined : actionText(b.action, true)}
                  extra={
                    b.action.kind === "circ"
                      ? `서큘레이터 ${circN(b.action.circCount)}`
                      : undefined
                  }
                  cost={costText(b)}
                  selected={pickedTwo === b}
                />
              ))}
          </Step>
          <Step
            n={5}
            title="다 떴는데 수치가 모자라면 → 서큘레이터"
            note="서큘레이터는 잠근 줄 수치도 다시 굴림"
          />
        </div>
      </section>
    </div>
  );
}

/** "보공이" / "패시브가": 이 after a final consonant, 가 after a vowel. */
const withSubject = (word: string) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? "이" : "가");
};

/** "보공은" / "패시브는". */
const withTopic = (word: string) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (c >= 0 && c < 11172 && c % 28 !== 0 ? "은" : "는");
};

const presetKeys = (id: string) =>
  ABILITY_PRESETS.find((p) => p.id === id)!.keys;

const METHOD_NAME: Record<Method, string> = {
  fame: "명성치 재설정",
  advanced: "고급 재설정",
};

function Step({
  n,
  title,
  note,
  aside,
  children,
}: {
  n: number;
  title: string;
  note?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <span className="flex items-start gap-2 text-[13px]">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary font-num text-[11px] font-bold text-primary-foreground">
            {n}
          </span>
          <b className="leading-5">{title}</b>
        </span>
        {aside}
      </div>
      {note && (
        <span className="pl-7 text-xs text-muted-foreground">{note}</span>
      )}
      {children && (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border pl-0">
          {children}
        </div>
      )}
    </div>
  );
}

/** "뜬 옵션" chips next to a step title: pick what actually showed up, press again to clear. */
function SeenChips({
  label,
  keys,
  value,
  onChange,
}: {
  label: string;
  keys: AbilityKey[];
  value: AbilityKey | null;
  onChange: (k: AbilityKey | null) => void;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="flex items-center gap-1 pl-7 sm:pl-0"
    >
      <span className="mr-0.5 text-[11px] text-muted-foreground">뜬 옵션</span>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(value === k ? null : k)}
          className={cn(
            "h-7 rounded-full border px-2.5 text-xs transition-colors",
            value === k
              ? "border-primary bg-primary font-bold text-primary-foreground"
              : "border-border hover:border-primary/60",
          )}
        >
          {ABILITY_OPTIONS[k].short}
        </button>
      ))}
    </span>
  );
}

function StepRow({
  label,
  action,
  extra,
  cost,
  selected,
}: {
  label: string;
  action?: string;
  extra?: string;
  cost: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2",
        selected && "bg-primary-soft",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px]">
          <b>{label}</b>
          {action ? ` → ${action}` : ""}
        </span>
        {extra && (
          <span className="text-[11px] text-muted-foreground">{extra}</span>
        )}
      </span>
      <span className="flex flex-col items-end">
        <b className="font-num text-[13px] whitespace-nowrap">{cost}</b>
        <span className="text-[10px] text-muted-foreground">남은 평균</span>
      </span>
    </div>
  );
}

function Box({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
      <span className="text-[11px] text-muted-foreground">{k}</span>
      <b className="truncate font-num text-base">{v}</b>
      <span className="truncate text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}
