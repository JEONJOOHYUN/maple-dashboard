// Ability (어빌리티) expected cost with the cheapest locking plan.
// Option chances: Nexon probability guide (data/ability.json). Reset prices: namu.wiki "메이플스토리/어빌리티"
// (2026-11-08): fame reset on a legendary ability 8,000 / 11,000 / 16,000 fame for 0 / 1 / 2 locks,
// advanced reset 20,000 / 30,000 / 40,000 fame + 200만 / 600만 / 1,500만 meso. Sunday halves fame.
//
// Assumes the ability is already legendary. Values (e.g. boss 10 % vs 20 %) are not considered, only
// which options sit on which grade.
import data from "./data/ability.json" with { type: "json" };

type Grade = "epic" | "unique" | "legendary";
const DB = data as unknown as { rows: [string, number, number, number][] };
const OPTIONS = DB.rows.map(([name, epic, unique, legendary]) => ({
  name,
  p: { epic, unique, legendary } as Record<Grade, number>,
}));
const INDEX = new Map(OPTIONS.map((o, i) => [o.name, i]));

export const ABILITY_OPTIONS = {
  pas: {
    name: "패시브 스킬 레벨 증가",
    short: "패시브",
    label: "패시브 스킬 레벨",
  },
  boss: {
    name: "보스 몬스터 공격 시 데미지 % 증가",
    short: "보공",
    label: "보스 몬스터 공격 시 데미지",
  },
  stat: {
    name: "상태 이상에 걸린 대상 공격 시 데미지 % 증가",
    short: "상추뎀",
    label: "상태 이상 대상 공격 시 데미지",
  },
  crit: { name: "크리티컬 확률 % 증가", short: "크확", label: "크리티컬 확률" },
  cool: {
    name: "스킬 사용 시 % 확률로 재사용 대기시간이 미적용",
    short: "재사용",
    label: "재사용 대기시간 미적용",
  },
  atk: { name: "공격력 증가", short: "공마", label: "공격력 (마력)" },
  hp: { name: "최대 HP % 증가", short: "최대 HP", label: "최대 HP %" },
} as const;
export type AbilityKey = keyof typeof ABILITY_OPTIONS;

export const ABILITY_PRESETS: {
  id: string;
  label: string;
  keys: [AbilityKey, AbilityKey, AbilityKey];
}[] = [
  { id: "pbs", label: "패보상", keys: ["pas", "boss", "stat"] },
  { id: "bsa", label: "보상공", keys: ["boss", "stat", "atk"] },
  { id: "pbc", label: "패보크", keys: ["pas", "boss", "crit"] },
  { id: "cbs", label: "재보상", keys: ["cool", "boss", "stat"] },
  { id: "pbcool", label: "패보재", keys: ["pas", "boss", "cool"] },
  { id: "cbh", label: "재보체", keys: ["cool", "boss", "hp"] },
];

/** l3 = all three lines legendary, l1u2 = legendary first line + two unique (or better) lines. */
export type AbilityMode = "l3" | "l1u2";
export type Method = "fame" | "advanced";

const FAME = {
  fame: [8000, 11000, 16000],
  advanced: [20000, 30000, 40000],
} as const;
const MESO = {
  fame: [0, 0, 0],
  advanced: [2_000_000, 6_000_000, 15_000_000],
} as const;
/** Grade chances of lines 2 and 3 (line 1 is always legendary on a legendary ability). */
const LATER_GRADES: Record<Method, [Grade, number][]> = {
  fame: [
    ["unique", 0.15],
    ["epic", 0.85],
  ],
  advanced: [
    ["legendary", 0.02],
    ["unique", 0.15],
    ["epic", 0.83],
  ],
};

export function legendaryOnly(key: AbilityKey): boolean {
  return OPTIONS[INDEX.get(ABILITY_OPTIONS[key].name)!].p.unique === 0;
}

/** Locked lines: line index → target index (0~2), at most two. Encoded as "l:t,l:t". */
type State = string;
const encode = (m: Map<number, number>): State =>
  [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([l, t]) => `${l}:${t}`)
    .join(",");
const decode = (s: State) =>
  new Map(
    s
      ? s.split(",").map((x) => x.split(":").map(Number) as [number, number])
      : [],
  );

type Outcome = { p: number; good: Map<number, number> };

/** Every result of one reset from `locked`, reduced to "which lines hold a wanted option at a good grade". */
function outcomes(
  locked: Map<number, number>,
  targets: number[],
  mode: AbilityMode,
  method: Method,
  lead?: number,
): Outcome[] {
  // L1+U2 with a chosen legendary option (lead): only it counts on line 1, and only the others on lines 2 · 3.
  const goodGrade = (line: number, g: Grade, t: number) =>
    mode === "l3"
      ? line === 0 || g === "legendary"
      : lead === undefined
        ? line === 0 || g !== "epic"
        : line === 0
          ? t === lead
          : g !== "epic" && t !== lead;
  const merged = new Map<string, Outcome>();
  const add = (p: number, good: Map<number, number>) => {
    const key = encode(good);
    const cur = merged.get(key);
    if (cur) cur.p += p;
    else merged.set(key, { p, good: new Map(good) });
  };
  const excludedStart = [...locked.values()].map((t) => targets[t]);
  const free = [0, 1, 2].filter((l) => !locked.has(l));

  // Roll the free lines in order. Each option is picked with chance / (1 − excluded chances) in that grade.
  const roll = (
    k: number,
    excluded: number[],
    good: Map<number, number>,
    p: number,
  ) => {
    if (p <= 0) return;
    if (k === free.length) return add(p, good);
    const line = free[k];
    const grades: [Grade, number][] =
      line === 0 ? [["legendary", 1]] : LATER_GRADES[method];
    const last = k === free.length - 1;
    for (const [g, pg] of grades) {
      const denom = 1 - excluded.reduce((s, i) => s + OPTIONS[i].p[g], 0);
      if (denom <= 0) continue;
      let wanted = 0;
      targets.forEach((opt, t) => {
        if (excluded.includes(opt)) return;
        const po = OPTIONS[opt].p[g] / denom;
        if (po <= 0) return;
        wanted += po;
        const next = new Map(good);
        if (goodGrade(line, g, t)) next.set(line, t);
        roll(k + 1, [...excluded, opt], next, p * pg * po);
      });
      const rest = 1 - wanted;
      if (rest <= 1e-15) continue;
      if (last) {
        // The last line only needs "not wanted"; which other option it is changes nothing.
        roll(k + 1, excluded, good, p * pg * rest);
      } else {
        OPTIONS.forEach((o, i) => {
          if (excluded.includes(i) || targets.includes(i)) return;
          const po = o.p[g] / denom;
          if (po > 0) roll(k + 1, [...excluded, i], good, p * pg * po);
        });
      }
    }
  };
  roll(0, excludedStart, new Map(locked), 1);
  // Float rounding can leave the total a hair off 1; any missing mass would look like a free finish.
  const list = [...merged.values()];
  const total = list.reduce((s, o) => s + o.p, 0);
  for (const o of list) o.p /= total;
  return list;
}

export type AbilityPlan = {
  /** Expected totals from a fresh legendary ability (circ = abyss circulators). */
  fame: number;
  meso: number;
  resets: number;
  circ: number;
  /** Reset to use from scratch (nothing locked). */
  start: Method;
  /** One wanted option shows up first on line 1 (always legendary) — value not yet the goal — and what is left. */
  afterFirst: {
    key: AbilityKey;
    action: PlanAction;
    fame: number;
    meso: number;
    circ: number;
  }[];
  /** Same, but on line 2 or 3 (the rare legendary lines; in L1+U2 a unique line). */
  afterFirstLower: {
    key: AbilityKey;
    action: PlanAction;
    fame: number;
    meso: number;
    circ: number;
    resets: number;
  }[];
  /** What to do when two wanted options show up together (lines 2 · 3, values not yet the goal), and what is left. */
  afterTwo: {
    keys: [AbilityKey, AbilityKey];
    action: PlanAction;
    fame: number;
    meso: number;
    circ: number;
    resets: number;
  }[];
};

/** keep = reroll without new locks, lock = lock those lines, circ = circulators until those lines hit the goal, then lock. */
export type PlanAction = {
  kind: "keep" | "lock" | "circ";
  method: Method;
  circCount: number;
};

type Line = { t: number; full: boolean };
type FState = string; // "line:target:full" for locked lines, sorted
const encF = (m: Map<number, Line>): FState =>
  [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([l, v]) => `${l}:${v.t}:${v.full ? 1 : 0}`)
    .join(",");
const decF = (s: FState) =>
  new Map<number, Line>(
    s
      ? s.split(",").map((x) => {
          const [l, t, f] = x.split(":").map(Number);
          return [l, { t, full: f === 1 }];
        })
      : [],
  );
const typeState = (m: Map<number, Line>): State =>
  encode(new Map([...m].map(([l, v]) => [l, v.t])));

/**
 * Cheapest way to the three wanted options, values included.
 * State = locked lines (option + whether its value already meets the goal). After each reset the free lines show
 * options with random values; then: keep going, lock lines (their values stay), or use abyss circulators — they
 * reroll the values of every line and keep options and grades — until the chosen lines meet the goal, then lock them.
 * Finished when all three lines hold the wanted options with values at the goal.
 * Solved exactly by value iteration (locks only grow, flags only go to "met").
 */
export function abilityPlan(
  keys: [AbilityKey, AbilityKey, AbilityKey],
  mode: AbilityMode,
  opts: {
    sunday: boolean;
    famePricePerUnit: number;
    /** Wanted value per option and grade, and the circulator price. Without it values are ignored. */
    values?: {
      goal: (key: AbilityKey, grade: "legendary" | "unique") => number;
      circPrice: number;
    };
  },
  /** L1+U2 only: index in keys of the option that must be the legendary line. */
  lead?: number,
): AbilityPlan {
  const targets = keys.map((k) => INDEX.get(ABILITY_OPTIONS[k].name)!);
  const fameMul = opts.sunday ? 0.5 : 1;
  const famePrice = Math.max(opts.famePricePerUnit, 1e-3);
  const circPrice = opts.values ? Math.max(opts.values.circPrice, 1) : 0;
  const methods: Method[] = mode === "l3" ? ["fame", "advanced"] : ["fame"];
  const gradeOf = (line: number) =>
    (mode === "l3" || line === 0 ? "legendary" : "unique") as
      "legendary" | "unique";
  const pFull = (line: number, t: number) =>
    opts.values
      ? valueChance(
          keys[t],
          gradeOf(line),
          opts.values.goal(keys[t], gradeOf(line)),
        )
      : 1;

  // Reset outcomes per locked option layout (values do not change which options show up).
  const table = new Map<string, Outcome[]>();
  const outcomesFor = (ts: State, m: Method) => {
    const key = `${ts}|${m}`;
    if (!table.has(key))
      table.set(
        key,
        outcomes(
          decode(ts),
          targets,
          mode,
          m,
          mode === "l1u2" ? lead : undefined,
        ),
      );
    return table.get(key)!;
  };

  // Every state: up to two locked lines, distinct options, each met / not met.
  const states: FState[] = [""];
  for (let a = 0; a < 3; a++)
    for (let ta = 0; ta < 3; ta++)
      for (const fa of [false, true]) {
        states.push(encF(new Map([[a, { t: ta, full: fa }]])));
        for (let b = a + 1; b < 3; b++)
          for (let tb = 0; tb < 3; tb++)
            if (tb !== ta)
              for (const fb of [false, true])
                states.push(
                  encF(
                    new Map([
                      [a, { t: ta, full: fa }],
                      [b, { t: tb, full: fb }],
                    ]),
                  ),
                );
      }
  const fullCount = (s: FState) =>
    [...decF(s).values()].filter((v) => v.full).length;
  // More locks first, then more lines already met: every move goes to a state solved earlier (or stays).
  const order = [...states].sort(
    (x, y) => decF(y).size - decF(x).size || fullCount(y) - fullCount(x),
  );

  const price = (m: Method, locks: number) =>
    FAME[m][locks] * fameMul * famePrice + MESO[m][locks];
  const V = new Map<FState, number>();
  const policy = new Map<FState, Method>();

  /** After one reset from `s`: every result with values, as the full picture of the three lines. */
  const expand = (s: FState, m: Method) => {
    const locked = decF(s);
    const out: { p: number; lines: Map<number, Line> }[] = [];
    for (const o of outcomesFor(typeState(locked), m)) {
      const fresh = [...o.good.entries()].filter(([l]) => !locked.has(l));
      const combos = 1 << fresh.length;
      for (let mask = 0; mask < combos; mask++) {
        let p = o.p;
        const lines = new Map(locked);
        fresh.forEach(([l, t], i) => {
          const q = pFull(l, t);
          const full = (mask & (1 << i)) !== 0;
          p *= full ? q : 1 - q;
          lines.set(l, { t, full });
        });
        if (p > 0) out.push({ p, lines });
      }
    }
    return out;
  };

  type Choice = { next: FState | null; circ: number; kind: PlanAction["kind"] };
  /** Best move after seeing `lines` (null next = finished). Ties keep the current state. */
  const decide = (lines: Map<number, Line>, s: FState): Choice => {
    const vals = [...lines.values()];
    if (lines.size === 3 && vals.every((v) => v.full))
      return { next: null, circ: 0, kind: "keep" };
    const locked = decF(s);
    let best: Choice = { next: s, circ: 0, kind: "keep" };
    let bestV = V.get(s) ?? Infinity;
    const consider = (c: Choice) => {
      const v =
        c.circ * circPrice +
        (c.next === null ? 0 : (V.get(c.next) ?? Infinity));
      if (v < bestV - 1e-9) [best, bestV] = [c, v];
    };
    // All three options on the item: circulate every line until all meet the goal.
    if (lines.size === 3 && circPrice > 0) {
      const p = [...lines].reduce((x, [l, v]) => x * pFull(l, v.t), 1);
      if (p > 0) consider({ next: null, circ: 1 / p, kind: "circ" });
    }
    // Lock sets that keep the current locks and add wanted lines (at most two locks).
    const extra = [...lines.keys()].filter((l) => !locked.has(l));
    const sets: number[][] = [[]];
    for (const l of extra)
      for (const set of [...sets])
        if (set.length + locked.size < 2) sets.push([...set, l]);
    for (const set of sets) {
      const X = new Map(locked);
      for (const l of set) X.set(l, lines.get(l)!);
      if (set.length) consider({ next: encF(X), circ: 0, kind: "lock" });
      if (circPrice > 0 && [...X.values()].some((v) => !v.full)) {
        // Circulators reroll every line, so all lines of X must meet the goal at once.
        const p = [...X].reduce((x, [l, v]) => x * pFull(l, v.t), 1);
        const met = new Map(
          [...X].map(([l, v]) => [l, { t: v.t, full: true }]),
        );
        if (p > 0) consider({ next: encF(met), circ: 1 / p, kind: "circ" });
      }
    }
    return best;
  };

  for (const s of order) {
    let best = Infinity;
    let bestM: Method = methods[0];
    for (const m of methods) {
      const res = expand(s, m);
      let v = Infinity;
      for (let i = 0; i < 200; i++) {
        V.set(s, v);
        let sum = price(m, decF(s).size);
        let stay = 0;
        for (const r of res) {
          const c = decide(r.lines, s);
          if (c.next === s) stay += r.p;
          else
            sum +=
              r.p *
              (c.circ * circPrice + (c.next === null ? 0 : V.get(c.next)!));
        }
        const next = stay < 1 - 1e-15 ? sum / (1 - stay) : Infinity;
        if (next === v || Math.abs(next - v) <= 1e-12 * next) break;
        v = next;
      }
      if (v < best) [best, bestM] = [v, m];
    }
    V.set(s, best);
    policy.set(s, bestM);
  }

  // Expected fame / meso / resets / circulators under that plan.
  const evalPart = (
    part: (m: Method, locks: number) => number,
    perCirc: number,
  ) => {
    const W = new Map<FState, number>();
    for (const s of order) {
      const m = policy.get(s)!;
      let stay = 0;
      let rest = 0;
      for (const r of expand(s, m)) {
        const c = decide(r.lines, s);
        if (c.next === s) stay += r.p;
        else
          rest +=
            r.p *
            (c.circ * perCirc +
              (c.next === null ? 0 : (W.get(c.next) ?? Infinity)));
      }
      W.set(
        s,
        stay < 1 - 1e-15
          ? (part(m, decF(s).size) + rest) / (1 - stay)
          : Infinity,
      );
    }
    return W;
  };
  const fameW = evalPart((m, l) => FAME[m][l] * fameMul, 0);
  const mesoW = evalPart((m, l) => MESO[m][l], 0);
  const resetW = evalPart(() => 1, 0);
  const circW = evalPart(() => 0, 1);

  /** What happens after `lines` are seen from state `from`, and what is left after that move. */
  const after = (lines: Map<number, Line>, from: FState = "") => {
    const c = decide(lines, from);
    const at = c.next ?? "";
    const action: PlanAction = {
      kind: c.kind,
      method: policy.get(c.next ?? "") ?? "fame",
      circCount: c.circ,
    };
    const left = (W: Map<FState, number>) => (c.next === null ? 0 : W.get(at)!);
    return {
      action,
      next: c.next,
      fame: left(fameW),
      meso: left(mesoW),
      circ: c.circ + left(circW),
      resets: left(resetW),
    };
  };
  /** A wanted option that just showed up: its value meets the goal only by luck (always, when there is one value). */
  const fresh = (line: number, t: number): Line => ({
    t,
    full: !opts.values || pFull(line, t) >= 1,
  });
  const strip = <T extends { next: FState | null }>(x: T) => {
    const { next: _next, ...rest } = x;
    void _next;
    return rest;
  };
  // One option first on line 1 (always legendary). L1+U2: only the lead option can sit there, the others show up on line 2.
  const lineFor = (t: number) =>
    mode === "l1u2" && lead !== undefined && t !== lead ? 1 : 0;
  const afterFirst = keys.map((key, t) => ({
    key,
    ...strip(after(new Map([[lineFor(t), fresh(lineFor(t), t)]]))),
  }));
  // One option first on line 2 (lines 2 and 3 behave the same). In L1+U2 the lead option cannot sit there.
  const lowerFirst = keys.map((key, t) =>
    mode === "l1u2" && t === lead
      ? null
      : { key, t, ...after(new Map([[1, fresh(1, t)]])) },
  );
  const afterFirstLower = lowerFirst
    .filter((x) => x !== null)
    .map((x) => ({
      key: x.key,
      action: x.action,
      fame: x.fame,
      meso: x.meso,
      circ: x.circ,
      resets: x.resets,
    }));
  // The second option after following the plan for the first one: a showed up first (and was handled as above),
  // now b shows up on the other lower line (in L1+U2 the lead one goes on line 1).
  // Every discovery order (Codex review: the first one is already handled, so "a then b" ≠ "b then a").
  // The first one shows up on line 2 (step 3); the second on line 3, or on line 1 when it is the L1+U2 lead.
  const afterTwo: AbilityPlan["afterTwo"] = [];
  for (let first = 0; first < 3; first++) {
    const done = lowerFirst[first];
    if (!done) continue; // the L1+U2 lead never shows up first on a lower line
    // Not kept (no lock): the next reset rerolls it, so there is no "second option" step after it (Codex review).
    if (!done.next) continue;
    for (let second = 0; second < 3; second++) {
      if (second === first) continue;
      const secondLine = mode === "l1u2" && second === lead ? 0 : 2;
      const from: FState = done.next ?? "";
      const lines = from ? decF(from) : new Map<number, Line>();
      if (!lines.has(1)) lines.set(1, fresh(1, first));
      lines.set(secondLine, fresh(secondLine, second));
      afterTwo.push({
        keys: [keys[first], keys[second]],
        ...strip(after(lines, from)),
      });
    }
  }

  return {
    fame: fameW.get("")!,
    meso: mesoW.get("")!,
    resets: resetW.get("")!,
    circ: circW.get("")!,
    start: policy.get("")!,
    afterFirst,
    afterFirstLower,
    afterTwo,
  };
}

// ---------------------------------------------------------------------------
// Values (수치). Official value table (/Guide/OtherProbability/ability/reputevalue, 2026-11-09):
// every option has six rows chosen with 20 · 20 · 20 · 15 · 15 · 10 %, each row one value per grade.
// Max HP %, cooldown skip and defence / MP % share the boss damage rows.
const VALUE_ROW_P = [0.2, 0.2, 0.2, 0.15, 0.15, 0.1];
export const ABILITY_VALUES: Record<
  AbilityKey,
  { unit: string; legendary: number[]; unique: number[] }
> = {
  pas: { unit: "", legendary: [1, 1, 1, 1, 1, 1], unique: [] },
  boss: {
    unit: "%",
    legendary: [15, 16, 17, 18, 19, 20],
    unique: [5, 6, 7, 8, 9, 10],
  },
  stat: {
    unit: "%",
    legendary: [9, 9, 10, 10, 10, 10],
    unique: [7, 7, 7, 7, 8, 8],
  },
  crit: {
    unit: "%",
    legendary: [25, 26, 27, 28, 29, 30],
    unique: [15, 16, 17, 18, 19, 20],
  },
  cool: {
    unit: "%",
    legendary: [15, 16, 17, 18, 19, 20],
    unique: [5, 6, 7, 8, 9, 10],
  },
  atk: {
    unit: "",
    legendary: [27, 27, 27, 30, 30, 30],
    unique: [15, 18, 18, 18, 21, 21],
  },
  hp: {
    unit: "%",
    legendary: [15, 16, 17, 18, 19, 20],
    unique: [5, 6, 7, 8, 9, 10],
  },
};

/** Values a line can show for this option and grade, smallest first (no repeats). */
export function valueChoices(
  key: AbilityKey,
  grade: "legendary" | "unique",
): number[] {
  return [...new Set(ABILITY_VALUES[key][grade])].sort((a, b) => a - b);
}

/** Chance that one roll of this option's value is at least `goal`. */
export function valueChance(
  key: AbilityKey,
  grade: "legendary" | "unique",
  goal: number,
): number {
  // Rounded so six rows that all qualify give exactly 1 (0.2 + … + 0.1 is 0.9999… in floats).
  return (
    Math.round(
      ABILITY_VALUES[key][grade].reduce(
        (s, v, i) => s + (v >= goal ? VALUE_ROW_P[i] : 0),
        0,
      ) * 1e9,
    ) / 1e9
  );
}

/**
 * Abyss circulators to also reach the wanted values. A circulator rerolls the values of all three lines and keeps
 * options and grades. When the options are done the values are already random, so the chance they are all fine
 * is P and the expected circulators are (1 − P) ÷ P. (chuchu.gg shows 1 ÷ P, one more.)
 */
export function circulatorCount(
  lines: { key: AbilityKey; grade: "legendary" | "unique"; goal: number }[],
): { p: number; count: number } {
  const p = lines.reduce((s, l) => s * valueChance(l.key, l.grade, l.goal), 1);
  return { p, count: p > 0 ? (1 - p) / p : Infinity };
}
