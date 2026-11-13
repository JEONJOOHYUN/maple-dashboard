"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Label, LuckRow, Note, NumberField, Panel, Segment, Switch, count, eok, parseNum, pct } from "@/components/ev/ui";
import { CustomGoal, condText } from "@/components/ev/custom-goal";
import { CREDIT_SHOP, STAT_CONV_DEFAULT } from "@/lib/ev/defaults";
import { averageTries } from "@/lib/ev/luck";
import { useStored } from "@/lib/use-stored";
import { type MainStat,
  CUBES,
  GRADE_LABEL,
  NEXT_GRADE,
  SLOTS,
  bestValues,
  convFromSpec,
  customChance,
  slotOptions,
  fixFirstLine,
  gradeUp,
  SOUL_EXTRA,
  WEAPON_TIERS,
  addWeaponChance,
  addWeaponNeed,
  lineTables,
  resetMeso,
  practicalTargets,
  sumChance,
  weaponChance,
  type AddWeaponGoal,
  type CubeId,
  type CustomCond,
  type Grade,
  type PotKind,
  type SumGoal,
  type WeaponGoal,
} from "@/lib/ev/potential";
import { cn } from "@/lib/utils";
import { koreanUnits } from "@/lib/format";

const GROUPS = [
  { id: "wpn", label: "무기" },
  { id: "arm", label: "방어구" },
  { id: "acc", label: "장신구" },
  { id: "soul", label: "소울" },
] as const;
const GRADES: Grade[] = ["rare", "epic", "unique", "legendary"];
const GRADE_COLOR: Record<Grade, string> = {
  rare: "border-sky-400 text-sky-600 dark:text-sky-300",
  epic: "border-violet-400 text-violet-600 dark:text-violet-300",
  unique: "border-amber-400 text-amber-600 dark:text-amber-300",
  legendary: "border-emerald-400 text-emerald-600 dark:text-emerald-300",
};
const TIERS = WEAPON_TIERS;
type Extra = "stat" | "cool" | "crit" | "drop";
// cd8 = what was typed in the main-potential "크뎀 8%" box; cd3 (the unit of the conversion fields) stays the source of truth.
type ConvText = Record<keyof typeof STAT_CONV_DEFAULT, string> & { cd8?: string };
const CONV_TEXT_DEFAULT = Object.fromEntries(Object.entries(STAT_CONV_DEFAULT).map(([k, v]) => [k, String(v)])) as ConvText;
const ADD_GOALS: { id: AddWeaponGoal; label: (need: number, a: string) => string }[] = [
  { id: "a21", label: (n, a) => `${a} ${n}%` },
  { id: "a21x", label: (n, a) => `${a} ${n}% + @` },
  { id: "a3", label: (_, a) => `${a} 3줄` },
];

export function PotentialTab() {
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("wpn");
  const [slotId, setSlotId] = useState("weapon");
  const [levelText, setLevelText] = useState("200");
  const [kind, setKind] = useState<Exclude<PotKind, "soul">>("main");
  const [grade, setGrade] = useState<Grade>("legendary");
  const [goal, setGoal] = useState<"grade" | "opt">("opt");
  // "옵션 띄우기": ready-made goals (프리셋) or options picked by hand (직접). Starts with one empty set.
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [customSets, setCustomSets] = useState<CustomCond[][]>([[]]);
  // No 공격력 / 마력 choice: the official table gives attack and magic lines the same values and chances on every slot
  // (188 pairs checked 2026-11-10), so every result is the same; labels say "공/마".
  const attack: "atk" | "matk" = "atk";
  // Xenon counts all stat %, Demon Avenger max HP % (own values and chances in the official table).
  const [mainStat, setMainStat] = useStored<MainStat>("ev:mainStat", "str");
  const [ied, setIed] = useState(true);
  const [min, setMin] = useState({ a: 0, b: 0, i: 0, v: 3 });
  const [tier, setTier] = useState<WeaponGoal["tier"]>("v3");
  const [addGoal, setAddGoal] = useState<AddWeaponGoal>("a21");
  const [extra, setExtra] = useState<Extra>("stat");
  const [targetIdx, setTargetIdx] = useState(1);
  // Gloves (crit damage) / hats (cooldown): how many lines of that option and of main stat (user, 2026-11-10, option B).
  const [combo, setCombo] = useState({ lines: 1, stat: 1 });
  const [soulStage, setSoulStage] = useState(4);
  const [chosen, setChosen] = useState<CubeId[] | null>(null);
  const [miracle, setMiracle] = useState(false);
  const [whiteUp, setWhiteUp] = useState(false);
  // Prime cube on a weapon (main potential): which line 1 is kept.
  const [primeFirst, setPrimeFirst] = useState<"a" | "b" | "i">("a");
  const [convText, setConvText] = useStored<ConvText>("ev:statConv", CONV_TEXT_DEFAULT);
  // Conversion inputs are detail most people never touch: closed until asked for (user, 2026-11-10).
  const [convOpen, setConvOpen] = useState(false);
  // Crit damage box in the line size people see: main potential 8 %, additional 3 % (user, 2026-11-10).
  const cdUnit = kind === "main" ? 8 : 3;
  const convChanged = (Object.keys(CONV_TEXT_DEFAULT) as (keyof typeof STAT_CONV_DEFAULT)[]).some((k) => (convText[k] ?? "") !== CONV_TEXT_DEFAULT[k]);
  const [customMin, setCustomMin] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const slot = SLOTS.find((s) => s.id === slotId)!;
  const soul = slot.kind === "soul";
  const weaponLike = slot.kind === "weapon" || slot.kind === "sub" || slot.kind === "emblem";
  const level = Math.max(1, Math.round(parseNum(levelText, 200)));
  const potKind: PotKind = soul ? "soul" : kind;
  const cubes = CUBES.filter((c) => c.kind === potKind);
  // Start with the in-game resets only (the ones everyone has); cash cubes are opt-in for comparing.
  const picked = (chosen ?? cubes.filter((c) => c.name.includes("재설정")).map((c) => c.id)).filter((id) => cubes.some((c) => c.id === id));
  const conv = useMemo(() => {
    const n = (k: keyof typeof STAT_CONV_DEFAULT) => parseNum(convText[k] ?? "", STAT_CONV_DEFAULT[k]);
    return convFromSpec({ level: n("level"), v9: n("v9"), cd3: n("cd3"), atk1: n("atk1"), all1: n("all1") });
  }, [convText]);

  const extraOptions: { id: Extra; label: string }[] = [
    // Gloves: the main-stat target converts crit damage lines too (efficiency), so say so (user, 2026-11-10).
    { id: "stat", label: slot.extra === "crit" ? "효율 환산" : "주스탯" },
    ...(slot.extra === "cool" ? [{ id: "cool" as const, label: "쿨감" }] : []),
    ...(slot.extra === "crit" ? [{ id: "crit" as const, label: "크뎀" }] : []),
    ...(slot.extra === "drop" ? [{ id: "drop" as const, label: "드메" }] : []),
  ];
  const target: Extra = extraOptions.some((o) => o.id === extra) ? extra : "stat";

  // Reference table for the chips (black cube / white for additional, legendary).
  const refRows = useMemo(
    () => (soul ? null : lineTables(kind === "main" ? "black" : "white", grade === "unique" ? "unique" : "legendary", slotId, level)),
    [soul, kind, grade, slotId, level]
  );
  const best = refRows ? bestValues(refRows) : {};
  const options = useMemo(() => (refRows ? slotOptions(refRows) : []), [refRows]);
  // What was picked on another slot · grade may not exist here: drop it, and move totals to one this table can reach.
  const sets = useMemo(
    () =>
      customSets.map((set) =>
        set.flatMap((c) => {
          const o = options.find((x) => x.cat === c.cat);
          return o ? [{ cat: c.cat, min: o.sums.find((s) => s >= c.min) ?? o.sums[o.sums.length - 1] }] : [];
        })
      ),
    [customSets, options]
  );
  const firstCond = sets.find((s) => s.length)?.[0];
  // Prime first line picked on a weapon may not exist on the slot now (emblems have no boss line).
  const primeLine = primeFirst === "b" && !best.boss ? "a" : primeFirst;
  const sumTargets: { label: string; sub: string; goal: SumGoal }[] = useMemo(() => {
    if (!refRows) return [];
    if (target === "stat") {
      const chips = practicalTargets(refRows, { conv, attack, main: mainStat }, kind === "add" ? 2 : 3).map((n) => ({ label: `${n}%`, sub: "이상", goal: { type: "stat", min: n, conv, attack, main: mainStat } as SumGoal }));
      const own = parseNum(customMin, 0);
      return own > 0 ? [...chips, { label: `${own}%`, sub: "직접", goal: { type: "stat", min: own, conv, attack, main: mainStat } as SumGoal }] : chips;
    }
    if (target === "cool") return [2, 3, 4, 5, 6].map((n) => ({ label: `−${n}초`, sub: "이상", goal: { type: "cool", min: n } as SumGoal }));
    if (target === "crit") return [1, 2, 3].map((n) => ({ label: `${n}줄`, sub: best.cd ? `+${best.cd * n}%` : "", goal: { type: "crit", lines: n } as SumGoal }));
    return [1, 2, 3].map((n) => ({ label: `${n}줄`, sub: "이상", goal: { type: "drop", lines: n } as SumGoal }));
  }, [refRows, target, best.cd, conv, attack, customMin, mainStat, kind]);
  const tIdx = Math.min(targetIdx, Math.max(0, sumTargets.length - 1));
  const comboSpecial = target === "crit" ? "cd" : target === "cool" ? "cool" : null;
  // Hats: cooldown is asked by its total seconds (−2초 and −1초 = 3초), the way the 강화 기록 page reads an option
  // (user, 2026-11-12) — `combo.lines` is then seconds. Gloves still count crit damage lines.
  const bySeconds = comboSpecial === "cool";
  const coolTop = Math.max(1, best.cool ?? 1);
  /** Lines the special option needs at the least: every cooldown line at its top value. */
  const specialLines = (n: number) => (bySeconds ? Math.ceil(n / coolTop) : n);
  // A total picked on another grade may be out of reach here (unique hats only have −1초 lines).
  const special = bySeconds ? Math.max(1, Math.min(combo.lines, coolTop * (3 - combo.stat))) : combo.lines;
  const comboGoal: SumGoal | null = !comboSpecial
    ? null
    : bySeconds
      ? { type: "combo", special: "cool", lines: 1, stat: combo.stat, main: mainStat, minSum: special }
      : { type: "combo", special: comboSpecial, lines: combo.lines, stat: combo.stat, main: mainStat, minSpecial: 3 };
  const comboRest = 3 - specialLines(special) - combo.stat;
  const specialName = comboSpecial === "cd" ? "크뎀" : "쿨감";
  const mainName = mainStat === "all" ? "올스탯" : mainStat === "hp" ? "HP" : "주스탯";
  const comboText = [`${specialName} ${special}${bySeconds ? "초" : "줄"}`, combo.stat ? `${mainName} ${combo.stat}줄` : "", comboRest ? `아무 옵션 ${comboRest}줄` : ""]
    .filter(Boolean)
    .join(" + ");
  // Lowest value of an option in this table: what "any value" means on screen (user, 2026-11-10: "올스탯 6% 이상").
  const lowest = (cat: string) => {
    const vals = (refRows ?? []).flat().filter((r) => r[0] === cat).map((r) => r[1]);
    return vals.length ? Math.min(...vals) : 0;
  };
  const setComboPart = (k: "lines" | "stat", v: number) => {
    // Steps start from what is on screen (a total clamped to this grade), not from the number kept underneath.
    const next = { lines: special, stat: combo.stat, [k]: v };
    if (next.lines < 1 || next.stat < 0 || specialLines(next.lines) + next.stat > 3) return;
    setCombo(next);
  };

  const weaponGoal: WeaponGoal = { attack, ied, min, tier: kind === "main" ? tier : "v3" };
  const optGrade = grade === "rare" || grade === "epic" ? null : grade;
  // Table the weapon chips show their chance with (the meso reset's, as its result card).
  const blackRows = optGrade ? lineTables("black", optGrade, slotId, level) : null;
  const custom = goal === "opt" && !soul && !!optGrade && mode === "custom";
  const soulRows = soul ? lineTables("soul", grade, "soul", soulStage) : null;
  const soulNeed = soulRows ? addWeaponNeed(soulRows, attack) : 0;

  // Line 1 a prime cube keeps: the best value of what the goal is after.
  const firstCat: Record<string, string> = { stat: mainStat, cool: "cool", crit: "cd", drop: "drop" };
  function primeFirstLabel(rows: ReturnType<typeof lineTables>): string {
    if (!rows) return "";
    const top = bestValues([rows[0]]);
    if (weaponLike) {
      const cat = kind === "add" || primeLine === "a" ? attack : primeLine === "b" ? "boss" : "ied";
      const name = cat === "atk" ? "공격력" : cat === "matk" ? "마력" : cat === "boss" ? "보공" : "방무";
      return `${name} ${top[cat] ?? 0}%`;
    }
    const cat = firstCat[target];
    const name = { str: "주스탯", all: "올스탯", hp: "HP", cool: "쿨감", cd: "크뎀", drop: "드롭률" }[cat] ?? "";
    return `${name} ${top[cat] ?? 0}${cat === "cool" ? "초" : "%"}`;
  }

  function optionChance(cube: CubeId): number {
    if (soul) {
      const rows = lineTables("soul", grade, "soul", soulStage);
      return rows ? addWeaponChance(rows, attack, addGoal, false, SOUL_EXTRA) : 0;
    }
    if (!optGrade) return 0;
    const prime = CUBES.find((c) => c.id === cube)?.fixFirst ?? false;
    if (prime && optGrade !== "legendary") return 0;
    const rows = lineTables(cube, optGrade, slotId, level);
    if (!rows) return 0;
    if (custom) {
      if (!firstCond) return 0;
      if (!prime) return customChance(rows, sets);
      // A prime cube keeps line 1: the best value of the first option picked.
      const top = bestValues([rows[0]])[firstCond.cat];
      return top ? customChance(fixFirstLine(rows, firstCond.cat, top), sets) : 0;
    }
    if (weaponLike)
      return kind === "add" ? addWeaponChance(rows, attack, addGoal, prime) : weaponChance(rows, weaponGoal, prime ? primeLine : undefined);
    const g = comboGoal ?? sumTargets[tIdx]?.goal;
    if (!g) return 0;
    if (!prime) return sumChance(rows, g);
    const cat = firstCat[target];
    return sumChance(fixFirstLine(rows, cat, bestValues([rows[0]])[cat] ?? 0), g);
  }

  const results = cubes
    .filter((c) => picked.includes(c.id))
    .map((c) => {
      // Meso resets cost what the game charges; cash cubes (and the white cube) need a price typed in.
      const shopEok = CREDIT_SHOP.find((x) => x.id === c.id)?.auctionEok;
      const auto = c.fixFirst ? (shopEok ? shopEok * 1e8 : null) : whiteUp && goal === "grade" && c.upAlt ? null : resetMeso(c.id, grade, soul ? 0 : level);
      const fixed = auto !== null && !c.fixFirst;
      const typed = parseNum(prices[c.id] ?? "", 0) * 1e8;
      const price = fixed ? (auto as number) : typed > 0 ? typed : auto ?? 0;
      const cost = (n: number) => (price > 0 ? `${eok(n * price)} 메소` : `${koreanUnits(n)}번`);
      if (goal === "grade") {
        const next = NEXT_GRADE[grade];
        if (!next) return { cube: c, p: 0, cap: 0, price, auto, fixed, cost, note: "이미 최고 등급" };
        const alt = whiteUp && !!c.upAlt;
        const up = gradeUp(c.id, grade, miracle, alt);
        if (!up) return { cube: c, p: 0, cap: 0, price, auto, fixed, cost, note: c.fixFirst ? "등급 올리기 불가" : `${GRADE_LABEL[next]}까지 불가` };
        return { cube: c, p: up.p, cap: up.cap, price, auto, fixed, cost, note: alt ? "화이트 에디셔널 큐브" : "" };
      }
      const p = optionChance(c.id);
      const note = c.fixFirst
        ? optGrade === "legendary"
          ? custom
            ? p
              ? `첫 줄 ${condText(options.find((o) => o.cat === firstCond?.cat), bestValues([lineTables(c.id, "legendary", slotId, level)?.[0] ?? []])[firstCond?.cat ?? ""] ?? 0)} 고정 · 경매장 가격 기준`
              : firstCond
                ? "첫 줄에 안 뜨는 옵션"
                : "옵션을 고르면 계산"
            : `첫 줄 ${primeFirstLabel(lineTables(c.id, "legendary", slotId, level))} 고정 · 경매장 가격 기준`
          : "레전드리 전용"
        : !p
          ? soul
            ? ""
            : !optGrade
              ? "유니크 · 레전드리만 계산"
              : custom
                ? firstCond
                  ? "이 방법으로는 안 뜨는 옵션"
                  : "옵션을 고르면 계산"
              : `${GRADE_LABEL[optGrade]} 옵션 불가`
          : "";
      return { cube: c, p, cap: 0, price, auto, fixed, cost, note };
    });

  // Cheapest in meso first (then fewest tries); cards without a chance go last.
  const costOf = (r: (typeof results)[number]) => (r.p > 0 ? averageTries(r.p, r.cap) * (r.price > 0 ? r.price : 1e30) : Infinity);
  results.sort((a, b) => costOf(a) - costOf(b) || b.p - a.p);

  const goalText =
    goal === "grade"
      ? NEXT_GRADE[grade]
        ? `${slot.label} · ${GRADE_LABEL[grade]} → ${GRADE_LABEL[NEXT_GRADE[grade]!]}`
        : `${slot.label} · 이미 레전드리`
      : soul
        ? `${GRADE_LABEL[grade]} 소울 · 증폭 ${soulStage}단계 · ${ADD_GOALS.find((g) => g.id === addGoal)!.label(soulNeed, "공/마")}`
        : custom
          ? `${kind === "add" ? "에디셔널 " : ""}${GRADE_LABEL[grade]} ${slot.label} · ${
              sets
                .filter((s) => s.length)
                .map((s) => s.map((c) => condText(options.find((o) => o.cat === c.cat), c.min)).join(" + "))
                .join(" 또는 ") || "옵션 고르기"
            }`
        : weaponLike && kind === "add"
          ? `에디셔널 ${GRADE_LABEL[grade]} ${slot.label} · ${ADD_GOALS.find((g) => g.id === addGoal)!.label(21, "공/마")}`
          : weaponLike
          ? `${GRADE_LABEL[grade]} ${slot.label} · ${
              [
                min.a ? `${"공/마"} ${min.a}줄` : "",
                min.b ? `보공 ${min.b}줄` : "",
                min.i ? `방무 ${min.i}줄` : "",
                min.v ? `유효 ${min.v}줄${ied ? "" : " (방무 제외)"}` : "",
              ]
                .filter(Boolean)
                .join(" + ") || "아무 줄"
            }${weaponGoal.tier === "v3" ? "" : ` · ${TIERS.find((t) => t.id === weaponGoal.tier)!.label}`}`
          : comboGoal
            ? `${GRADE_LABEL[grade]} ${slot.label} · ${comboText}`
            : `${GRADE_LABEL[grade]} ${slot.label} · ${extraOptions.find((o) => o.id === target)!.label} ${sumTargets[tIdx]?.label ?? ""} ${sumTargets[tIdx]?.sub ?? ""}`;

  // No "%" in the name: the range under it ("+9% ~ +12%") already says which line (user, 2026-11-14).
  const attackName = "공격력(마력)";
  // The values a line of the option can have, low to high: any of them counts (user, 2026-11-14: "+9% ~ +12%").
  const range = (cat: string) => (!best[cat] ? "" : lowest(cat) < best[cat] ? `+${lowest(cat)}% ~ +${best[cat]}%` : `+${best[cat]}%`);
  const steppers = (
    [
      ["a", attackName, range(attack)],
      ["b", "보스 데미지", range("boss")],
      ["i", "방어율 무시", range("ied")],
      ["v", "합쳐서 유효 줄", ied ? "위 옵션 아무거나" : "방무 빼고"],
    ] as const
  ).filter(([k]) => !(k === "b" && !best.boss));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <Label aside={<span className="text-xs font-semibold text-primary-text">{slot.label}</span>}>장비</Label>
        <Segment
          label="장비 묶음"
          value={group}
          onChange={(g) => {
            setGroup(g);
            setCombo({ lines: 1, stat: 1 });
            const first = SLOTS.find((s) => s.group === g)!;
            setSlotId(first.id);
            setChosen(null);
            setMin({ a: 0, b: 0, i: 0, v: 3 });
            setTier("v3");
          }}
          options={GROUPS.map((g) => ({ id: g.id, label: `${g.label} ${SLOTS.filter((s) => s.group === g.id).length}` }))}
        />
        <div className="grid grid-cols-3 gap-1.5">
          {SLOTS.filter((s) => s.group === group).map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === slotId}
              onClick={() => {
                setCombo({ lines: 1, stat: 1 });
                setSlotId(s.id);
                // Gloves are usually rolled for critical damage.
                setExtra(s.id === "gloves" ? "crit" : "stat");
                setTargetIdx(1);
                // Emblems have no boss line; drop goals the new slot cannot show.
                setMin({ a: 0, b: 0, i: 0, v: 3 });
                setTier("v3");
              }}
              className={cn(
                "flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left",
                s.id === slotId ? "border-primary bg-primary-soft" : "border-border hover:border-primary/60"
              )}
            >
              <b className={cn("text-[13px]", s.id === slotId && "text-primary-text")}>{s.label}</b>
              <span className="truncate text-[11px] text-muted-foreground">{s.sub}</span>
            </button>
          ))}
        </div>

        {soul ? (
          null
        ) : (
          // Level on the left, the potential kind at the right edge: in line with the switches under it (user, 2026-11-13).
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                장비 레벨
                <NumberField label="장비 레벨" value={levelText} onChange={setLevelText} inputClassName="w-16" />
              </span>
              {level < 120 && <span className="text-xs text-destructive">120레벨 이상 장비만</span>}
            </span>
            <Segment
              label="잠재 종류"
              value={kind}
              onChange={(k) => {
                setKind(k);
                setChosen(null);
              }}
              options={[
                { id: "main", label: "윗잠" },
                { id: "add", label: "에디셔널" },
              ]}
              className="w-44"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>지금 등급</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={g === grade}
                onClick={() => setGrade(g)}
                className={cn("h-9 rounded-lg border text-[13px]", g === grade ? cn("border-[1.5px] font-bold", GRADE_COLOR[g]) : "border-border text-muted-foreground")}
              >
                {GRADE_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
        <Segment
          label="목표"
          value={goal}
          onChange={setGoal}
          options={[
            { id: "grade", label: "등급 올리기" },
            { id: "opt", label: "옵션 띄우기" },
          ]}
        />

        {goal === "opt" && !soul && optGrade && (
          <Label
            aside={
              <Segment
                label="옵션 고르는 방법"
                value={mode}
                onChange={setMode}
                options={[
                  { id: "preset", label: "프리셋" },
                  { id: "custom", label: "직접" },
                ]}
                className="w-40"
              />
            }
          >
            노리는 옵션
          </Label>
        )}
        {custom && (
          <CustomGoal
            options={options}
            sets={sets}
            onChange={setCustomSets}
            chanceOf={(set) => (refRows ? customChance(refRows, [set]) : 0)}
            slotLabel={slot.label}
            gradeLabel={GRADE_LABEL[grade]}
          />
        )}

        {goal === "opt" && weaponLike && optGrade && mode === "preset" && (
          <div className="@container flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <Label>
              노리는 줄
            </Label>
            {kind === "main" && (
              // Five in a row once each chip has room for its name ("꽉이탈 3줄" needs about 80px: 27rem for the row);
              // narrower, 3 + 2 on half-width tracks with the last two in the middle, like the boss split's five
              // cards, every chip the same size (user, 2026-11-14 — at a 1280px window the names broke in two).
              <div className="grid grid-cols-6 gap-1.5 @min-[27rem]:grid-cols-5">
                {TIERS.map((t, i) => {
                  // The tier and the line counts below are separate choices ("반이탈 + 보공 2줄", user 2026-11-14): a chip
                  // stays picked while the counts change, and its chance is with them. "유효 3줄" is itself a line count,
                  // so it is picked only at three useful lines and picking it asks for three.
                  const chipMin = t.id === "v3" ? { ...min, v: 3 } : min;
                  const on = tier === t.id && (t.id !== "v3" || min.v === 3);
                  const p = blackRows ? weaponChance(blackRows, { attack, ied, min: chipMin, tier: t.id }) : 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setTier(t.id);
                        setMin(chipMin);
                      }}
                      className={cn(
                        "col-span-2 flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left @min-[27rem]:col-span-1",
                        i === 3 && "col-start-2 @min-[27rem]:col-start-auto",
                        on ? "border-primary bg-primary-soft text-primary-text" : "border-border"
                      )}
                    >
                      <b className="text-[13px]">{t.label}</b>
                      <span className="font-num text-[11px] text-muted-foreground">{pct(p)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* The rules are written for three useful lines; say the count asked for when it was lowered. */}
            {kind === "main" && tier !== "v3" && (
              <span className="text-[11px] text-muted-foreground">
                {TIERS.find((t) => t.id === tier)!.desc.replace("유효 3줄", min.v ? `유효 ${min.v}줄` : "아무 줄")}
              </span>
            )}
            {kind === "add" && (
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {ADD_GOALS.map((g) => {
                    const rows = lineTables("white", optGrade, slotId, level);
                    const p = rows ? addWeaponChance(rows, attack, g.id) : 0;
                    const need = rows ? addWeaponNeed(rows, attack) : 21;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={addGoal === g.id}
                        onClick={() => setAddGoal(g.id)}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left",
                          addGoal === g.id ? "border-primary bg-primary-soft text-primary-text" : "border-border"
                        )}
                      >
                        <b className="text-[13px]">{g.label(need, "공/마")}</b>
                        <span className="font-num text-[11px] text-muted-foreground">{pct(p)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {kind === "main" && picked.includes("prime") && optGrade === "legendary" && (
              <Label
                aside={
                  <Segment
                    label="프라임 큐브 고정된 첫 줄"
                    value={primeLine}
                    onChange={setPrimeFirst}
                    options={[
                      { id: "a" as const, label: "공격력(마력)" },
                      ...(best.boss ? [{ id: "b" as const, label: "보공" }] : []),
                      { id: "i" as const, label: "방무" },
                    ]}
                    className="w-48"
                  />
                }
              >
                프라임 큐브 첫 줄
              </Label>
            )}
            {kind === "main" && steppers.map(([k, label, note]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <b className="text-[13px]">{label}</b>
                  {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${label} 줄이기`}
                    onClick={() => setMin({ ...min, [k]: Math.max(0, min[k] - 1) })}
                    className="flex size-8 items-center justify-center rounded-md border border-border"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <b className="w-6 text-center font-num">{min[k]}</b>
                  <button
                    type="button"
                    aria-label={`${label} 늘리기`}
                    onClick={() => setMin({ ...min, [k]: Math.min(3, min[k] + 1) })}
                    className="flex size-8 items-center justify-center rounded-md border border-border"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
            {kind === "main" && (
              <Switch on={ied} onChange={setIed} label="방무도 유효 줄로 치기" />
            )}
          </div>
        )}

        {goal === "opt" && !weaponLike && !soul && optGrade && mode === "preset" && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <Label
              aside={
                extraOptions.length > 1 ? (
                  <Segment
                    label="노릴 옵션"
                    value={target}
                    onChange={(t) => {
                      setExtra(t);
                      setTargetIdx(1);
                    }}
                    options={extraOptions}
                    className="w-36"
                  />
                ) : undefined
              }
            >
              {slot.label} · 노릴 옵션 · Lv.{level}
            </Label>
            {(target === "stat" || comboSpecial) && (
              <Segment
                label="주스탯 종류"
                value={mainStat}
                onChange={(m) => {
                  setMainStat(m);
                  setTargetIdx(1);
                }}
                options={[
                  { id: "str", label: "일반" },
                  { id: "all", label: "제논 · 올스탯" },
                  { id: "hp", label: "데벤 · HP" },
                ]}
              />
            )}
            {/* No 공격력 / 마력 choice here: in the official table the flat attack and magic lines have the same values and
                chances on every slot (188 pairs checked 2026-11-10), so the result is the same either way. */}
            {/* One row, split evenly by however many targets there are (4 presets + an own target). */}
            {comboSpecial ? (
              <div className="flex flex-col gap-2">
                {(
                  [
                    // Main potential has crit damage 8 % only; additional has 1 % and 3 %, and only 3 % counts.
                    ["lines", bySeconds ? "쿨감 합" : `${specialName} 줄`, comboSpecial === "cd" ? (kind === "main" ? `크리티컬 데미지 ${lowest("cd")}%` : "크리티컬 데미지 3% 이상") : lowest("cool") === coolTop ? `한 줄 −${coolTop}초` : `한 줄 −${lowest("cool")} ~ −${coolTop}초`],
                    // An all stat % line raises the main stat too, so it counts as a main stat line (user, 2026-11-12).
                    ["stat", `${mainName} 줄`, mainStat === "str" ? `주스탯 ${lowest("str")}% 이상 · 올스탯 포함` : `${mainName} ${lowest(mainStat)}% 이상`],
                  ] as const
                ).map(([k, label, note]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <b className="text-[13px]">{label}</b>
                      <span className="text-[11px] text-muted-foreground">{note}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`${label} 줄이기`}
                        onClick={() => setComboPart(k, (k === "lines" ? special : combo.stat) - 1)}
                        className="flex size-8 items-center justify-center rounded-md border border-border"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <b className={cn("text-center font-num", k === "lines" && bySeconds ? "w-10" : "w-6")}>{k === "lines" ? (bySeconds ? `${special}초` : special) : combo.stat}</b>
                      <button
                        type="button"
                        aria-label={`${label} 늘리기`}
                        onClick={() => setComboPart(k, (k === "lines" ? special : combo.stat) + 1)}
                        className="flex size-8 items-center justify-center rounded-md border border-border"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                ))}
                <span className="text-[11px] text-muted-foreground">
                  {comboRest ? `나머지 ${comboRest}줄은 아무 옵션이어도 됨` : "3줄 모두 지정"} · 합쳐서 3줄까지
                </span>
              </div>
            ) : (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, sumTargets.length)}, minmax(0, 1fr))` }}>
                {sumTargets.map((t, i) => (
                  <button
                    key={t.label}
                    type="button"
                    aria-pressed={i === tIdx}
                    onClick={() => setTargetIdx(i)}
                    className={cn("flex flex-col items-start rounded-lg border px-2.5 py-1.5", i === tIdx ? "border-primary bg-primary-soft text-primary-text" : "border-border")}
                  >
                    <b className="font-num text-[13px]">{t.label}</b>
                    <span className="text-[11px] text-muted-foreground">{t.sub}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Shown for every main-stat type (Codex review): e.g. HP 21 % (12 + 9) is not one of the chips. */}
            {target === "stat" && (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                목표 직접
                <NumberField
                  label={mainStat === "str" ? "주스탯 환산 목표 직접 입력" : `${mainStat === "all" ? "올스탯" : "HP"} 목표 직접 입력`}
                  value={customMin}
                  onChange={(t) => {
                    setCustomMin(t);
                    if (parseNum(t, 0) > 0) setTargetIdx(99);
                  }}
                  decimal
                  suffix="%"
                  inputClassName="h-8 w-20 text-xs"
                />
                <span className="font-normal text-muted-foreground">이상</span>
              </span>
            )}
            {target === "stat" && mainStat === "str" && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setConvOpen((o) => !o)}
                    aria-expanded={convOpen}
                    className="flex items-center gap-1 text-[12px] font-bold"
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform", !convOpen && "-rotate-90")} aria-hidden="true" />
                    환산 기준
                    {!convOpen && <span className="font-normal text-muted-foreground">· {convChanged ? "바꾼 값 사용 중" : "기본값"}</span>}
                  </button>
                </div>
                {convOpen && (
                <>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      ["level", "캐릭터 레벨", "", ""],
                      ["v9", "렙당+2 = 주스탯", "%", `렙당+1 = ${conv.lvstr.toFixed(2)}%`],
                      ["cd3", `크뎀 ${cdUnit}% = 주스탯`, "%", `크뎀 1% = ${conv.cd.toFixed(2)}%`],
                      ["atk1", "공격력(마력) 1 = 주스탯", "", ""],
                      ["all1", "올스탯 1% = 주스탯", "", ""],
                    ] as const
                  ).map(([k, label, unit, hint]) => (
                    <span key={k} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[12px] font-semibold">{label}</span>
                        {hint && <span className="font-num text-[11px] text-muted-foreground">{hint}</span>}
                      </span>
                      <NumberField
                        label={label}
                        value={k === "cd3" && cdUnit === 8 ? (convText.cd8 ?? String(Math.round(conv.cd * 8 * 100) / 100)) : (convText[k] ?? "")}
                        onChange={(t) =>
                          setConvText(
                            k !== "cd3"
                              ? { ...convText, [k]: t }
                              : cdUnit === 8
                                ? { ...convText, cd8: t, cd3: String(Math.round((parseNum(t, 0) * 3) / 8 * 10000) / 10000) }
                                : { ...convText, cd3: t, cd8: undefined },
                          )
                        }
                        decimal={k !== "level"}
                        suffix={unit || undefined}
                        inputClassName="h-8 w-20 text-xs"
                      />
                    </span>
                  ))}
                </div>
                <span className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                  <button type="button" onClick={() => setConvText(CONV_TEXT_DEFAULT)} className="rounded border border-border px-2 py-0.5">
                    기본값으로
                  </button>
                </span>
                </>
                )}
              </div>
            )}
          </div>
        )}

        {goal === "opt" && soul && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <Label>
              소울 증폭 단계
            </Label>
            <Segment
              label="소울 증폭 단계"
              value={String(soulStage)}
              onChange={(v) => setSoulStage(Number(v))}
              options={[1, 2, 3, 4].map((n) => ({ id: String(n), label: `${n}단계` }))}
            />
            <div className="grid grid-cols-3 gap-1.5">
              {ADD_GOALS.map((g) => {
                const rows = lineTables("soul", grade, "soul", soulStage);
                const p = rows ? addWeaponChance(rows, attack, g.id, false, SOUL_EXTRA) : 0;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={addGoal === g.id}
                    onClick={() => setAddGoal(g.id)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left",
                      addGoal === g.id ? "border-primary bg-primary-soft text-primary-text" : "border-border"
                    )}
                  >
                    <b className="text-[13px]">{g.label(soulNeed, "공/마")}</b>
                    <span className="font-num text-[11px] text-muted-foreground">{pct(p)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>무엇으로 돌릴까 · 여러 개 고르면 비교</Label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {cubes.map((c) => {
              const on = picked.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChosen(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                  className={cn("flex flex-col items-start rounded-lg border px-3 py-2 text-left", on ? "border-primary bg-primary-soft" : "border-border")}
                >
                  <b className={cn("text-[13px]", on && "text-primary-text")}>{c.name}</b>
                  <span className="text-[11px] text-muted-foreground">{c.alias}</span>
                </button>
              );
            })}
          </div>
        </div>
        {goal === "grade" && potKind === "add" && (
          <Switch
            on={whiteUp}
            onChange={setWhiteUp}
            label="화이트 에디셔널 큐브로 올리기"
            note="등급 상승 확률 2배 · 천장 31 · 76 · 214번"
          />
        )}
        {goal === "grade" && <Switch on={miracle} onChange={setMiracle} label="미라클 타임" note="등급 상승 확률 2배" />}
      </Panel>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
          <span className="text-muted-foreground">목표 </span>
          <b>{goalText}</b>
        </div>
        {results.length === 0 && <Note>큐브 1개 이상 선택</Note>}
        {results.map((r, i) => {
          const avg = r.p ? averageTries(r.p, r.cap) : Infinity;
          return (
            <div key={r.cube.id} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", i === 0 && r.p ? "border-primary" : "border-border", !r.p && "opacity-70")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[15px]">{r.cube.name}</b>
                  <span className="text-xs text-muted-foreground">{r.cube.alias}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  1번에 될 확률 <b className="font-num text-foreground">{r.p ? pct(r.p) : "불가"}</b>
                </span>
              </div>
              {r.p > 0 && (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {r.price > 0 ? (
                      <>
                        <span className="font-num text-[34px] leading-none font-bold text-primary-text">
                          {eok(avg * r.price)}
                          <span className="ml-1 text-sm">메소</span>
                        </span>
                        <b className="font-num">평균 {count(avg, "번")}</b>
                      </>
                    ) : (
                      <span className="font-num text-[34px] leading-none font-bold text-primary-text">
                        {count(avg, "")}
                        <span className="ml-1 text-sm">번</span>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{r.cap ? `${r.cap}번이면 확정` : r.price > 0 ? "" : "평균"}</span>
                  </div>
                  <LuckRow p={r.p} cap={r.cap} cost={r.price > 0 ? r.cost : undefined} />
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{r.note}</span>
                {r.fixed ? (
                  <span className="text-[11px] text-muted-foreground">
                    1번 <b className="font-num text-foreground">{eok(r.price)}</b> 메소
                  </span>
                ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  1번 가격
                  <NumberField
                    label={`${r.cube.name} 1번 가격 (억 메소)`}
                    value={prices[r.cube.id] ?? ""}
                    onChange={(t) => setPrices({ ...prices, [r.cube.id]: t })}
                    placeholder={r.auto ? String(Math.round((r.auto / 1e8) * 10000) / 10000) : ""}
                    decimal
                    suffix="억"
                    inputClassName="h-8 w-16 text-xs"
                  />
                </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
