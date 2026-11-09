"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Label, LuckRow, Note, NumberField, Panel, Segment, Switch, count, eok, parseNum, pct } from "@/components/ev/ui";
import { CREDIT_SHOP, STAT_CONV_DEFAULT } from "@/lib/ev/defaults";
import { averageTries } from "@/lib/ev/luck";
import { useStored } from "@/lib/use-stored";
import { type MainStat,
  CUBES,
  GRADE_LABEL,
  NEXT_GRADE,
  SLOTS,
  bestValues,
  convFromScouter,
  fixFirstLine,
  gradeUp,
  SOUL_EXTRA,
  addWeaponChance,
  addWeaponNeed,
  lineTables,
  resetMeso,
  statTargets,
  sumChance,
  weaponChance,
  type AddWeaponGoal,
  type CubeId,
  type Grade,
  type PotKind,
  type SumGoal,
  type WeaponGoal,
} from "@/lib/ev/potential";
import { cn } from "@/lib/utils";

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
const TIERS: { id: WeaponGoal["tier"]; label: string; desc: string }[] = [
  { id: "v3", label: "유효 3줄", desc: "등급 상관없이 세 줄 모두 유효" },
  { id: "half", label: "반이탈", desc: "유효 3줄 + 2 · 3번째 줄 중 1줄 이상 레전드리 수치" },
  { id: "one", label: "이탈 1줄", desc: "유효 3줄 + 2 · 3번째 줄 중 1줄 이상 최고 수치" },
  { id: "two", label: "이탈 2줄", desc: "유효 3줄 + 2 · 3번째 줄 모두 최고 수치" },
  { id: "all", label: "올이탈", desc: "세 줄 모두 최고 수치" },
];
type Extra = "stat" | "cool" | "crit" | "drop";
type ConvText = Record<keyof typeof STAT_CONV_DEFAULT, string>;
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
  const convChanged = (Object.keys(CONV_TEXT_DEFAULT) as (keyof ConvText)[]).some((k) => (convText[k] ?? "") !== CONV_TEXT_DEFAULT[k]);
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
    const n = (k: keyof ConvText) => parseNum(convText[k] ?? "", STAT_CONV_DEFAULT[k]);
    return convFromScouter({ level: n("level"), v9: n("v9"), cd3: n("cd3"), atk1: n("atk1"), all1: n("all1") });
  }, [convText]);

  const extraOptions: { id: Extra; label: string }[] = [
    { id: "stat", label: "주스탯" },
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
  // Prime first line picked on a weapon may not exist on the slot now (emblems have no boss line).
  const primeLine = primeFirst === "b" && !best.boss ? "a" : primeFirst;
  const sumTargets: { label: string; sub: string; goal: SumGoal }[] = useMemo(() => {
    if (!refRows) return [];
    if (target === "stat") {
      const chips = statTargets(refRows, mainStat).map((n) => ({ label: `${n}%`, sub: "이상", goal: { type: "stat", min: n, conv, attack, main: mainStat } as SumGoal }));
      const own = parseNum(customMin, 0);
      return own > 0 ? [...chips, { label: `${own}%`, sub: "직접", goal: { type: "stat", min: own, conv, attack, main: mainStat } as SumGoal }] : chips;
    }
    if (target === "cool") return [2, 3, 4, 5, 6].map((n) => ({ label: `−${n}초`, sub: "이상", goal: { type: "cool", min: n } as SumGoal }));
    if (target === "crit") return [1, 2, 3].map((n) => ({ label: `${n}줄`, sub: best.cd ? `+${best.cd * n}%` : "", goal: { type: "crit", lines: n } as SumGoal }));
    return [1, 2, 3].map((n) => ({ label: `${n}줄`, sub: "이상", goal: { type: "drop", lines: n } as SumGoal }));
  }, [refRows, target, best.cd, conv, attack, customMin, mainStat]);
  const tIdx = Math.min(targetIdx, Math.max(0, sumTargets.length - 1));
  const comboSpecial = target === "crit" ? "cd" : target === "cool" ? "cool" : null;
  const comboGoal: SumGoal | null = comboSpecial ? { type: "combo", special: comboSpecial, lines: combo.lines, stat: combo.stat, main: mainStat } : null;
  const comboRest = 3 - combo.lines - combo.stat;
  const specialName = comboSpecial === "cd" ? "크뎀" : "쿨감";
  const mainName = mainStat === "all" ? "올스탯" : mainStat === "hp" ? "HP" : "주스탯";
  const comboText = [`${specialName} ${combo.lines}줄`, combo.stat ? `${mainName} ${combo.stat}줄` : "", comboRest ? `아무 옵션 ${comboRest}줄` : ""]
    .filter(Boolean)
    .join(" + ");
  const setComboPart = (k: "lines" | "stat", v: number) => {
    const next = { ...combo, [k]: v };
    if (next.lines < 1 || next.stat < 0 || next.lines + next.stat > 3) return;
    setCombo(next);
  };

  const isV3 = min.a === 0 && min.b === 0 && min.i === 0 && min.v === 3;
  const weaponGoal: WeaponGoal = { attack, ied, min, tier: kind === "main" ? tier : "v3" };
  const optGrade = grade === "rare" || grade === "epic" ? null : grade;
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
      const cost = (n: number) => (price > 0 ? `${eok(n * price)} 메소` : `${n.toLocaleString("ko-KR")}번`);
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
          ? `첫 줄 ${primeFirstLabel(lineTables(c.id, "legendary", slotId, level))} 고정 · 경매장 가격 기준`
          : "레전드리 전용"
        : !p
          ? soul
            ? ""
            : !optGrade
              ? "유니크 · 레전드리만 계산"
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

  const attackName = "공격력(마력) %";
  const steppers = (
    [
      ["a", `${attackName} 최소`, best[attack] ? `+${best[attack]}% 까지` : ""],
      ["b", "보스 데미지 최소", best.boss ? `+${best.boss}% 까지` : ""],
      ["i", "방어율 무시 최소", best.ied ? `+${best.ied}% 까지` : ""],
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
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              장비 레벨
              <NumberField label="장비 레벨" value={levelText} onChange={setLevelText} inputClassName="w-16" />
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
            {level < 120 && <span className="text-xs text-destructive">120레벨 이상 장비만</span>}
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

        {goal === "opt" && weaponLike && optGrade && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <Label>
              노리는 줄
            </Label>
            {kind === "main" && (
              <div className="flex flex-wrap gap-1.5 [&>*]:min-w-[4.5rem] [&>*]:flex-1">
                {/* Rows always full: chips grow to share each row (5 in one row on desktop, 3 + 2 on phones). */}
                {TIERS.map((t) => {
                  const rows = lineTables("black", optGrade, slotId, level);
                  const p = rows ? weaponChance(rows, { attack, ied, min: { a: 0, b: 0, i: 0, v: 3 }, tier: t.id }) : 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={isV3 && tier === t.id}
                      onClick={() => {
                        setMin({ a: 0, b: 0, i: 0, v: 3 });
                        setTier(t.id);
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left",
                        isV3 && tier === t.id ? "border-primary bg-primary-soft text-primary-text" : "border-border"
                      )}
                    >
                      <b className="text-[13px]">{t.label}</b>
                      <span className="font-num text-[11px] text-muted-foreground">{pct(p)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {kind === "main" && tier !== "v3" && <span className="text-[11px] text-muted-foreground">{TIERS.find((t) => t.id === tier)!.desc}</span>}
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

        {goal === "opt" && !weaponLike && !soul && optGrade && (
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
                    ["lines", `${specialName} 줄`, comboSpecial === "cd" ? "크리티컬 데미지 % · 값 상관없이" : "재사용 대기시간 감소 · 값 상관없이"],
                    ["stat", `${mainName} 줄`, "값 상관없이"],
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
                        onClick={() => setComboPart(k, combo[k] - 1)}
                        className="flex size-8 items-center justify-center rounded-md border border-border"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <b className="w-6 text-center font-num">{combo[k]}</b>
                      <button
                        type="button"
                        aria-label={`${label} 늘리기`}
                        onClick={() => setComboPart(k, combo[k] + 1)}
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
                  <a href="https://maplescouter.com" target="_blank" rel="noreferrer" className="text-[11px] text-primary-text underline underline-offset-2">
                    maplescouter 세부 스펙 효율
                  </a>
                </div>
                {convOpen && (
                <>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      ["level", "캐릭터 레벨", "", ""],
                      ["v9", "렙당+2 = 주스탯", "%", `렙당+1 = ${conv.lvstr.toFixed(2)}%`],
                      ["cd3", "크뎀 3% = 주스탯", "%", ""],
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
                        value={convText[k] ?? ""}
                        onChange={(t) => setConvText({ ...convText, [k]: t })}
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
