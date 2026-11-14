// Ability (어빌리티) expected cost with the cheapest locking plan.
// Option chances: Nexon probability guide (data/ability.json). Reset prices as in game
// (2026-11-08): fame reset on a legendary ability 8,000 / 11,000 / 16,000 fame for 0 / 1 / 2 locks,
// advanced reset 20,000 / 30,000 / 40,000 fame + 200만 / 600만 / 1,500만 meso. Sunday halves fame.
//
// Assumes the ability is already legendary.
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
  drop: { name: "아이템 드롭률 % 증가", short: "드롭", label: "아이템 드롭률" },
  meso: { name: "메소 획득량 % 증가", short: "메소", label: "메소 획득량" },
} as const;
export type AbilityKey = keyof typeof ABILITY_OPTIONS;

export type AbilityPreset = {
  id: string;
  label: string;
  keys: AbilityKey[];
  /**
   * L1+U2: the options (indexes in keys) that may stand on the legendary first line — one of them must. Left out: the
   * legendary-only option if there is one, else the first.
   */
  lead?: number[];
  /** Only built as legendary line 1 + unique line 2 (드메: two lines and done). */
  l1u2Only?: boolean;
  /** A hunting build: what a second preset holds next to a boss build. */
  hunting?: boolean;
};

export const ABILITY_PRESETS: AbilityPreset[] = [
  { id: "pbs", label: "패보상", keys: ["pas", "boss", "stat"] },
  { id: "bsa", label: "보상공", keys: ["boss", "stat", "atk"] },
  { id: "pbc", label: "패보크", keys: ["pas", "boss", "crit"] },
  { id: "cbs", label: "재보상", keys: ["cool", "boss", "stat"] },
  { id: "pbcool", label: "패보재", keys: ["pas", "boss", "cool"] },
  { id: "cbh", label: "재보체", keys: ["cool", "boss", "hp"] },
  // Legendary 드메 (user, 2026-11-14): drop or meso on the legendary first line, the other one on a lower line.
  { id: "dm", label: "드메", keys: ["drop", "meso"], lead: [0, 1], l1u2Only: true, hunting: true },
];

/** L1+U2: the options of a preset that may be the legendary first line. */
export function presetLead(preset: AbilityPreset): number[] {
  if (preset.lead) return preset.lead;
  return [Math.max(0, preset.keys.findIndex((k) => legendaryOnly(k)))];
}

/** l3 = all three lines legendary, l1u2 = legendary first line + unique (or better) lines. */
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

/**
 * One finished ability: these options on lines that count, values at the goal.
 * l3: every option on a legendary line. l1u2: one `lead` option on the legendary first line (any option when `lead` is
 * left out), the others on lines 2 · 3 at unique or better.
 */
export type AbilityGoal = {
  keys: AbilityKey[];
  mode: AbilityMode;
  lead?: number[];
};

/** Locked lines: line index → target index, at most two. Encoded as "l:t,l:t". */
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

/** Every result of one reset from `locked`, reduced to "which lines hold a wanted option on a line that counts". */
function outcomes(
  locked: Map<number, number>,
  targets: number[],
  method: Method,
  counts: (line: number, g: Grade, t: number) => boolean,
): Outcome[] {
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
        if (counts(line, g, t)) next.set(line, t);
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

/** Expected fame, meso, circulators (abyss circulators) and resets. */
export type PlanCost = {
  fame: number;
  meso: number;
  circ: number;
  resets: number;
};

/** keep = reroll without new locks, lock = lock those lines, circ = circulators until those lines hit the goal, then lock. */
export type PlanAction = {
  kind: "keep" | "lock" | "circ";
  method: Method;
  circCount: number;
};

/** One way to go on after a result, and what is left after it (every kind of move is listed, cheapest first). */
export type PlanChoice = PlanCost & { action: PlanAction };

/** What to do when this shows up, the cheapest move first, and what the other moves would leave. */
export type PlanStep = PlanCost & {
  action: PlanAction;
  /** Every kind of move (keep · lock · circulate), cheapest first; the first one is `action`. */
  choices: PlanChoice[];
  /** Which goal the move works towards (index in the goals; one goal: always 0). */
  goal: number;
};

export type AbilityPlan = PlanCost & {
  /** Reset to use from scratch (nothing locked). */
  start: Method;
  /** One wanted option shows up first on line 1 (in L1+U2 only a lead option can; the others on line 2). */
  afterFirst: (PlanStep & { key: AbilityKey })[];
  /** Same, but on line 2 or 3. */
  afterFirstLower: (PlanStep & { key: AbilityKey })[];
  /** A second option after following the plan for the first one (three-line goals). */
  afterTwo: (PlanStep & { keys: [AbilityKey, AbilityKey] })[];
  /** Two presets: the first ability until one goal is met, and the chance each goal is the one met (by goal). */
  first?: PlanCost & { chance: number[] };
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

export type PlanOpts = {
  sunday: boolean;
  famePricePerUnit: number;
  /** Wanted value per option and grade, and the circulator price. Without it values are ignored. */
  values?: {
    goal: (key: AbilityKey, grade: "legendary" | "unique") => number;
    circPrice: number;
  };
};

/**
 * Cheapest way to the wanted options, values included.
 * State = locked lines (option + whether its value already meets the goal). After each reset the free lines show
 * options with random values; then: keep going, lock lines (their values stay), or use abyss circulators — they
 * reroll the values of every line and keep options and grades — until the chosen lines meet the goal, then lock them.
 * Finished when one goal holds all its options on lines that count, values at the goal.
 *
 * Several goals (`tails` given): one ability made into whichever goal comes, and `tails[g]` is what is still to pay
 * after goal g (another preset made into the other goal). Locks stay within one goal.
 * Solved exactly by value iteration (locks only grow, flags only go to "met").
 */
function solve(goals: AbilityGoal[], opts: PlanOpts, tails?: PlanCost[]): AbilityPlan {
  const keys: AbilityKey[] = [];
  const goalOf: number[] = [];
  const local: number[] = [];
  goals.forEach((g, gi) =>
    g.keys.forEach((k, i) => {
      keys.push(k);
      goalOf.push(gi);
      local.push(i);
    }),
  );
  const targets = keys.map((k) => INDEX.get(ABILITY_OPTIONS[k].name)!);
  const goalAt = (t: number) => goals[goalOf[t]];
  const leadOK = (t: number) => goalAt(t).lead?.includes(local[t]) ?? true;
  /** L1+U2: the one option that has to be the legendary line (it never counts on lines 2 · 3). */
  const soleLead = (t: number) => {
    const g = goalAt(t);
    return g.mode === "l1u2" && g.lead?.length === 1 && g.lead[0] === local[t];
  };
  const counts = (line: number, g: Grade, t: number) =>
    goalAt(t).mode === "l3"
      ? line === 0 || g === "legendary"
      : line === 0
        ? leadOK(t)
        : g !== "epic" && !soleLead(t);

  const fameMul = opts.sunday ? 0.5 : 1;
  const famePrice = Math.max(opts.famePricePerUnit, 1e-3);
  const circPrice = opts.values ? Math.max(opts.values.circPrice, 1) : 0;
  // Three legendary lines only come from the advanced reset, and a build with legendary lines 2 · 3 is rolled with it
  // to the end (user, 2026-11-11). The fame reset is for L1+U2.
  const methodsOf = (g: AbilityGoal): Method[] => (g.mode === "l3" ? ["advanced"] : ["fame"]);
  const gradeOf = (line: number, t: number) =>
    (goalAt(t).mode === "l3" || line === 0 ? "legendary" : "unique") as
      "legendary" | "unique";
  const pFull = (line: number, t: number) =>
    opts.values
      ? valueChance(keys[t], gradeOf(line, t), opts.values.goal(keys[t], gradeOf(line, t)))
      : 1;
  const money = (c: PlanCost) => c.fame * famePrice + c.meso + c.circ * circPrice;
  const tailMoney = (g: number | null) => (g === null || !tails ? 0 : money(tails[g]));

  // Reset outcomes per locked option layout (values do not change which options show up).
  const table = new Map<string, Outcome[]>();
  const outcomesFor = (ts: State, m: Method) => {
    const key = `${ts}|${m}`;
    if (!table.has(key)) table.set(key, outcomes(decode(ts), targets, m, counts));
    return table.get(key)!;
  };

  // Every state: up to two locked lines of one goal, distinct options, each met / not met.
  const n = targets.length;
  const states: FState[] = [""];
  for (let a = 0; a < 3; a++)
    for (let ta = 0; ta < n; ta++)
      for (const fa of [false, true]) {
        states.push(encF(new Map([[a, { t: ta, full: fa }]])));
        for (let b = a + 1; b < 3; b++)
          for (let tb = 0; tb < n; tb++)
            if (tb !== ta && goalOf[tb] === goalOf[ta])
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
  /** Resets worth trying from a state: those of the goal its locks belong to, every goal's when nothing is locked. */
  const methodsAt = (s: FState): Method[] => {
    const locked = [...decF(s).values()];
    const gs = locked.length ? [goalAt(locked[0].t)] : goals;
    return [...new Set(gs.flatMap(methodsOf))];
  };

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

  /** Goal g is on the item: all its options on lines that count (line 1 among them for L1+U2). */
  const meets = (lines: Map<number, Line>, g: number) => {
    const mine = [...lines].filter(([, v]) => goalOf[v.t] === g);
    return (
      mine.length === goals[g].keys.length &&
      (goals[g].mode === "l3" || mine.some(([l]) => l === 0))
    );
  };

  /** next null = finished (goal = the goal finished). */
  type Choice = { next: FState | null; circ: number; kind: PlanAction["kind"]; goal: number | null };
  const valueOf = (c: Choice) =>
    c.circ * circPrice + (c.next === null ? tailMoney(c.goal) : (V.get(c.next) ?? Infinity));
  /** Every move after seeing `lines` from `s`; the first one is "keep going as is". */
  const candidates = (lines: Map<number, Line>, s: FState): Choice[] => {
    const out: Choice[] = [{ next: s, circ: 0, kind: "keep", goal: null }];
    goals.forEach((_, g) => {
      if (!meets(lines, g)) return;
      const mine = [...lines].filter(([, v]) => goalOf[v.t] === g);
      if (mine.every(([, v]) => v.full)) out.push({ next: null, circ: 0, kind: "keep", goal: g });
      else if (circPrice > 0) {
        // All its options on the item: circulate every line until all of them meet the goal.
        const p = mine.reduce((x, [l, v]) => x * pFull(l, v.t), 1);
        if (p > 0) out.push({ next: null, circ: 1 / p, kind: "circ", goal: g });
      }
    });
    const locked = decF(s);
    const lockedGoal = locked.size ? goalOf[[...locked.values()][0].t] : null;
    // Lock sets that keep the current locks and add wanted lines of one goal (at most two locks).
    const extra = [...lines.keys()].filter(
      (l) => !locked.has(l) && (lockedGoal === null || goalOf[lines.get(l)!.t] === lockedGoal),
    );
    const sets: number[][] = [[]];
    for (const l of extra)
      for (const set of [...sets])
        if (set.length + locked.size < 2 && set.every((x) => goalOf[lines.get(x)!.t] === goalOf[lines.get(l)!.t]))
          sets.push([...set, l]);
    for (const set of sets) {
      const X = new Map(locked);
      for (const l of set) X.set(l, lines.get(l)!);
      if (set.length) out.push({ next: encF(X), circ: 0, kind: "lock", goal: null });
      if (circPrice > 0 && [...X.values()].some((v) => !v.full)) {
        // Circulators reroll every line, so all lines of X must meet the goal at once.
        const p = [...X].reduce((x, [l, v]) => x * pFull(l, v.t), 1);
        const met = new Map([...X].map(([l, v]) => [l, { t: v.t, full: true }]));
        if (p > 0) out.push({ next: encF(met), circ: 1 / p, kind: "circ", goal: null });
      }
    }
    return out;
  };
  /** Best move after seeing `lines` (null next = finished). Ties keep the current state. */
  const decide = (lines: Map<number, Line>, s: FState): Choice => {
    const all = candidates(lines, s);
    let best = all[0];
    let bestV = valueOf(best);
    for (const c of all.slice(1)) {
      const v = valueOf(c);
      if (v < bestV - 1e-9) [best, bestV] = [c, v];
    }
    return best;
  };

  for (const s of order) {
    let best = Infinity;
    let bestM: Method = methodsAt(s)[0];
    for (const m of methodsAt(s)) {
      const res = expand(s, m);
      let v = Infinity;
      for (let i = 0; i < 200; i++) {
        V.set(s, v);
        let sum = price(m, decF(s).size);
        let stay = 0;
        for (const r of res) {
          const c = decide(r.lines, s);
          if (c.next === s) stay += r.p;
          else sum += r.p * (c.circ * circPrice + (c.next === null ? tailMoney(c.goal) : V.get(c.next)!));
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

  // Expected fame / meso / resets / circulators under that plan; `tail(g)` = what finishing goal g adds.
  const evalPart = (
    part: (m: Method, locks: number) => number,
    perCirc: number,
    tail: (g: number) => number,
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
              (c.next === null
                ? c.goal !== null
                  ? tail(c.goal)
                  : 0
                : (W.get(c.next) ?? Infinity)));
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
  const tailOf = (k: keyof PlanCost) => (g: number) => (tails ? tails[g][k] : 0);
  const fameW = evalPart((m, l) => FAME[m][l] * fameMul, 0, tailOf("fame"));
  const mesoW = evalPart((m, l) => MESO[m][l], 0, tailOf("meso"));
  const resetW = evalPart(() => 1, 0, tailOf("resets"));
  const circW = evalPart(() => 0, 1, tailOf("circ"));

  /** What a move leaves to pay (circulators of the move included). */
  const leftAfter = (c: Choice): PlanCost => {
    const at = c.next;
    const tail = c.goal !== null && tails ? tails[c.goal] : null;
    const left = (W: Map<FState, number>, k: keyof PlanCost) =>
      at === null ? (tail ? tail[k] : 0) : W.get(at)!;
    return {
      fame: left(fameW, "fame"),
      meso: left(mesoW, "meso"),
      circ: c.circ + left(circW, "circ"),
      resets: left(resetW, "resets"),
    };
  };
  const actionOf = (c: Choice): PlanAction => ({
    kind: c.kind,
    method: policy.get(c.next ?? "") ?? "fame",
    circCount: c.circ,
  });

  /** What happens after `lines` are seen from state `from`, what is left, and what the other moves would leave. */
  const after = (lines: Map<number, Line>, goal: number, from: FState = "") => {
    const c = decide(lines, from);
    // The cheapest move of each kind; finishing is not an alternative (it never shows up here).
    const byKind = new Map<PlanAction["kind"], Choice>();
    for (const x of candidates(lines, from)) {
      if (x.next === null && x.kind === "keep") continue;
      const cur = byKind.get(x.kind);
      if (!cur || valueOf(x) < valueOf(cur) - 1e-9) byKind.set(x.kind, x);
    }
    byKind.set(c.kind, c);
    const choices = [...byKind.values()]
      .filter((x) => Number.isFinite(valueOf(x)))
      .sort((a, b) => (a === c ? -1 : b === c ? 1 : valueOf(a) - valueOf(b)))
      .map((x) => ({ action: actionOf(x), ...leftAfter(x) }));
    return { next: c.next, goal, action: actionOf(c), ...leftAfter(c), choices };
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
  // One option first on line 1 (always legendary). L1+U2: only a lead option can sit there, the others show up on line 2.
  const lineFor = (t: number) => (goalAt(t).mode === "l1u2" && !leadOK(t) ? 1 : 0);
  const afterFirst = keys.map((key, t) => ({
    key,
    ...strip(after(new Map([[lineFor(t), fresh(lineFor(t), t)]]), goalOf[t])),
  }));
  // One option first on line 2 (lines 2 and 3 behave the same). The one option that has to be line 1 cannot sit there.
  const lowerFirst = keys.map((key, t) =>
    soleLead(t) ? null : { key, t, ...after(new Map([[1, fresh(1, t)]]), goalOf[t]) },
  );
  const afterFirstLower = lowerFirst
    .filter((x) => x !== null)
    .map((x) => {
      const { t: _t, next: _next, ...rest } = x;
      void _t;
      void _next;
      return rest;
    });
  // The second option after following the plan for the first one: a showed up first (and was handled as above),
  // now b shows up on the other lower line (in L1+U2 the lead one goes on line 1). Three-line goals only: with two
  // lines the second option finishes the goal.
  // Every discovery order (Codex review: the first one is already handled, so "a then b" ≠ "b then a").
  const afterTwo: AbilityPlan["afterTwo"] = [];
  for (let first = 0; first < n; first++) {
    const done = lowerFirst[first];
    if (!done || goalAt(first).keys.length < 3) continue;
    // Not kept (no lock): the next reset rerolls it, so there is no "second option" step after it (Codex review).
    if (!done.next) continue;
    for (let second = 0; second < n; second++) {
      if (second === first || goalOf[second] !== goalOf[first]) continue;
      const secondLine = goalAt(second).mode === "l1u2" && soleLead(second) ? 0 : 2;
      const from: FState = done.next ?? "";
      const lines = from ? decF(from) : new Map<number, Line>();
      if (!lines.has(1)) lines.set(1, fresh(1, first));
      lines.set(secondLine, fresh(secondLine, second));
      afterTwo.push({
        keys: [keys[first], keys[second]],
        ...strip(after(lines, goalOf[first], from)),
      });
    }
  }

  // Several goals: the first ability alone (until one goal is met, the other preset left out), and how likely each
  // goal is the one it ends as (user, 2026-11-14: "either counts, so it is cheaper").
  const none = () => 0;
  const first = tails
    ? {
        fame: evalPart((m, l) => FAME[m][l] * fameMul, 0, none).get("")!,
        meso: evalPart((m, l) => MESO[m][l], 0, none).get("")!,
        resets: evalPart(() => 1, 0, none).get("")!,
        circ: evalPart(() => 0, 1, none).get("")!,
        chance: goals.map((_, g) => evalPart(() => 0, 0, (x) => (x === g ? 1 : 0)).get("")!),
      }
    : undefined;

  return {
    fame: fameW.get("")!,
    meso: mesoW.get("")!,
    resets: resetW.get("")!,
    circ: circW.get("")!,
    start: policy.get("")!,
    afterFirst,
    afterFirstLower,
    afterTwo,
    first,
  };
}

/**
 * Cheapest way to one ability with these options. `lead` (L1+U2): the option(s) that may be the legendary first line;
 * left out, any of them.
 */
export function abilityPlan(
  keys: AbilityKey[],
  mode: AbilityMode,
  opts: PlanOpts,
  lead?: number | number[],
): AbilityPlan {
  return solve([{ keys, mode, lead: lead === undefined ? undefined : Array.isArray(lead) ? lead : [lead] }], opts);
}

/**
 * Two presets, two builds (user, 2026-11-14: "드메도 뽑으면서 패보상"): roll one ability and make it whichever build comes
 * first, then the other preset into the other build. `both` = that plan (its rows say which build a move goes for),
 * `a` and `b` = each build alone; the two presets done one after the other cost a + b.
 */
export function abilityPairPlan(
  a: AbilityGoal,
  b: AbilityGoal,
  opts: PlanOpts,
): { both: AbilityPlan; a: AbilityPlan; b: AbilityPlan } {
  const one = solve([a], opts);
  const two = solve([b], opts);
  const cost = (p: AbilityPlan): PlanCost => ({ fame: p.fame, meso: p.meso, circ: p.circ, resets: p.resets });
  // Finishing a leaves b for the other preset, and the other way round.
  const both = solve([a, b], opts, [cost(two), cost(one)]);
  return { both, a: one, b: two };
}

// ---------------------------------------------------------------------------
// Values (수치). Official value table (/Guide/OtherProbability/ability/reputevalue, 2026-11-09; drop and meso
// 2026-11-14, the page's values as of 2026-09-17): every option has six rows chosen with 20 · 20 · 20 · 15 · 15 · 10 %,
// each row one value per grade. Max HP %, cooldown skip and defence / MP % share the boss damage rows.
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
  drop: {
    unit: "%",
    legendary: [18, 18, 19, 19, 20, 20],
    unique: [13, 13, 14, 14, 15, 15],
  },
  meso: {
    unit: "%",
    legendary: [18, 18, 19, 19, 20, 20],
    unique: [13, 13, 14, 14, 15, 15],
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
 * is P and the expected circulators are (1 − P) ÷ P. (Not 1 ÷ P: that counts one more.)
 */
export function circulatorCount(
  lines: { key: AbilityKey; grade: "legendary" | "unique"; goal: number }[],
): { p: number; count: number } {
  const p = lines.reduce((s, l) => s * valueChance(l.key, l.grade, l.goal), 1);
  return { p, count: p > 0 ? (1 - p) / p : Infinity };
}
