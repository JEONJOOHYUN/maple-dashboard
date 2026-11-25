"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Digits } from "@/components/ui/digits";
import { MenuSelect } from "@/components/ui/menu-select";
import { Reveal } from "@/components/ui/reveal";
import { Spinner } from "@/components/ui/spinner";
import {
  Chip,
  Label,
  NumberField,
  Panel,
  RESULT_SHELL,
  Segment,
  Switch,
  count,
  eok,
  parseNum,
} from "@/components/ev/ui";
import { ClassAbilityTable } from "@/components/ev/class-ability-table";
import {
  ABILITY_OPTIONS,
  ABILITY_PRESETS,
  ABILITY_VALUES,
  abilityPairPlan,
  abilityPlan,
  buildPreset,
  presetLead,
  valueChoices,
  type AbilityGoal,
  type AbilityKey,
  type AbilityMode,
  type AbilityPlan,
  type AbilityPreset,
  type CircKind,
  type Method,
  type PlanAction,
  type PlanFinish,
  type PlanOpts,
  type PlanRun,
  type PlanStep,
  type RunUse,
} from "@/lib/ev/ability";
import type { ClassAbility } from "@/lib/ev/ability-classes";
import { creditShop } from "@/lib/site-values/values";
import { useSiteValues } from "@/components/site-values";
import { extraTip } from "@/lib/tip";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";

// Fame to the nearest 만 ("6,385만", "1억 1,054만").
const fameText = (f: number) => (f >= 1e4 ? koreanUnits(Math.round(f / 1e4) * 1e4) : koreanUnits(f));

export function AbilityTab({ classes }: { classes: ClassAbility[] }) {
  const [presetId, setPresetId] = useState("pbs");
  const [mode, setMode] = useState<AbilityMode>("l3");
  // A class picked in 직업별 추천: its build for the reset picked (고급 / 일반 differ) replaces the chip preset.
  const [cls, setCls] = useState<string | null>(null);
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
  // Abyss circulator price (억), same default as the MVP credit shop. Only the advanced reset uses it: the fame-reset
  // build rerolls values with the black · chaos circulators, event items with no price (user, 2026-11-15).
  const shop = creditShop(useSiteValues());
  const [circText, setCircText] = useState(
    String(shop.find((x) => x.id === "circulator")?.auctionEok ?? ""),
  );
  // Miracle circulator price (억): no longer sold, traded at about 1.5억 (user, 2026-11-15).
  const [miracleText, setMiracleText] = useState("1.5");
  // Black · chaos circulators held now: event items, only a few (user, 2026-11-15: "400개를 돌리는 건 안 돼"). None to
  // start (user, 2026-11-16: most people are not thinking of the event coins; another calculator starts at 0 too) — at
  // most from the coin shops 블랙 40 · 카오스 20. Blank = none. Up to 50 each: a larger count turns into 50, so the
  // field shows the count the plan uses (user, 2026-11-15). Black keeps the values when a result is not applied, chaos
  // applies every result.
  const [blackText, setBlackText] = useState("0");
  const [chaosText, setChaosText] = useState("0");

  const chosen = useMemo(() => classes.find((c) => c.name === cls) ?? null, [classes, cls]);
  const built = useMemo(
    () => (chosen ? buildPreset(mode === "l3" ? chosen.full : chosen.practical, mode) : null),
    [chosen, mode],
  );
  const preset = built ?? ABILITY_PRESETS.find((p) => p.id === presetId)!;
  // A second preset made into 드메 at the same time (user, 2026-11-14), for the boss builds.
  const [withHunt, setWithHunt] = useState(false);
  const hunt = ABILITY_PRESETS.find((p) => p.hunting)!;
  const pairOn = withHunt && !preset.hunting;
  // L1+U2: the legendary line is the legendary-only option if there is one, else the first of the preset (드메: either).
  const lead = presetLead(preset)[0];
  const famePerUnit = (parseNum(fame5kText, 0) * 1e4) / 5000;
  const unitOf = (k: AbilityKey) => ABILITY_VALUES[k].unit;
  // Typed in 만 (user, 2026-11-18): "12.5" = 125,000 fame.
  const have = Math.round(parseNum(haveText, 0) * 1e4);

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
  // The value circulator of this build: abyss (priced) for the advanced reset, black · chaos (free) for the fame reset.
  const circPrice = mode === "l3" ? parseNum(circText, 0) * 1e8 : 0;
  const miraclePrice = parseNum(miracleText, 0) * 1e8;
  // 일반 재설정 only: the event circulators held (the abyss ones of 고급 are bought, as many as it takes).
  const blackHeld = Math.floor(parseNum(blackText, 0));
  const chaosHeld = Math.floor(parseNum(chaosText, 0));
  const opts: PlanOpts = useMemo(
    () => ({
      sunday,
      famePricePerUnit: famePerUnit,
      values: {
        goal: (k, g) => goals[`${k}:${g}`] ?? Math.max(...valueChoices(k, g)),
        circPrice,
        ...(mode === "l1u2" ? { held: { black: blackHeld, chaos: chaosHeld } } : {}),
      },
      miraclePrice,
    }),
    [sunday, famePerUnit, goals, circPrice, miraclePrice, mode, blackHeld, chaosHeld],
  );
  // The plan is worked out after a change is on screen (user, 2026-11-15: a wait should show, and nothing heavy such as
  // a worker): the page paints first, then the plan comes in the next task. Until it does, the last plan stays — the
  // result column dims and says "계산 중" when that takes a moment (50 · 50 circulators with 드메: about a second).
  // Everything the result column reads is kept with its plan (Codex review: while a new plan comes, the column showed
  // the last plan under the new names, prices and wanted values).
  const inputs = useMemo(
    () => ({ preset, hunt, pairOn, mode, opts, chosen, goals, famePerUnit, circPrice, miraclePrice, blackHeld, chaosHeld }),
    [preset, hunt, pairOn, mode, opts, chosen, goals, famePerUnit, circPrice, miraclePrice, blackHeld, chaosHeld],
  );
  // A change that takes a moment (the circulators held; 드메 as well about 7 times the work): the mark is painted before
  // the work starts, so it shows while the page waits. Others only show it if they last (a delayed fade, quick ones never).
  const slow = mode === "l1u2" && (blackHeld + 1) * (chaosHeld + 1) * (pairOn ? 7 : 1) >= 1500;
  const [result, setResult] = useState(() => ({ inputs, planned: planOf(inputs), slow: false }));
  useEffect(() => {
    if (result.inputs === inputs) return;
    let live = true;
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (live) setResult({ inputs, planned: planOf(inputs), slow });
      }, 0);
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [inputs, result.inputs, slow]);
  const planned = result.planned;
  /** What the result column was worked out from: it shows its plan with these until the next one comes. */
  const shown = result.inputs;
  const pending = result.inputs !== inputs;
  const waiting = pending ? (slow ? "now" : "later") : null;
  const plan = planned.both;
  /** Which rows are the 드메 preset's in a two-preset plan (goal 1). */
  const huntGoal = shown.pairOn ? 1 : shown.preset.hunting ? 0 : -1;
  const seen2 = seen2Sel?.plan === plan ? seen2Sel.key : null;
  const pickSeen = (k: AbilityKey | null) => {
    setSeen(k);
    setSeen2Sel(null);
  };
  const choosePreset = (id: string) => {
    setPresetId(id);
    setCls(null);
    pickSeen(null);
  };
  const chooseClass = (name: string) => {
    setCls(name);
    pickSeen(null);
  };
  const chooseMode = (m: AbilityMode) => {
    setMode(m);
    pickSeen(null);
  };
  const pickSeen2 = (k: AbilityKey | null) =>
    setSeen2Sel(k ? { plan, key: k } : null);
  type Cost = { fame: number; meso: number; circ: number; miracle: number };
  const total = (p: Cost) =>
    shown.famePerUnit > 0
      ? p.fame * shown.famePerUnit + p.meso + p.circ * shown.circPrice + p.miracle * shown.miraclePrice
      : null;
  const costText = (p: Cost) =>
    total(p) !== null
      ? `약 ${eok(total(p)!)}`
      : `${fameText(p.fame)}${p.meso > 0 ? ` + ${eok(p.meso)}` : ""}`;
  /**
   * Which circulator, in the move itself and by the names players use (user, 2026-11-16: "카서큘 블서큘 심서큘"), so a
   * row reads at a glance: 일반 = the event black · chaos ones held (chaos then black: "카서큘", the line under it says
   * when black comes in), 고급 = abyss.
   */
  const circName = (k?: CircKind) =>
    k === "black" ? "블서큘" : k ? "카서큘" : shown.mode === "l3" ? "심서큘" : "서큘레이터";
  const circN = (n: number) =>
    `${(Math.round(n * 10) / 10).toLocaleString("ko-KR")}개`;
  /**
   * Under a go of circulators: how many it takes; with a limit, the chance the ones held are enough and what to lock
   * when they run out (Codex review: the guide has to say what to do then too) — left out when it is all but certain.
   */
  const circExtra = (a: {
    circCount: number;
    circKind?: CircKind;
    circLeft?: number;
    circChance?: number;
    circMissKeep?: AbilityKey[];
  }) => {
    if (a.circLeft === undefined) return `평균 ${circN(a.circCount)}`;
    const chance = a.circChance ?? 0;
    const miss = !a.circMissKeep
      ? "목표 수치인 줄만 잠그고 계속"
      : a.circMissKeep.length
        ? `${a.circMissKeep.map((k) => ABILITY_OPTIONS[k].short).join(" · ")}만 잠그고 계속`
        : "잠그지 않고 계속";
    const both = a.circKind === "both";
    return [
      both && "카서큘 다 쓰면 블서큘",
      `평균 ${circN(a.circCount)}`,
      `${a.circLeft.toLocaleString("ko-KR")}개 안에 ${chanceText(chance)}`,
      chance < 0.99 && `${both ? "블서큘까지 " : ""}다 쓰면 ${miss}`,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const gradeAt = (line: number) =>
    (shown.mode === "l3" || line === 0 ? "legendary" : "unique") as "legendary" | "unique";
  /** "20%": the wanted value of this option on that line (as the plan shown was worked out). */
  const goalText = (k: AbilityKey, line: number) => {
    const g = gradeAt(line);
    return `${shown.goals[`${k}:${g}`] ?? Math.max(...valueChoices(k, g))}${unitOf(k)}`;
  };
  /**
   * Lines locked, then the event circulators one at a time (user, 2026-11-16): the move names the kinds and the values
   * ("잠금 → 카서큘 → 블서큘로 보공 10% · 상추뎀 8%"); under it only what differs by what is at the goal, the black rule,
   * and how it goes.
   */
  /** "카서큘 → 블서큘로 보공 10% · 상추뎀 8%" (the kinds the run uses, then the values it goes for). */
  const runGoal = (run: PlanRun) => {
    const uses = new Set(run.by.map((x) => x.use));
    const chaos = uses.has("chaos");
    const black = uses.has("black") || (chaos && shown.blackHeld > 0);
    const kinds = chaos && black ? "카서큘 → 블서큘" : chaos ? "카서큘" : "블서큘";
    return `${kinds}로 ${run.keys.map((k, i) => `${ABILITY_OPTIONS[k].short} ${goalText(k, run.lines[i])}`).join(" · ")}`;
  };
  const runAction = (run: PlanRun) => `잠금 → ${runGoal(run)}`;
  const runExtra = (run: PlanRun): string[] => {
    const who = (have: AbilityKey[]) =>
      have.length ? `${have.map((k) => ABILITY_OPTIONS[k].short).join(" · ")}만 맞으면` : "맞은 줄 없으면";
    const count = (u: string) => run.by.filter((x) => x.use === u).length;
    const main = count("chaos") >= count("black") ? "chaos" : "black";
    const moveText = (use: RunUse, keep?: AbilityKey[]) =>
      use === "stop"
        ? `멈추고 ${keep?.length ? `${keep.map((k) => ABILITY_OPTIONS[k].short).join(" · ")}만 잠근 채 ` : ""}재설정`
        : use === "black"
          ? "블서큘"
          : "카서큘";
    // Only what differs from the usual (chaos, then black when it runs out), and where it changes as the counts go down.
    const odd = run.by.flatMap((x) => {
      const now = x.use !== main ? moveText(x.use, x.keep) : "";
      const then = x.then
        ? `${x.then.kind === "chaos" ? "카서큘" : "블서큘"}${x.then.at > 0 ? `이 ${x.then.at}개 남았을 때부터` : " 다 쓰면"} ${moveText(x.then.use, x.then.keep)}`
        : "";
      return now || then ? [`${who(x.have)} ${[now, then].filter(Boolean).join(", ")}`] : [];
    });
    const order = run.by.filter((x) => x.have.length === 1).map((x) => ABILITY_OPTIONS[x.have[0]].short);
    const blackRule =
      run.keys.length > 1 && (run.by.some((x) => x.use === "black") || shown.blackHeld > 0)
        ? `블서큘은 나은 결과만 적용${order.length > 1 ? `(${order.join(" > ")})` : ""}`
        : null;
    const held = shown.blackHeld + shown.chaosHeld;
    return [
      [...odd, blackRule].filter(Boolean).join(" · "),
      [
        `평균 ${circN(run.circCount)}`,
        `${held.toLocaleString("ko-KR")}개 안에 ${chanceText(run.chance)}`,
        run.chance < 0.99 && "다 쓰면 목표 수치인 줄만 잠그고 계속",
      ]
        .filter(Boolean)
        .join(" · "),
    ].filter(Boolean);
  };
  /** Short "→" chain. two = the second option (both found lines are handled together); run = locking leads to one. */
  const actionText = (a: PlanAction, two: boolean, run?: PlanRun) =>
    a.kind === "keep"
      ? "그대로 계속"
      : a.kind === "lock"
        ? run
          ? runAction(run)
          : "잠금"
        : run
          ? runGoal(run)
          : `${circName(a.circKind)}로 ${two ? "두 줄 " : ""}목표 수치 → 잠금`;
  /** The row's move, and the other one when showing the wanted value changes it ("그대로 계속 · 20% 이상이면 잠금"). */
  const rowAction = (r: PlanStep, k: AbilityKey, two: boolean) =>
    r.atGoal
      ? `${actionText(r.action, two)} · ${goalText(k, r.line)} 이상이면 ${actionText(r.atGoal, two, r.run)}`
      : actionText(r.action, two, r.run);
  /** Under a row: the circulators of its move (a go, or the run after locking). */
  const rowExtra = (r: PlanStep): string[] | undefined =>
    r.run ? runExtra(r.run) : r.action.kind === "circ" ? [circExtra(r.action)] : undefined;
  // Same move for every row (and no "at the wanted value" variant) → say it once in the step title.
  const sameAction = (list: { action: PlanAction; atGoal?: PlanAction; run?: PlanRun }[]) =>
    list.every(
      (x) =>
        !x.atGoal &&
        !x.run &&
        x.action.kind === list[0].action.kind &&
        x.action.method === list[0].action.method &&
        x.action.circKind === list[0].action.circKind,
    );
  const firstSame = sameAction(plan.afterFirst);
  // Line 1 first is "go on" for every option: steps 1 and 2 are one step (user, 2026-11-15). The advanced reset's
  // auto reset has "첫 번째 옵션 제외" for exactly that (official guide); the fame reset just goes on.
  const firstKeep = firstSame && plan.afterFirst[0]?.action.kind === "keep";
  /** Step number as shown (one less after the merged first step). */
  const sn = (n: number) => (firstKeep && n > 1 ? n - 1 : n);
  const again = `다음 결과로 ${firstKeep ? sn(3) : "2 · 3"}단계부터 다시`;
  // Cheapest first; step 4 follows what the user picked in step 3.
  const costNum = (p: Cost) => total(p) ?? p.fame;
  const lowerRows = [...plan.afterFirstLower].sort(
    (a, b) => costNum(a) - costNum(b),
  );
  const picked = seen && lowerRows.some((r) => r.key === seen) ? seen : null;
  const twoAll = plan.afterTwo
    .filter((r) => !picked || r.keys[0] === picked)
    .sort((a, b) => costNum(a) - costNum(b));
  // Step 1 already says to pass over line 1: a line-1 option that only goes on would say it again (user, 2026-11-16:
  // "첫줄 제외로 돌릴텐데 3단계에 패시브가 있어야해?"). One the plan locks there still shows.
  const twoRows = firstKeep
    ? twoAll.filter((r) => !(r.line === 0 && r.action.kind === "keep" && !r.atGoal))
    : twoAll;
  const pickedRow = picked ? lowerRows.find((r) => r.key === picked)! : null;
  // Step 4 chips only make sense once step 3 is picked (they list what can follow it).
  const pickedTwo =
    picked && seen2 ? (twoRows.find((r) => r.keys[1] === seen2) ?? null) : null;
  // What follows a row may assume it showed the wanted value (below it, it is not kept): then the summary is that case.
  const leftOf = (r: PlanStep): Cost & { resets: number } => (r.nextAtGoal && r.atGoalLeft ? r.atGoalLeft : r);
  const view: Cost & { resets: number } = pickedTwo ? leftOf(pickedTwo) : pickedRow ? leftOf(pickedRow) : plan;
  /** "보공" or, when what follows assumes the wanted value, "보공 20%". */
  const seenName = (r: PlanStep, k: AbilityKey) =>
    r.nextAtGoal ? `${ABILITY_OPTIONS[k].short} ${goalText(k, r.line)}` : ABILITY_OPTIONS[k].short;
  const circMeso = view.circ * shown.circPrice;
  // A move shared by every row goes up into the step title; one row keeps its own (a long title pushed the chips down).
  const lowerSame = lowerRows.length > 1 && sameAction(lowerRows);
  const twoSame = twoRows.length > 1 && sameAction(twoRows);
  // The last step comes from the plan too (user, 2026-11-15: a fixed "모자라면 → 서큘레이터" told people to reroll lines
  // they had just circulated). With the options picked above: that one way; otherwise every way the plan can end.
  const lineName = (lines: number[]) => `${lines.map((l) => ["첫째", "둘째", "셋째"][l]).join(" · ")} 줄`;
  const lastLabel = (f: PlanFinish) => `${lineName(f.lines)} ${ABILITY_OPTIONS[f.last].short}`;
  /** withLast: "첫째 줄 보공 뜨면 → …" (the overview); without it the row label already names the line. */
  const finishText = (f: PlanFinish, withLast: boolean) => {
    const last = withLast ? `${lastLabel(f)} ` : "";
    // Only below the wanted values (Codex review): all of them at the goal already is the end.
    const circ = f.run
      ? `수치 모자라면 ${runGoal(f.run)}`
      : `수치 모자라면 ${circName(f.circKind)}로 ${f.locked.length + 1 === 2 ? "두" : "세"} 줄 목표 수치`;
    return f.move === "keep"
      ? `${last}${goalText(f.last, f.lines[0])} 이상 뜰 때까지 재설정`
      : f.move === "done"
        ? withLast ? `${last}뜨면 끝` : "끝"
        : withLast ? `${last}뜨면 → ${circ}` : circ;
  };
  type FinishRow = { id: string; label: string; action: string; f: PlanFinish; goal: number };
  const finishRows: FinishRow[] = (() => {
    const one = pickedTwo ?? (pickedRow?.finish ? pickedRow : null);
    if (one)
      return (one.finish ?? []).map((f) => ({
        id: `${f.move}:${f.lines.join()}`,
        label: lastLabel(f),
        action: finishText(f, false),
        f,
        goal: one.goal,
      }));
    const from: PlanStep[] = picked ? twoRows : [...plan.afterTwo, ...plan.afterFirstLower];
    const out = new Map<string, FinishRow>();
    for (const r of from)
      for (const f of r.finish ?? []) {
        const pair = [...f.locked].sort().join("+");
        const id = `${pair}|${f.last}|${f.move}|${f.lines.join()}`;
        if (!out.has(id))
          out.set(id, {
            id,
            label: f.locked.map((k) => ABILITY_OPTIONS[k].short).join(" + "),
            action: finishText(f, true),
            f,
            goal: r.goal,
          });
      }
    return [...out.values()].sort((a, b) => costNum(a.f) - costNum(b.f));
  })();
  /** "146.2억" (money when there is a fame price, else fame). */
  const diffText = (more: Cost, less: Cost) => {
    const d = costNum(more) - costNum(less);
    return total(more) !== null ? eok(d) : fameText(d);
  };
  /**
   * The other natural move and how much more it leaves: "안 잠그면 +X" when the plan locks, "잠그면 +X" when it goes on.
   * Only with a fame price (one number to compare) and from 1 % up (user, 2026-11-14: less text, nothing repeated).
   */
  const altShort = (row: PlanStep, k: AbilityKey) => {
    const best = row.choices[0];
    if (!best || total(best) === null) return undefined;
    const other =
      row.action.kind === "keep"
        ? row.choices.find((c) => c.action.kind !== "keep")
        : row.choices.find((c) => c.action.kind === "keep");
    if (!other) return undefined;
    const more = costNum(other) - costNum(best);
    if (more < costNum(best) * 0.01) return undefined;
    // With "20% 이상이면 잠금" next to it, say that this one is about locking below the wanted value.
    const below = row.atGoal ? `${goalText(k, row.line)} 미만에 ` : "";
    return `${below}${row.action.kind === "keep" ? "잠그면" : "안 잠그면"} +${diffText(other, best)}`;
  };
  /** The wanted value of these options on this grade (드메: drop and meso move together). */
  const valueSelect = (ks: AbilityKey[], g: "legendary" | "unique", label: string) => {
    const choices = valueChoices(ks[0], g);
    if (choices.length <= 1)
      return (
        <b className="px-2 font-num text-xs">
          +<Digits>{choices[0] ?? "-"}</Digits>
          {unitOf(ks[0])}
        </b>
      );
    return (
      <MenuSelect
        label={`${label} 목표 수치`}
        value={String(goalOf(ks[0], g))}
        onChange={(next) => setGoals({ ...goals, ...Object.fromEntries(ks.map((k) => [`${k}:${g}`, Number(next)])) })}
        options={choices.map((v) => ({ value: String(v), label: `+${v}${unitOf(ks[0])} 이상` }))}
        className="h-7 border-input bg-card pr-7 pl-1.5 font-num text-xs"
        menuClassName="font-num"
      />
    );
  };
  /** 드메: drop or meso on the legendary line 1, the other on line 2 (legendary too in "레전드리 2줄"). */
  const huntLines = (m: AbilityMode) => (
    <>
      <GoalLine legend label="드롭률 · 메소 중 하나" value={valueSelect(["drop", "meso"], "legendary", "첫째 줄")} />
      <GoalLine
        legend={m === "l3"}
        label="나머지 하나 (둘째 · 셋째 줄)"
        value={valueSelect(["drop", "meso"], m === "l3" ? "legendary" : "unique", "나머지 줄")}
      />
    </>
  );

  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Its own height, not stretched to the long result column (user, 2026-11-14: the two sides looked unbalanced);
          the class table fills the space under it (user, 2026-11-15). */}
      <div className="flex min-w-0 flex-col gap-2 lg:self-start">
        <Panel>
          <Label>자주 노리는 조합</Label>
          <div className="flex flex-wrap gap-1.5">
            {ABILITY_PRESETS.map((p) => (
              <Chip
                key={p.id}
                on={p.id === preset.id}
                onClick={() => choosePreset(p.id)}
                title={p.keys.map((k) => ABILITY_OPTIONS[k].label).join(" · ")}
                className="rounded-full"
              >
                {p.label}
              </Chip>
            ))}
          </div>
          {!preset.hunting && (
            <Switch
              on={withHunt}
              onChange={(on) => {
                setWithHunt(on);
                pickSeen(null);
              }}
              label="드메 프리셋도 같이 맞추기"
              note="프리셋 2개 · 먼저 맞는 쪽부터"
            />
          )}
          <Label
            aside={
              <Segment
                label="재설정 종류"
                value={mode}
                onChange={chooseMode}
                // The reset decides the grades: legendary lines 2 · 3 only come from the advanced reset (user, 2026-11-15).
                options={[
                  { id: "l3", label: METHOD_NAME.advanced },
                  { id: "l1u2", label: METHOD_NAME.fame },
                ]}
                className="w-56"
              />
            }
          >
            목표 {preset.keys.length === 2 ? "두" : "세"} 줄
          </Label>
          <div className="flex flex-col gap-1.5">
            {preset.hunting
              ? huntLines(mode)
              : order.map((k, i) => (
                  <GoalLine
                    key={k}
                    legend={mode === "l3" || i === 0}
                    label={ABILITY_OPTIONS[k].label}
                    value={valueSelect([k], gradeOf(i), ABILITY_OPTIONS[k].label)}
                  />
                ))}
            <Reveal open={pairOn} className="flex flex-col gap-1.5">
              <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
                드메 프리셋 · {modeLabel(hunt, mode)}
              </span>
              {huntLines(mode)}
            </Reveal>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              가진 명성치
              <NumberField
                label="가진 명성치 (만)"
                value={haveText}
                onChange={setHaveText}
                decimal
                suffix="만"
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
            {/* One price per reset (user, 2026-11-15): 고급 = abyss circulators for the values, 일반 = miracle circulators
                (black · chaos are free event items, and a miracle never helps three legendary lines). */}
            {mode === "l3" ? (
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                심연의 서큘레이터 1개
                <NumberField
                  label="심연의 서큘레이터 1개 가격 (억 메소)"
                  value={circText}
                  onChange={setCircText}
                  decimal
                  suffix="억"
                  inputClassName="w-full"
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                미라클 서큘레이터 1개
                <NumberField
                  label="미라클 서큘레이터 1개 가격 (억 메소)"
                  value={miracleText}
                  onChange={setMiracleText}
                  decimal
                  suffix="억"
                  inputClassName="w-full"
                />
              </label>
            )}
          </div>
          {/* The event circulators held now (일반 only: they cannot touch legendary lines 2 · 3), up to 50 of each (the
              plan works out every count below them). The steps use these counts as they are, so after a go the counts
              left are typed in (Codex review). */}
          <Reveal open={mode === "l1u2"} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-col text-[11px] text-muted-foreground">
                지금 가진 이벤트 서큘레이터
                <span className="text-[10px]">쓰고 나면 남은 개수로 고쳐 넣기</span>
              </span>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  블랙
                  <NumberField
                    label="가진 블랙 서큘레이터 개수"
                    value={blackText}
                    onChange={(t) => setBlackText(heldText(t))}
                    suffix="개"
                    inputClassName="w-14"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  카오스
                  <NumberField
                    label="가진 카오스 서큘레이터 개수"
                    value={chaosText}
                    onChange={(t) => setChaosText(heldText(t))}
                    suffix="개"
                    inputClassName="w-14"
                  />
                </label>
              </span>
          </Reveal>
          <Switch
            on={sunday}
            onChange={setSunday}
            label="썬데이 명성치 50% 할인"
            note="명성치 절반"
          />
        </Panel>
        <ClassAbilityTable classes={classes} picked={cls} mode={mode} onPick={chooseClass} />
      </div>

      <span role="status" className="sr-only">
        {waiting === "now" ? "계산 중" : result.slow ? "계산 끝" : ""}
      </span>
      <section aria-busy={pending} className="relative min-w-0">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-md opacity-0",
            waiting === "now" && "opacity-100",
            waiting === "later" && "opacity-100 transition-opacity delay-150 duration-150",
          )}
        >
          <Spinner size={12} />
          계산 중
        </span>
        <div
          className={cn(
            "flex min-w-0 flex-col gap-2",
            waiting === "now" && "opacity-50",
            waiting === "later" && "opacity-50 transition-opacity delay-150 duration-150",
          )}
        >
          <div className={cn(RESULT_SHELL, "gap-1.5")}>
            <span className="text-[13px] font-semibold">
              {shown.chosen ? `${shown.chosen.name} ` : ""}
              {shown.preset.label}
              {shown.pairOn ? ` + ${shown.hunt.label} · 프리셋 2개` : ""} · {modeLabel(shown.preset, shown.mode)}{" "}
              {pickedTwo && pickedRow
                ? `· ${seenName(pickedRow, pickedRow.key)} 다음 ${withSubject(seenName(pickedTwo, pickedTwo.keys[1]))} 뜬 뒤 남은 비용`
                : pickedRow
                  ? `· ${withSubject(seenName(pickedRow, pickedRow.key))} 둘째 · 셋째 줄에 뜬 뒤 남은 비용`
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
            {shown.pairOn && !pickedRow && planned.separate && (
              <span className="text-xs font-semibold opacity-85">
                따로 하면 {costText(planned.separate).replace(/^약 /, "")} · {diffText(planned.separate, plan)} 절약
              </span>
            )}
            {/* Either build counts on the first preset, so it alone costs less than the boss build alone (user, 2026-11-14). */}
            {shown.pairOn && !pickedRow && plan.first && (
              <span className="text-xs font-semibold opacity-85">
                첫 프리셋(먼저 맞는 쪽까지) {costText(plan.first).replace(/^약 /, "")} · {shown.hunt.label}가 먼저{" "}
                {Math.round(plan.first.chance[1] * 100)}%
              </span>
            )}
            {pickedRow && total(plan) !== null && (
              <span className="text-xs font-semibold opacity-85">
                처음부터 평균 {eok(total(plan)!)} ·{" "}
                {total(view)! <= total(plan)!
                  ? `${eok(total(plan)! - total(view)!)} 절약`
                  : `${eok(total(view)! - total(plan)!)} 추가`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Box
              k="명성치"
              v={fameText(view.fame)}
              sub={
                have > 0
                  ? have >= view.fame
                    ? "가진 걸로 충분"
                    : `${fameText(view.fame - have)} 모자람`
                  : shown.famePerUnit > 0
                    ? `약 ${eok(view.fame * shown.famePerUnit)}`
                    : "평균"
              }
            />
            <Box
              k="재설정 메소"
              v={view.meso > 0 ? eok(view.meso) : "없음"}
              sub={view.meso > 0 ? METHOD_NAME.advanced : `${METHOD_NAME.fame}만`}
            />
            <Box
              k="재설정 횟수"
              v={count(view.resets)}
              // Miracle circulators only show up when they are cheap enough to be worth it.
              sub={view.miracle >= 0.05 ? `+ 미라클 ${circN(view.miracle)}` : "평균"}
            />
            <Box
              k="서큘레이터"
              v={circN(view.circ)}
              sub={
                shown.mode === "l1u2"
                  ? shown.blackHeld + shown.chaosHeld > 0
                    ? `가진 ${shown.blackHeld + shown.chaosHeld}개 중`
                    : "가진 것 없음"
                  : view.circ === 0
                    ? "필요 없음"
                    : circMeso > 0
                      ? `약 ${eok(circMeso)}`
                      : "수치 맞추기"
              }
            />
          </div>
          <div className="flex flex-col gap-3 tile p-4 sm:p-5">
            <b className="text-sm">가장 싼 순서</b>
            <Step
              n={1}
              title={
                firstKeep && plan.start === "advanced"
                  ? "첫 번째 옵션 제외 켜고 잠금 없이 고급 재설정"
                  : `잠금 없이 ${METHOD_NAME[plan.start]}${firstKeep ? " · 첫째 줄에 뜬 건 넘김" : ""}`
              }
              note={
                [
                  firstKeep && "첫째 줄은 마지막에 채우는 게 쌈",
                  // The miracle circulator takes no locks: once a line is locked the build goes on with its own reset.
                  plan.start === "miracle" && `잠근 뒤로는 ${METHOD_NAME.fame}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
            {/* Some option on line 1 is not "go on": its own step with a row per option. */}
            {!firstKeep && (
              <Step
                n={2}
                title={`첫째 줄에 먼저 뜨면${firstSame ? ` → ${actionText(plan.afterFirst[0].action, false)}` : ""}`}
              >
                {plan.afterFirst.map((b, i) => (
                  <StepRow
                    key={b.key}
                    label={ABILITY_OPTIONS[b.key].short}
                    tag={b.goal === huntGoal && shown.pairOn ? shown.hunt.label : undefined}
                    action={firstSame ? undefined : rowAction(b, b.key, false)}
                    cost={costText(b)}
                    alts={firstSame ? undefined : altShort(b, b.key)}
                    unit={i === 0}
                  />
                ))}
              </Step>
            )}
            <Step
              n={sn(3)}
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
              {lowerRows.map((b, i) => (
                <StepRow
                  key={b.key}
                  label={ABILITY_OPTIONS[b.key].short}
                  tag={b.goal === huntGoal && shown.pairOn ? shown.hunt.label : undefined}
                  action={lowerSame ? undefined : rowAction(b, b.key, false)}
                  extra={rowExtra(b)}
                  cost={costText(b)}
                  alts={lowerSame ? undefined : altShort(b, b.key)}
                  unit={i === 0}
                  selected={picked === b.key}
                />
              ))}
            </Step>
            {!shown.preset.hunting && (
            <Step
              n={sn(4)}
              title={`${picked && twoRows.length ? `${ABILITY_OPTIONS[picked].short}${pickedRow?.nextAtGoal ? ` ${goalText(picked, pickedRow.line)}` : ""} 다음 ` : ""}하나 더 뜨면${picked && twoSame ? ` → ${actionText(twoRows[0].action, true)}` : ""}`}
              note={
                // Every pair at once made the column long (user, 2026-11-14): only what can follow the option picked in step 3.
                !picked
                  ? `${sn(3)}단계에서 뜬 옵션을 고르면 이어서 보여 줌`
                  : pickedRow?.finish
                    ? // A two-line goal (드메): the other option finishes it, in the last step.
                      `${pickedRow.nextAtGoal ? `${goalText(picked, pickedRow.line)} 미만이면 잠그지 않음 · ` : ""}${shown.hunt.label}는 두 줄 · 마지막 단계로`
                    : twoAll.length === 0
                      ? `${withTopic(ABILITY_OPTIONS[picked].short)} 잠그지 않음 · ${again}`
                      : pickedRow?.nextAtGoal
                        ? `${goalText(picked, pickedRow.line)} 미만이면 잠그지 않음 · ${again}`
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
              {picked &&
                twoRows.length > 0 &&
                twoRows.map((b, i) => (
                  <StepRow
                    key={b.keys.join(">")}
                    label={
                      picked
                        ? ABILITY_OPTIONS[b.keys[1]].short
                        : b.keys
                            .map((k) => ABILITY_OPTIONS[k].short)
                            .join(" 다음 ")
                    }
                    action={twoSame ? undefined : rowAction(b, b.keys[1], true)}
                    extra={rowExtra(b)}
                    cost={costText(b)}
                    alts={twoSame ? undefined : altShort(b, b.keys[1])}
                    unit={i === 0}
                    selected={pickedTwo === b}
                  />
                ))}
            </Step>
            )}
            <Step
              n={sn(shown.preset.hunting ? 4 : 5)}
              title="마지막 하나가 뜨면"
              note={
                finishRows.length > 0
                  ? undefined
                  : pickedTwo
                    ? `${withTopic(ABILITY_OPTIONS[pickedTwo.keys[1]].short)} 잠그지 않음 · 다음 결과로 ${sn(4)}단계부터 다시`
                    : picked
                      ? "위 단계대로 잠그면 이어서 보여 줌"
                      : undefined
              }
            >
              {finishRows.map((r, i) => (
                <StepRow
                  key={r.id}
                  label={r.label}
                  tag={r.goal === huntGoal && shown.pairOn ? shown.hunt.label : undefined}
                  action={r.action}
                  extra={r.f.run ? runExtra(r.f.run) : r.f.move === "circ" ? [circExtra(r.f)] : undefined}
                  cost={costNum(r.f) < 1 ? "0" : costText(r.f)}
                  unit={i === 0}
                />
              ))}
            </Step>
          </div>
        </div>
      </section>
    </div>
  );
}

/** What the plan is worked out from (the preset, the reset, both presets or one, prices and circulators held). */
type PlanInputs = { preset: AbilityPreset; hunt: AbilityPreset; pairOn: boolean; mode: AbilityMode; opts: PlanOpts };

/** Options, values and circulators planned together; with 드메 as well, one ability made into whichever build comes first. */
const planOf = ({ preset, hunt, pairOn, mode, opts }: PlanInputs) =>
  pairOn
    ? abilityPairPlan(goalOf2(preset, mode), goalOf2(hunt, mode), opts)
    : {
        both: abilityPlan(preset.keys, mode, opts, mode === "l1u2" ? presetLead(preset) : undefined),
        a: null,
        b: null,
        separate: null,
      };

/** A count of event circulators as typed: at most 50 (more turns into 50). */
const HELD_MAX = 50;
const heldText = (t: string) => (Number(t) > HELD_MAX ? String(HELD_MAX) : t.slice(0, 2));

/** "96%": whole percent, 100 only when certain and 0 only when impossible. */
const chanceText = (x: number) => `${x >= 1 ? 100 : x <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(x * 100)))}%`;

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

/** A preset as a goal: L1+U2 needs its legendary line (드메: drop or meso). */
const goalOf2 = (p: AbilityPreset, mode: AbilityMode): AbilityGoal => ({
  keys: p.keys,
  mode,
  lead: mode === "l1u2" ? presetLead(p) : undefined,
});

/** "레전드리 3줄" · "레전드리 1 + 유니크 2", or 2 lines for 드메. */
const modeLabel = (p: AbilityPreset, mode: AbilityMode) =>
  mode === "l3" ? `레전드리 ${p.keys.length}줄` : `레전드리 1 + 유니크 ${p.keys.length - 1}`;

const METHOD_NAME: Record<Method, string> = {
  fame: "일반 재설정",
  advanced: "고급 재설정",
  miracle: "미라클 서큘레이터",
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
          {/* Plain font: the Maplestory number font sits off-center vertically inside a 20px circle. */}
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] leading-none font-bold text-primary-foreground tabular-nums">
            {n}
          </span>
          <b className="leading-5">{title}</b>
        </span>
        {aside}
      </div>
      {note && (
        <span className="pl-7 text-xs text-pretty text-muted-foreground">{note}</span>
      )}
      {children && (
        // Clipped: the fill of a picked first or last row stays inside the rounded corners.
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-md tile-edge">
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
      // Five chips with 드메 as well: they wrap rather than squeeze ("패시\n브" on a phone).
      className="flex flex-wrap items-center gap-1 pl-7 sm:pl-0"
    >
      <span className="mr-0.5 shrink-0 text-[11px] text-muted-foreground">뜬 옵션</span>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(value === k ? null : k)}
          className={cn(
            // 28px to look at, 32px to press: wrapped rows of chips are 4px apart, so the area reaches 2px and no further.
            "relative h-7 shrink-0 rounded-full border px-2.5 text-xs whitespace-nowrap transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-0.5",
            value === k
              ? "border-primary bg-primary font-bold text-primary-foreground"
              : "tile-edge hover:border-primary/60",
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
  tag,
  action,
  extra,
  cost,
  alts,
  unit,
  selected,
}: {
  label: string;
  /** Which preset the row goes for, when there are two ("드메"). */
  tag?: string;
  action?: string;
  /** Small lines under the move (one per entry). */
  extra?: string[];
  cost: string;
  /** The other natural move and how much more it leaves ("안 잠그면 +X"). */
  alts?: string;
  /** Say "남은 평균" under the cost (the first row of a step). */
  unit?: boolean;
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
        <span className="text-[13px] text-pretty">
          <b>{label}</b>
          {tag && (
            // 16px tall with 1px under: the 10px words' ink in the middle (they sat low in the bare inline box, design.md).
            <span className="ml-1.5 inline-flex h-4 items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1 pb-px text-[10px] font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-300">
              {tag}
            </span>
          )}
          {action ? ` → ${action}` : ""}
          {/* "안 잠그면 +9.7억" stays on one line when the row wraps. */}
          {alts && (
            <span className="text-[11px] text-muted-foreground">
              {" "}
              · <span className="whitespace-nowrap">{alts}</span>
            </span>
          )}
        </span>
        {extra?.map((x) => (
          <span key={x} className="text-[11px] text-pretty text-muted-foreground">
            {x}
          </span>
        ))}
      </span>
      <span className="flex flex-col items-end">
        <b className="font-num text-[13px] whitespace-nowrap">
          <Digits>{cost}</Digits>
        </b>
        {unit && <span className="text-[10px] text-muted-foreground">남은 평균</span>}
      </span>
    </div>
  );
}

/** One wanted line: grade badge (L legendary, U unique or better), option, wanted value. */
function GoalLine({ legend, label, value }: { legend: boolean; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2">
      <span
        {...extraTip(legend ? "레전드리" : "유니크 이상")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md font-num text-xs font-bold",
          legend
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
        )}
      >
        {legend ? "L" : "U"}
      </span>
      {/* A label: the option's name goes to the list of wanted values beside it. */}
      <label className="flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg tile-edge bg-background pr-1 pl-3 text-[13px]">
        <span data-tip={label} className="truncate">
          {label}
        </span>
        {value}
      </label>
    </div>
  );
}

function Box({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 tile p-3">
      <span className="text-[11px] text-muted-foreground">{k}</span>
      <b data-tip={v} className="truncate font-num text-base">
        <Digits>{v}</Digits>
      </b>
      <span data-tip={sub} className="truncate text-[11px] text-muted-foreground">
        {sub}
      </span>
    </div>
  );
}
