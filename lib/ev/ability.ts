// Ability (어빌리티) expected cost with the cheapest locking plan.
// Option chances: Nexon probability guide (data/ability.json; the miracle circulator has its own page,
// data/ability-miracle.json). Reset prices as in game (2026-11-08): fame reset on a legendary ability
// 8,000 / 11,000 / 16,000 fame for 0 / 1 / 2 locks, advanced reset 20,000 / 30,000 / 40,000 fame + 200만 / 600만 /
// 1,500만 meso. Sunday halves fame.
//
// Assumes the ability is already legendary.
import data from "./data/ability.json" with { type: "json" };
import miracleData from "./data/ability-miracle.json" with { type: "json" };

type Grade = "epic" | "unique" | "legendary";
type Rows = { rows: [string, number, number, number][] };
const DB = data as unknown as Rows;
const MIRACLE = new Map(
  (miracleData as unknown as Rows).rows.map(([name, epic, unique, legendary]) => [
    name,
    { epic, unique, legendary } as Record<Grade, number>,
  ]),
);
const OPTIONS = DB.rows.map(([name, epic, unique, legendary]) => {
  const pm = MIRACLE.get(name);
  if (!pm) throw new Error(`miracle circulator table has no "${name}"`);
  return { name, p: { epic, unique, legendary } as Record<Grade, number>, pm };
});
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

/**
 * Letters of the per-class builds (lib/spec/data/classes.json) → options. 벞 (buff duration) is shown and counted as
 * 공마: the user's build table treats them as the same line ("공 = 마 = 버프 지속"), and there is no buff-duration value
 * table here, so the table says what the calculator computes (user 2026-11-15: no footnote).
 */
export const BUILD_LETTERS: Record<string, { key: AbilityKey; label: string }> = {
  패: { key: "pas", label: "패시브" },
  보: { key: "boss", label: "보공" },
  상: { key: "stat", label: "상추뎀" },
  공: { key: "atk", label: "공마" },
  벞: { key: "atk", label: "공마" },
  재: { key: "cool", label: "재사용" },
  크: { key: "crit", label: "크확" },
  피: { key: "hp", label: "최대 HP" },
};

/**
 * A class build as the preset to calculate. l3 = its three options; l1u2 = its first letter on the legendary line, the
 * other two on lines 2 · 3. A built-in preset with the same options (and, for l1u2, the same legendary line) is
 * returned instead, so its chip shows as picked. Null when the letters are not three different options.
 */
export function buildPreset(letters: string, mode: AbilityMode): AbilityPreset | null {
  const keys = [...letters].map((c) => BUILD_LETTERS[c]?.key);
  if (keys.length !== 3 || keys.some((k) => !k) || new Set(keys).size !== 3) return null;
  const ks = keys as AbilityKey[];
  // A legendary-only option (패시브) can only stand on the legendary line.
  if (mode === "l1u2" && ks.slice(1).some(legendaryOnly)) return null;
  const same = ABILITY_PRESETS.find(
    (p) =>
      !p.hunting &&
      p.keys.length === 3 &&
      ks.every((k) => p.keys.includes(k)) &&
      (mode === "l3" || p.keys[presetLead(p)[0]] === ks[0]),
  );
  return same ?? { id: `build:${letters}`, label: letters, keys: ks, lead: [0] };
}

/** l3 = all three lines legendary, l1u2 = legendary first line + unique (or better) lines. */
export type AbilityMode = "l3" | "l1u2";
/**
 * fame = 일반 (명성치) 재설정, advanced = 고급 재설정, miracle = 미라클 서큘레이터: rerolls all three lines with no locks,
 * its own option chances, grade chances as the fame reset, and every line at the top value of its grade (official
 * miracle circulator page, 2026-11-15). Priced per item (`PlanOpts.miraclePrice`), no fame.
 */
export type Method = "fame" | "advanced" | "miracle";

const FAME = {
  fame: [8000, 11000, 16000],
  advanced: [20000, 30000, 40000],
  miracle: [0, 0, 0],
} as const;
const MESO = {
  fame: [0, 0, 0],
  advanced: [2_000_000, 6_000_000, 15_000_000],
  miracle: [0, 0, 0],
} as const;
const FAME_GRADES: [Grade, number][] = [
  ["unique", 0.15],
  ["epic", 0.85],
];
/** Grade chances of lines 2 and 3 (line 1 is always legendary on a legendary ability). */
const LATER_GRADES: Record<Method, [Grade, number][]> = {
  fame: FAME_GRADES,
  advanced: [
    ["legendary", 0.02],
    ["unique", 0.15],
    ["epic", 0.83],
  ],
  miracle: FAME_GRADES,
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
  const chance = (i: number, g: Grade) => (method === "miracle" ? OPTIONS[i].pm[g] : OPTIONS[i].p[g]);

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
      const denom = 1 - excluded.reduce((s, i) => s + chance(i, g), 0);
      if (denom <= 0) continue;
      let wanted = 0;
      targets.forEach((opt, t) => {
        if (excluded.includes(opt)) return;
        const po = chance(opt, g) / denom;
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
        OPTIONS.forEach((_, i) => {
          if (excluded.includes(i) || targets.includes(i)) return;
          const po = chance(i, g) / denom;
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

/**
 * Expected fame, meso, value circulators (abyss · black · chaos: `values.circPrice` each), resets (fame and advanced)
 * and miracle circulators.
 */
export type PlanCost = {
  fame: number;
  meso: number;
  circ: number;
  resets: number;
  miracle: number;
};

/** Which circulators a go uses: black only, chaos only, or chaos first and then black. */
export type CircKind = "black" | "chaos" | "both";
type Go = CircKind;

/** keep = reroll without new locks, lock = lock those lines, circ = circulators until those lines hit the goal, then lock. */
export type PlanAction = {
  kind: "keep" | "lock" | "circ";
  method: Method;
  /** Circulators the move uses on average. */
  circCount: number;
  /**
   * With a limit (`values.circMax`): the circulators there are for the move, and the chance the lines meet the goal
   * before they run out.
   */
  circLeft?: number;
  circChance?: number;
  /** With circulators held: which kind the go uses (`both` = chaos first, then black). */
  circKind?: CircKind;
  /**
   * With a limit: the options left locked when every one misses (empty: none), when that is known — always with black
   * (the values stay); with chaos the last result decides, and then the lines at the goal are the ones locked.
   */
  circMissKeep?: AbilityKey[];
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
  /**
   * The line it showed up on (0 = the first line). The row assumes its value is below the goal (at the top value when
   * the reset that shows it is the miracle circulator).
   */
  line: number;
  /** The move when it already shows the wanted value, when that differs from going on (keep below it, lock at it). */
  atGoal?: PlanAction;
  /** What is left after the `atGoal` move. */
  atGoalLeft?: PlanCost;
  /** The steps after this one assume it showed up at the wanted value (below it, it is not kept). */
  nextAtGoal?: boolean;
  /** Only the last option of the goal is missing after this move: how the goal ends (one entry per kind of move). */
  finish?: PlanFinish[];
  /** With circulators held: the move locks lines that are then circulated one at a time (what to use, how it goes). */
  run?: PlanRun;
};

/** One black circulator, one chaos, or stop (and keep only some lines locked, then resets). */
export type RunUse = "black" | "chaos" | "stop";

/**
 * Circulators one at a time once the lines are locked (event black · chaos ones held), at the counts held: for each set
 * of the locked options at the goal what to use — black (a result is taken only when it is better), chaos, or stop and
 * keep only `keep` locked (then resets). Best set first: a black result is taken when it is a set higher in the list.
 */
export type PlanRun = {
  keys: AbilityKey[];
  /** The line of each of `keys` (0 = the first line). */
  lines: number[];
  /**
   * `then`: as the counts go down with that set unchanged, the first move that differs (Codex review: the guide has to
   * say it, the numbers below follow it) — at `at` left of the kind being used. Chaos running out into black is not one.
   */
  by: {
    have: AbilityKey[];
    use: RunUse;
    keep?: AbilityKey[];
    then?: { kind: "black" | "chaos"; at: number; use: RunUse; keep?: AbilityKey[] };
  }[];
  /** From the values when locked: circulators used on average, the chance every locked line ends at the goal. */
  circCount: number;
  chance: number;
};

/** The last missing option of a goal shows up: what to do when its value is below the goal, and what is left after. */
export type PlanFinish = PlanCost & {
  /** The options already on the ability, and the last one. */
  locked: AbilityKey[];
  last: AbilityKey;
  /** Lines it can finish on (0 = the first line). */
  lines: number[];
  /** keep = reset on until it shows up at the wanted value, circ = circulators on every line of the goal, done = it is always at the value. */
  move: "keep" | "circ" | "done";
  circCount: number;
  /** With a limit: as in `PlanAction`. */
  circKind?: CircKind;
  circLeft?: number;
  circChance?: number;
  circMissKeep?: AbilityKey[];
  /** With circulators held: every option shows, then circulators one at a time (what to use, how it goes). */
  run?: PlanRun;
};

export type AbilityPlan = PlanCost & {
  /** Reset to use from scratch (nothing locked). */
  start: Method;
  /** One wanted option shows up first on line 1 (in L1+U2 only the lead options, the others never count there). */
  afterFirst: (PlanStep & { key: AbilityKey })[];
  /** Same, but on line 2 or 3. */
  afterFirstLower: (PlanStep & { key: AbilityKey })[];
  /** A second option after following the plan for the first one (three-line goals). */
  afterTwo: (PlanStep & { keys: [AbilityKey, AbilityKey] })[];
  /** Two presets: the first ability until one goal is met, and the chance each goal is the one met (by goal). */
  first?: PlanCost & { chance: number[] };
  /** With a limit, when asked for (two presets): the cost from scratch with 0, 1, … `circMax` circulators. */
  byBudget?: PlanCost[];
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
  /**
   * Wanted value per option and grade, and the price of a circulator that rerolls the values (0 = free: the black ·
   * chaos circulators of the fame-reset build are event items). Without it values are ignored.
   */
  values?: {
    goal: (key: AbilityKey, grade: "legendary" | "unique") => number;
    circPrice: number;
    /**
     * The black · chaos circulators held (event items, a few at a time — user, 2026-11-15: "400개를 돌리는 건 안 돼",
     * usually 블랙 40 · 카오스 20; the page takes up to 50 of each). Left out: as many as it takes. See `solve`.
     */
    held?: { black: number; chaos: number };
  };
  /** Miracle circulator price (meso). Left out or 0: not used. */
  miraclePrice?: number;
};

/** What is still to pay after goal g is met, in layer r (the circulators left; no limit: r is Infinity). */
type Tails = (g: number, r: number) => PlanCost;

/**
 * Cheapest way to the wanted options, values included.
 * State = locked lines (option + whether its value already meets the goal). After each reset the free lines show
 * options with random values; then: keep going, lock lines (their values stay), or use abyss circulators — they
 * reroll the values of every line and keep options and grades — until the chosen lines meet the goal, then lock them.
 * Finished when one goal holds all its options on lines that count, values at the goal.
 *
 * Several goals (`tails` given): one ability made into whichever goal comes, and `tails(g, r)` is what is still to pay
 * after goal g (another preset made into the other goal, with r circulators left). Locks stay within one goal.
 * Solved exactly by value iteration (locks only grow, flags only go to "met").
 *
 * Circulating early and circulating later often cost about the same on average, but a later circulation rerolls the
 * lines circulated before, and those circulators are lost. So a circulation that rerolls a line already locked at the
 * goal counts one circulator more when choosing (user, 2026-11-15: a guide that circulates and then circulates again
 * for next to nothing is wrong to follow). The costs shown stay the real ones.
 *
 * Circulators held (`values.held`, black and chaos, user 2026-11-15): the state also holds how many of each are left
 * (layer (b, c)). A go runs until every circulated line meets the goal at once or none of its kind are left — black
 * only, chaos only, or chaos first and then black (see the section in the code). With two presets, what is left when
 * the first ability's goal is met goes to the other preset (`tails(g, layer)`). Without them nothing here changes.
 */
function solve(goals: AbilityGoal[], opts: PlanOpts, tails?: Tails, wantBudget = false, wantFirst = true): AbilityPlan {
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
  // A free circulator (the event black · chaos ones) still costs a millionth of the cheapest reset when choosing: used
  // whenever it saves fame, never for nothing, and the plan stays the same whatever the fame price.
  const circPrice = opts.values ? Math.max(opts.values.circPrice, FAME.fame[0] * fameMul * famePrice * 1e-6) : 0;
  const miraclePrice = Math.max(opts.miraclePrice ?? 0, 0);
  // Circulators held, by kind (null = as many as it takes).
  const heldIn = opts.values?.held;
  const whole = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
  const held = opts.values && heldIn ? { black: whole(heldIn.black), chaos: whole(heldIn.chaos) } : null;
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
  const money = (c: PlanCost) => c.fame * famePrice + c.meso + c.circ * circPrice + c.miracle * miraclePrice;
  const tailMoney = (g: number | null, r = Infinity) => (g === null || !tails ? 0 : money(tails(g, r)));

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
  /**
   * Resets worth trying from a state: those of the goal its locks belong to, every goal's when nothing is locked. The
   * miracle circulator takes no locks, so only with nothing locked (with locks it would throw them away), and only for
   * L1+U2: its lines 2 · 3 are unique at best, so it never helps three legendary lines (user, 2026-11-15; never chosen
   * there even for free).
   */
  const miracleOK = miraclePrice > 0 && goals.every((g) => g.mode === "l1u2");
  const methodsAt = (s: FState): Method[] => {
    const locked = [...decF(s).values()];
    const gs = locked.length ? [goalAt(locked[0].t)] : goals;
    const ms = [...new Set(gs.flatMap(methodsOf))];
    return !locked.length && miracleOK ? [...ms, "miracle"] : ms;
  };

  const price = (m: Method, locks: number) =>
    m === "miracle" ? miraclePrice : FAME[m][locks] * fameMul * famePrice + MESO[m][locks];
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
          // The miracle circulator gives the top value of the grade: always at the goal.
          const q = m === "miracle" ? 1 : pFull(l, t);
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

  /**
   * next null = finished (goal = the goal finished). pen = the reroll surcharge (for choosing only, not a cost).
   * Circulating: p = the chance one circulator brings every circulated line to the goal, kept = the circulated lines
   * already at the goal (with a limit they stay when the circulators run out).
   */
  type Choice = {
    next: FState | null;
    circ: number;
    kind: PlanAction["kind"];
    goal: number | null;
    pen: number;
    p?: number;
    lines?: CircLine[];
    /** With circulators held: which kind this go uses. */
    go?: Go;
  };
  const valueOf = (c: Choice) =>
    c.circ * circPrice + c.pen + (c.next === null ? tailMoney(c.goal) : (V.get(c.next) ?? Infinity));
  /** A circulated line: where, which option, at the goal now, and the chance one circulator lands it at the goal. */
  type CircLine = { l: number; t: number; full: boolean; q: number };
  const circLines = (ls: [number, Line][]): CircLine[] => ls.map(([l, v]) => ({ l, t: v.t, full: v.full, q: pFull(l, v.t) }));
  /** Every move after seeing `lines` from `s`; the first one is "keep going as is". */
  const candidates = (lines: Map<number, Line>, s: FState): Choice[] => {
    const out: Choice[] = [{ next: s, circ: 0, kind: "keep", goal: null, pen: 0 }];
    const locked = decF(s);
    // Any circulation from here rerolls the locked lines; one already at the goal (and not always at it) is lost.
    const pen = [...locked].some(([l, v]) => v.full && pFull(l, v.t) < 1) ? circPrice : 0;
    goals.forEach((_, g) => {
      if (!meets(lines, g)) return;
      const mine = [...lines].filter(([, v]) => goalOf[v.t] === g);
      if (mine.every(([, v]) => v.full)) out.push({ next: null, circ: 0, kind: "keep", goal: g, pen: 0 });
      else if (circPrice > 0) {
        // All its options on the item: circulate every line until all of them meet the goal.
        const p = mine.reduce((x, [l, v]) => x * pFull(l, v.t), 1);
        if (p > 0) out.push({ next: null, circ: 1 / p, kind: "circ", goal: g, pen, p, lines: circLines(mine) });
      }
    });
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
      if (set.length) out.push({ next: encF(X), circ: 0, kind: "lock", goal: null, pen: 0 });
      if (circPrice > 0 && [...X.values()].some((v) => !v.full)) {
        // Circulators reroll every line, so all lines of X must meet the goal at once.
        const p = [...X].reduce((x, [l, v]) => x * pFull(l, v.t), 1);
        const met = new Map([...X].map(([l, v]) => [l, { t: v.t, full: true }]));
        if (p > 0) out.push({ next: encF(met), circ: 1 / p, kind: "circ", goal: null, pen, p, lines: circLines([...X]) });
      }
    }
    return out;
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Circulators held (`values.held`, black and chaos — user 2026-11-15: usually 블랙 40 · 카오스 20): the state also
  // holds how many of each are left, layer (b, c). A go of circulators runs until the circulated lines meet the goal at
  // once or none of its kind are left: black only (a result is applied only when all of them meet the goal, so a miss
  // keeps the values), chaos only (every result is applied, so a miss leaves the last one), or chaos first, then black.
  // A hit leaves fewer of that kind (those lines locked), a miss none (the lines at the goal kept — black: the ones worth
  // it, chaos: all of them, as the steps say). Every move leads to fewer circulators or to a state solved before, so the
  // layers are solved row by row (black left), each row from 0 chaos up. The states and results are listed once.
  type Lyr = "u" | number; // "u" = no limit, else the layer b · (C + 1) + c
  type Metric = {
    id: string;
    part: (m: Method, locks: number) => number;
    perCirc: number;
    tail: (g: number, r: number) => number;
  };
  /** One reset of one state: per result its chance and its moves other than going on (flat lists). */
  type Trans = {
    m: Method;
    price: number;
    p: Float64Array;
    /** Moves of result o: from[o] … from[o + 1] − 1. */
    from: Int32Array;
    /** Per move: 0 lock (next = state), 1 finish (next = goal), 2 a go of circulators (next = index in `bursts`). */
    kind: Int8Array;
    next: Int32Array;
  };
  const S = order.length;
  const at = new Map(order.map((s, i) => [s, i] as const));
  const lockCount = order.map((s) => decF(s).size);
  const root = at.get("")!;
  const NB = held ? held.black : 0;
  const NC = held ? held.chaos : 0;
  const W1 = NC + 1;
  const lay = (b: number, c: number) => b * W1 + c;
  const NL = held ? (NB + 1) * W1 : 0;
  /** The plan starts here: no limit, or with every circulator held. */
  const top: Lyr = held ? lay(NB, NC) : "u";
  const bOf = (L: number) => Math.floor(L / W1);
  const cOf = (L: number) => L % W1;
  /** The kinds of go there can be (a kind with none held never shows up). */
  const GOS: Go[] = [
    ...(NB > 0 ? (["black"] as const) : []),
    ...(NC > 0 ? (["chaos"] as const) : []),
    ...(NB > 0 && NC > 0 ? (["both"] as const) : []),
  ];
  /** Circulators a go can use in layer (b, c). */
  const usable = (go: Go, b: number, c: number) => (go === "black" ? b : go === "chaos" ? c : b > 0 && c > 0 ? b + c : 0);
  const used = (p: number, n: number) => (1 - (1 - p) ** n) / p;
  /** Where a hit leads: a state, or −1 − g when it finishes goal g. */
  const hitTo = (c: Choice) => (c.next === null ? -1 - c.goal! : at.get(c.next)!);
  /** Black misses: the circulated lines at the goal before the go (the values stay). */
  const keptOf = (c: Choice): [number, number][] => c.lines!.filter((x) => x.full).map((x) => [x.l, x.t]);
  /** Chaos misses: the last result — each line at the goal by its own chance, not all of them at once. */
  type Fail = { w: number; kept: [number, number][] };
  const rollsOf = (c: Choice): Fail[] => {
    const ls = c.lines!;
    const all = ls.reduce((a, x) => a * x.q, 1);
    const out: Fail[] = [];
    for (let mask = 0; mask < (1 << ls.length) - 1; mask++) {
      const w = ls.reduce((a, x, i) => a * (mask & (1 << i) ? x.q : 1 - x.q), 1) / (1 - all);
      if (w > 0) out.push({ w, kept: ls.filter((_, i) => mask & (1 << i)).map((x) => [x.l, x.t]) });
    }
    return out;
  };
  const stateOf = (kept: [number, number][]) => at.get(encF(new Map(kept.map(([l, t]) => [l, { t, full: true }]))));
  /** After a chaos miss all the lines at the goal stay locked (the guide's rule — Codex review). */
  const missAll = (kept: [number, number][]) => (kept.length <= 2 ? (stateOf(kept) ?? root) : root);
  const Vall = new Float64Array(NL * S);
  /** The states a set of locked lines can be cut down to (unlocking is free), the set itself among them. */
  const cutsOf = (m: Map<number, Line>): number[] => {
    const ls = [...m.entries()];
    const out: number[] = [];
    for (let mask = 0; mask < 1 << ls.length; mask++) {
      const j = at.get(encF(new Map(ls.filter((_, k) => mask & (1 << k)))));
      if (j !== undefined) out.push(j);
    }
    return out;
  };
  /**
   * One circulator at a time (user, 2026-11-16: deciding after each one is what makes the counts held go furthest — it
   * matched another calculator to the 만 and beat a go of many decided at the start by up to 30 %). From a state whose
   * locks are its goal's options but the line-1 one (or all of them): black keeps the old values or takes the new ones,
   * chaos takes the new ones, and after either any lock may be let go. Earlier (one option locked) it never pays more
   * than 0.02 %, so the steps say: lock, then circulate.
   */
  const rollable = new Uint8Array(S);
  /** Per rollable state: each result of one circulator (its chance, the states it can be cut to), and the cuts of now. */
  const rollsAt: { w: number; to: number[] }[][] = order.map(() => []);
  const keepAt: number[][] = order.map(() => []);
  if (held)
    order.forEach((st, i) => {
      const ls = [...decF(st).entries()];
      if (!ls.length) return;
      const g = goalOf[ls[0][1].t];
      if (ls.some(([, v]) => goalOf[v.t] !== g)) return;
      const n = goals[g].keys.length;
      if (!((ls.length === n - 1 && ls.every(([l]) => l > 0)) || ls.length === n)) return;
      const qs = ls.map(([l, v]) => pFull(l, v.t));
      if (qs.every((q) => q >= 1)) return;
      rollable[i] = 1;
      for (let mask = 0; mask < 1 << ls.length; mask++) {
        let w = 1;
        const m = new Map<number, Line>();
        ls.forEach(([l, v], k) => {
          const on = !!(mask & (1 << k));
          w *= qs[k] >= 1 ? (on ? 1 : 0) : on ? qs[k] : 1 - qs[k];
          m.set(l, { t: v.t, full: on });
        });
        if (w > 0) rollsAt[i].push({ w, to: cutsOf(m) });
      }
      keepAt[i] = cutsOf(new Map(ls));
    });
  /** A go that only leads to a rollable state is one circulator at a time from there instead. */
  const intoRoll = (c: Choice) => c.next !== null && rollable[at.get(c.next)!] === 1;
  /** A state whose locks already make a goal at its values (circulated there): that goal is done, no reset more. */
  const doneAt = new Int16Array(S).fill(-1);
  if (held)
    order.forEach((st, i) => {
      const m = decF(st);
      goals.forEach((_, g) => {
        if (doneAt[i] < 0 && meets(m, g) && [...m.values()].every((v) => goalOf[v.t] !== g || v.full)) doneAt[i] = g;
      });
    });
  /** After a black miss, layer (0, c): lock the lines at the goal worth it (more lines on a tie). */
  const missMemo = new Map<string, number>();
  const missBest = (kept: [number, number][], c: number): number => {
    const key = `${kept.map(([l, t]) => `${l}:${t}`).join(",")}|${c}`;
    let j = missMemo.get(key);
    if (j === undefined) {
      const sets: [number, number][][] = [[]];
      for (const x of kept) for (const s of [...sets]) sets.push([...s, x]);
      sets.sort((a, b) => b.length - a.length);
      let best = Infinity;
      j = root;
      for (const s of sets) {
        const i = s.length <= 2 ? stateOf(s) : undefined;
        if (i !== undefined && Vall[lay(0, c) * S + i] < best - 1e-9) [best, j] = [Vall[lay(0, c) * S + i], i];
      }
      missMemo.set(key, j);
    }
    return j;
  };
  // Every go (kind, chance per circulator, where a hit leads, what a miss leaves); `hits` = the (chance, where) pairs,
  // whose sums over the layers below are carried along.
  const hits: { p: number; j: number }[] = [];
  const hitIndex = new Map<string, number>();
  type Burst = { go: Go; hit: number; p: number; pen: number; kept: [number, number][]; rolls: { w: number; to: number }[] };
  const bursts: Burst[] = [];
  const burstIndex = new Map<string, number>();
  const burstOf = (c: Choice, go: Go): number => {
    const hk = `${c.p}|${hitTo(c)}`;
    let h = hitIndex.get(hk);
    if (h === undefined) hitIndex.set(hk, (h = hits.push({ p: c.p!, j: hitTo(c) }) - 1));
    const bk = `${go}|${h}|${c.pen}|${c.lines!.map((x) => `${x.l}:${x.t}:${x.full ? 1 : 0}`).join(",")}`;
    let b = burstIndex.get(bk);
    if (b === undefined) {
      const rolls = go === "black" ? [] : rollsOf(c).map((f) => ({ w: f.w, to: missAll(f.kept) }));
      burstIndex.set(bk, (b = bursts.push({ go, hit: h, p: c.p!, pen: c.pen, kept: keptOf(c), rolls }) - 1));
    }
    return b;
  };
  /**
   * Complete states (circulators held): every option of a goal shows — the line-1 one too, which cannot be locked as a
   * third — with which lines are at the goal (mask). From there one circulator at a time as well, and after one the
   * locks can be cut to any two of the lines (the line-1 option among them). With the line-1 option found first this
   * matched or beat another calculator in every case tried (2026-11-16, e.g. 블랙 50 · 카오스 50 패보상 979.5만 vs 986.5만).
   */
  type Cmp = { g: number; ls: { l: number; t: number; q: number }[]; mask: number; key: string };
  const cmps: Cmp[] = [];
  const cmpIdx = new Map<string, number>();
  const cmpLines = (c: Choice) => c.lines!.map((x) => ({ l: x.l, t: x.t, q: x.q })).sort((a, b) => a.l - b.l);
  const cmpMask = (c: Choice, ls: Cmp["ls"]) =>
    ls.reduce((m, x, k) => m | (x.q >= 1 || c.lines!.find((y) => y.l === x.l)!.full ? 1 << k : 0), 0);
  const cmpKey = (g: number, ls: Cmp["ls"]) => `${g}|${ls.map((x) => `${x.l}:${x.t}`).join(",")}`;
  const cmpOf = (g: number, ls: Cmp["ls"], mask: number): number => {
    const key = cmpKey(g, ls);
    let k = cmpIdx.get(`${key}|${mask}`);
    if (k === undefined) {
      k = cmps.push({ g, ls, mask, key }) - 1;
      cmpIdx.set(`${key}|${mask}`, k);
      for (let m2 = 0; m2 < 1 << ls.length; m2++) if (m2 !== mask) cmpOf(g, ls, m2);
    }
    return k;
  };
  /** The complete state a finishing go starts from (−1: none, after the pass nothing new is made). */
  const cmpAt = (c: Choice) => {
    const ls = cmpLines(c);
    return cmpIdx.get(`${cmpKey(c.goal!, ls)}|${cmpMask(c, ls)}`) ?? -1;
  };
  const trans: Trans[][] = !held
    ? []
    : order.map((s) =>
        methodsAt(s).map((m) => {
          const res = expand(s, m);
          const from = new Int32Array(res.length + 1);
          const kind: number[] = [];
          const next: number[] = [];
          res.forEach((r, o) => {
            from[o] = kind.length;
            // The first candidate is always "go on as is" (it stays): left out, it is what a result falls back to.
            for (const c of candidates(r.lines, s).slice(1)) {
              if (c.kind !== "circ") {
                kind.push(c.next === null ? 1 : 0);
                next.push(c.next === null ? c.goal! : at.get(c.next)!);
              } else if (c.next === null) {
                // Every option shows: the complete state, one circulator at a time (a go of many is never cheaper).
                const ls = cmpLines(c);
                kind.push(3);
                next.push(cmpOf(c.goal!, ls, cmpMask(c, ls)));
              } else if (!intoRoll(c))
                for (const go of GOS) {
                  kind.push(2);
                  next.push(burstOf(c, go));
                }
            }
          });
          from[res.length] = kind.length;
          return {
            m,
            price: price(m, decF(s).size),
            p: Float64Array.from(res, (r) => r.p),
            from,
            kind: Int8Array.from(kind),
            next: Int32Array.from(next),
          };
        }),
      );
  const isReset = (m: Method) => (m === "miracle" ? 0 : 1);
  const tailPart = (key: keyof PlanCost) => (g: number, r: number) => (tails ? tails(g, r)[key] : 0);
  const COSTS: Record<keyof PlanCost, Metric> = {
    fame: { id: "fame", part: (m, l) => FAME[m][l] * fameMul, perCirc: 0, tail: tailPart("fame") },
    meso: { id: "meso", part: (m, l) => MESO[m][l], perCirc: 0, tail: tailPart("meso") },
    circ: { id: "circ", part: () => 0, perCirc: 1, tail: tailPart("circ") },
    resets: { id: "resets", part: isReset, perCirc: 0, tail: tailPart("resets") },
    miracle: { id: "miracle", part: (m) => 1 - isReset(m), perCirc: 0, tail: tailPart("miracle") },
  };
  const COST_KEYS = Object.keys(COSTS) as (keyof PlanCost)[];
  const none = () => 0;
  // Two presets: also the first ability alone (the other preset left out), and the chance each goal is the one met
  // (not when only the total is wanted: one preset after the other).
  const metrics: Metric[] = [
    ...COST_KEYS.map((k) => COSTS[k]),
    ...(tails && wantFirst
      ? [
          ...COST_KEYS.map((k) => ({ ...COSTS[k], id: `${k}:alone`, tail: none })),
          ...goals.map((_, g) => ({ id: `chance:${g}`, part: () => 0, perCirc: 0, tail: (x: number) => (x === g ? 1 : 0) })),
        ]
      : []),
  ];
  const M = metrics.length;
  /** The reset used in every layer (values are kept for every layer: any count can be asked for). */
  const polAll = new Int8Array(NL * S);
  /** Per layer and rollable state: 0 = resets, 1 = one black circulator, 2 = one chaos circulator. */
  const rollAll = new Int8Array(NL * S);
  /** The cheapest of the states `cs` in the layer starting at `base`, and which one. */
  const cheapest = (base: number, cs: number[]) => {
    let v = Infinity;
    let k = -1;
    for (const x of cs)
      if (Vall[base + x] < v) {
        v = Vall[base + x];
        k = x;
      }
    return { v, k };
  };
  // Costs are kept where the steps at the top read them: rows 0 and B, columns 0 and C; and every layer's root.
  const rowsOf = () => metrics.map(() => new Float64Array(W1 * S));
  const colsOf = () => metrics.map(() => new Float64Array((NB + 1) * S));
  let Wrow0 = rowsOf();
  let Wtop = rowsOf();
  const Wcol0 = colsOf();
  const WcolC = colsOf();
  const rootAll = metrics.map(() => new Float64Array(NL));
  /** One cost in layer (b, c) for state i, from what the steps at the top read. */
  const Wat = (mi: number, b: number, c: number, i: number) =>
    b === 0 ? Wrow0[mi][c * S + i] : b === NB ? Wtop[mi][c * S + i] : c === 0 ? Wcol0[mi][b * S + i] : WcolC[mi][b * S + i];

  /** Σ over the circulator k that hits (k = 1 … n): (1 − p)^(k − 1) · p · f(k) — for the steps, worked out directly. */
  const hitSum = (p: number, n: number, f: (k: number) => number) => {
    let s = 0;
    let w = p;
    for (let k = 1; k <= n; k++) {
      s += w * f(k);
      w *= 1 - p;
    }
    return s;
  };
  /**
   * A go of circulators seen from layer L (as the layers above add it up): `left(b, c, j)` = what is left in layer
   * (b, c) at state j (j < 0: after goal −1 − j), `perCirc` = what one circulator counts.
   */
  const goSum = (c: Choice, L: number, left: (b: number, cc: number, j: number) => number, perCirc: number) => {
    const go = c.go!;
    const b = bOf(L);
    const cc = cOf(L);
    const n = usable(go, b, cc);
    if (n === 0) return Infinity;
    const p = c.p!;
    const q = 1 - p;
    const j = hitTo(c);
    let v =
      go === "black"
        ? hitSum(p, b, (k) => left(b - k, cc, j))
        : hitSum(p, cc, (k) => left(b, cc - k, j)) + (go === "both" ? q ** cc * hitSum(p, b, (k) => left(b - k, 0, j)) : 0);
    v +=
      q ** n *
      (go === "black"
        ? left(0, cc, missBest(keptOf(c), cc))
        : rollsOf(c).reduce((s, f) => s + f.w * left(go === "chaos" ? b : 0, 0, missAll(f.kept)), 0));
    return v + used(p, n) * perCirc;
  };
  const vLeft = (b: number, cc: number, j: number) =>
    j >= 0 ? Vall[lay(b, cc) * S + j] : tailMoney(-1 - j, lay(b, cc));
  /** What a move is worth when seen from `s` in layer ly. */
  const valueAt = (c: Choice, s: FState, ly: Lyr): number => {
    if (ly === "u") return valueOf(c);
    if (c.next === s) return Vall[ly * S + at.get(s)!];
    if (c.kind === "circ" && c.next === null) {
      const k = cmpAt(c);
      return k < 0 ? Infinity : VcIn[ly * NK + k];
    }
    if (c.kind === "circ") return goSum(c, ly, vLeft, circPrice) + c.pen;
    if (c.next === null) return tailMoney(c.goal, ly);
    return Vall[ly * S + at.get(c.next)!];
  };
  /**
   * With circulators held, a go is offered once per kind there is (none of a kind left: not offered); one that only
   * leads to a rollable state is one at a time from there, and one that finishes a goal is the complete state.
   */
  const typed = (all: Choice[], ly: Lyr): Choice[] =>
    ly === "u"
      ? all
      : all.flatMap((c) =>
          c.kind !== "circ"
            ? [c]
            : c.next === null
              ? [c]
              : intoRoll(c)
                ? []
                : GOS.filter((go) => usable(go, bOf(ly), cOf(ly)) > 0).map((go) => ({ ...c, go })),
        );
  /** Best move after seeing `lines` (null next = finished). Ties keep the current state. */
  function decide(lines: Map<number, Line>, s: FState, ly: Lyr = "u"): Choice {
    const all = typed(candidates(lines, s), ly);
    let best = all[0];
    let bestV = valueAt(best, s, ly);
    for (const c of all.slice(1)) {
      const v = valueAt(c, s, ly);
      if (v < bestV - 1e-9) [best, bestV] = [c, v];
    }
    return best;
  }
  /** The reset used from `s` in layer ly. */
  const methodAt = (s: FState, ly: Lyr): Method | undefined => {
    if (ly === "u") return policy.get(s);
    const i = at.get(s)!;
    return trans[i][polAll[ly * S + i]].m;
  };
  /**
   * The layer the rows after a move are shown in: the same counts. They are the ones held now — after a go the user
   * types what is left, so the next steps follow it (Codex review: an average left over, taken off again after the user
   * typed the real count, gave the wrong next step).
   */
  const nextLayer = (_c: Choice, ly: Lyr): Lyr => ly;
  /** The options locked in a state. */
  const keysOf = (i: number) => [...decF(order[i]).values()].map((v) => keys[v.t]);

  // The complete states: each result of one circulator (its chance), the cuts to at most two lines, and per layer what
  // one is worth on entering (VcIn: circulate or done) and on arriving after a circulator (VcAt: a cut as well).
  const NK = cmps.length;
  const pop = (m: number) => {
    let n = 0;
    for (; m; m >>= 1) n += m & 1;
    return n;
  };
  const cmpVar = cmps.map((x) => Int32Array.from({ length: 1 << x.ls.length }, (_, m) => cmpIdx.get(`${x.key}|${m}`)!));
  const cmpW = cmps.map((x) =>
    Float64Array.from({ length: 1 << x.ls.length }, (_, m) =>
      x.ls.reduce((w, y, k) => w * (y.q >= 1 ? ((m >> k) & 1 ? 1 : 0) : (m >> k) & 1 ? y.q : 1 - y.q), 1),
    ),
  );
  const cmpCuts = cmps.map((x) => {
    const out: number[] = [];
    for (let m2 = 0; m2 < 1 << x.ls.length; m2++) {
      if (pop(m2) > 2) continue;
      const lines = x.ls.flatMap((y, k) => ((m2 >> k) & 1 ? [[y.l, { t: y.t, full: !!((x.mask >> k) & 1) }] as const] : []));
      const j = at.get(encF(new Map(lines)));
      if (j !== undefined) out.push(j);
    }
    return out;
  });
  const VcIn = new Float64Array(NL * NK);
  const VcAt = new Float64Array(NL * NK);
  /** Per layer and complete state: 1 = one black circulator, 2 = one chaos (0 = done or none left). */
  const cmpPick = new Int8Array(NL * NK);
  /** The costs of entering each complete state at the counts held (what the steps show). */
  const WcTop = new Float64Array(NK * M);

  if (held) {
    const H = hits.length;
    const X = bursts.length;
    // Sums over the circulator that hits, carried along: black along b (one per chaos count), chaos along c.
    const hvB = new Float64Array(W1 * H);
    const hvC = new Float64Array(H);
    const hwB = metrics.map(() => new Float64Array(W1 * H));
    const hwC = metrics.map(() => new Float64Array(H));
    // Per go, in the layer being solved: its worth, (1 − p)^n, circulators used on average, what a miss leaves.
    const gv = new Float64Array(X);
    const gq = new Float64Array(X);
    const gu = new Float64Array(X);
    /** Black misses: the state locked for each chaos count (layer (0, c)), set once row 0 is solved. */
    const bMiss = new Int32Array(X * W1);
    // (1 − p)^b and (1 − p)^c per hit in the layer being solved.
    const qB = new Float64Array(H).fill(1);
    const qC = new Float64Array(H);
    // The costs of a go in the layer, worked out once (every result that takes it shares them): stamp = layer + 1.
    const gcStamp = new Int32Array(X);
    const gcW = new Float64Array(X * M);
    let Wprev = rowsOf();
    let Wcur = rowsOf();
    const most = Math.max(1, ...trans.flat().map((t) => t.p.length));
    const best = new Float64Array(most);
    const rest = new Float64Array(M);
    // Every move's worth in the layer, worked out once for both passes (the best per result, then the move taken).
    const cache = trans.map((ts) => ts.map((t) => new Float64Array(t.kind.length)));
    const tailV = new Float64Array(goals.length);
    const tailW = new Float64Array(M * goals.length);
    // Complete states: costs on entering in the layer being solved, and on arriving in rows b − 1 and b (per chaos count).
    const WcIn = new Float64Array(NK * M);
    let WcAtPrev = new Float64Array(W1 * NK * M);
    let WcAtCur = new Float64Array(W1 * NK * M);
    /** Smallest V with V = c + Σ p · min(V, a): a result is taken when its best move is worth less than going on. */
    const settle = (c: number, p: Float64Array, a: Float64Array) => {
      let V = Infinity;
      for (;;) {
        let P = 0;
        let A = 0;
        for (let o = 0; o < p.length; o++)
          if (a[o] < V) {
            P += p[o];
            A += p[o] * a[o];
          }
        const next = P > 0 ? (c + A) / P : Infinity;
        if (!(next < V)) return V;
        V = next;
      }
    };
    for (let b = 0; b <= NB; b++) {
      if (b === 1)
        bursts.forEach((x, i) => {
          if (x.go === "black") for (let c = 0; c <= NC; c++) bMiss[i * W1 + c] = missBest(x.kept, c);
        });
      if (b > 0)
        for (let h = 0; h < H; h++) {
          const { p, j } = hits[h];
          qB[h] *= 1 - p;
          for (let c = 0; c <= NC; c++) {
            const L = lay(b - 1, c);
            const at = c * H + h;
            hvB[at] = p * (j >= 0 ? Vall[L * S + j] : tailMoney(-1 - j, L)) + (1 - p) * hvB[at];
            for (let mi = 0; mi < M; mi++)
              hwB[mi][at] = p * (j >= 0 ? Wprev[mi][c * S + j] : metrics[mi].tail(-1 - j, L)) + (1 - p) * hwB[mi][at];
          }
        }
      for (let c = 0; c <= NC; c++) {
        const L = lay(b, c);
        if (c === 0) {
          hvC.fill(0);
          for (const w of hwC) w.fill(0);
          qC.fill(1);
        } else
          for (let h = 0; h < H; h++) {
            const { p, j } = hits[h];
            qC[h] *= 1 - p;
            hvC[h] = p * (j >= 0 ? Vall[(L - 1) * S + j] : tailMoney(-1 - j, L - 1)) + (1 - p) * hvC[h];
            for (let mi = 0; mi < M; mi++)
              hwC[mi][h] = p * (j >= 0 ? Wcur[mi][(c - 1) * S + j] : metrics[mi].tail(-1 - j, L - 1)) + (1 - p) * hwC[mi][h];
          }
        for (let g = 0; g < goals.length; g++) {
          tailV[g] = tailMoney(g, L);
          for (let mi = 0; mi < M; mi++) tailW[mi * goals.length + g] = metrics[mi].tail(g, L);
        }
        // Entering a complete state here: done, else the cheaper of one black (keep the old values or take the new) and
        // one chaos (take the new) — the layers below are solved. None left: not entered (the result goes on as is).
        for (let k = 0; k < NK; k++) {
          const x = cmps[k];
          let v = Infinity;
          let pick = 0;
          if (pop(x.mask) === x.ls.length) {
            v = tailV[x.g];
            for (let mi = 0; mi < M; mi++) WcIn[k * M + mi] = tailW[mi * goals.length + x.g];
          } else
            for (const kind of [1, 2] as const) {
              if (kind === 1 ? b === 0 : c === 0) continue;
              const L2 = kind === 1 ? lay(b - 1, c) : lay(b, c - 1);
              let r = circPrice;
              const ws = cmpW[k];
              for (let m2 = 0; m2 < ws.length; m2++)
                if (ws[m2] > 0) {
                  const nk = cmpVar[k][m2];
                  r += ws[m2] * (kind === 1 ? Math.min(VcAt[L2 * NK + k], VcAt[L2 * NK + nk]) : VcAt[L2 * NK + nk]);
                }
              if (r < v - 1e-9) [v, pick] = [r, kind];
            }
          VcIn[L * NK + k] = v;
          cmpPick[L * NK + k] = pick;
          if (pick) {
            const L2 = pick === 1 ? lay(b - 1, c) : lay(b, c - 1);
            for (let mi = 0; mi < M; mi++) {
              let w = metrics[mi].perCirc;
              const ws = cmpW[k];
              for (let m2 = 0; m2 < ws.length; m2++)
                if (ws[m2] > 0) {
                  const nk = cmpVar[k][m2];
                  const to = pick === 2 || VcAt[L2 * NK + nk] < VcAt[L2 * NK + k] ? nk : k;
                  w += ws[m2] * (pick === 1 ? WcAtPrev[(c * NK + to) * M + mi] : WcAtCur[((c - 1) * NK + to) * M + mi]);
                }
              WcIn[k * M + mi] = w;
            }
          }
          if (L === top) for (let mi = 0; mi < M; mi++) WcTop[k * M + mi] = WcIn[k * M + mi];
        }
        // Each go here: the hit sums, then what a miss leaves (black: as before, layer (0, c); chaos: the last result,
        // layer (b, 0); chaos then black: layer (0, 0)), the circulators and the surcharge.
        bursts.forEach((x, i) => {
          const n = usable(x.go, b, c);
          if (n === 0) {
            gv[i] = Infinity;
            return;
          }
          const qn = x.go === "black" ? qB[x.hit] : x.go === "chaos" ? qC[x.hit] : qB[x.hit] * qC[x.hit];
          gq[i] = qn;
          gu[i] = (1 - qn) / x.p;
          let v: number;
          let miss = 0;
          if (x.go === "black") {
            v = hvB[c * H + x.hit];
            miss = Vall[lay(0, c) * S + bMiss[i * W1 + c]];
          } else {
            const base = x.go === "chaos" ? lay(b, 0) * S : 0;
            for (const r of x.rolls) miss += r.w * Vall[base + r.to];
            v = hvC[x.hit] + (x.go === "both" ? qC[x.hit] * hvB[x.hit] : 0);
          }
          gv[i] = v + qn * miss + gu[i] * circPrice + x.pen;
        });
        /** Every cost of go i here (into gcW), once per layer. */
        const goCosts = (i: number) => {
          if (gcStamp[i] === L + 1) return;
          gcStamp[i] = L + 1;
          const x = bursts[i];
          for (let mi = 0; mi < M; mi++) {
            let v: number;
            let miss = 0;
            if (x.go === "black") {
              v = hwB[mi][c * H + x.hit];
              miss = Wrow0[mi][c * S + bMiss[i * W1 + c]];
            } else {
              const row = x.go === "chaos" ? Wcur[mi] : Wrow0[mi];
              for (const r of x.rolls) miss += r.w * row[r.to];
              v = hwC[mi][x.hit] + (x.go === "both" ? qC[x.hit] * hwB[mi][x.hit] : 0);
            }
            gcW[i * M + mi] = v + gq[i] * miss + gu[i] * metrics[mi].perCirc;
          }
        };
        for (let i = 0; i < S; i++) {
          if (doneAt[i] >= 0) {
            const g = doneAt[i];
            Vall[L * S + i] = tailV[g];
            for (let mi = 0; mi < M; mi++) {
              Wcur[mi][c * S + i] = tailW[mi * goals.length + g];
              if (i === root) rootAll[mi][L] = Wcur[mi][c * S + i];
            }
            continue;
          }
          let v = Infinity;
          let pol = 0;
          trans[i].forEach((t, mi) => {
            const a = best.subarray(0, t.p.length);
            const cv = cache[i][mi];
            for (let o = 0; o < t.p.length; o++) {
              let m = Infinity;
              for (let x = t.from[o]; x < t.from[o + 1]; x++) {
                const k = t.kind[x];
                const y =
                  k === 0 ? Vall[L * S + t.next[x]] : k === 1 ? tailV[t.next[x]] : k === 3 ? VcIn[L * NK + t.next[x]] : gv[t.next[x]];
                cv[x] = y;
                if (y < m) m = y;
              }
              a[o] = m;
            }
            const w = settle(t.price, t.p, a);
            if (w < v) [v, pol] = [w, mi];
          });
          // One circulator instead of a reset (the layers below are solved): black keeps the cheaper of the old values
          // and the new ones, chaos takes the new ones; then the cheapest cut of the locks.
          let roll = 0;
          if (rollable[i]) {
            if (b > 0) {
              const base = lay(b - 1, c) * S;
              const keep = cheapest(base, keepAt[i]).v;
              let r = circPrice;
              for (const x of rollsAt[i]) r += x.w * Math.min(keep, cheapest(base, x.to).v);
              if (r < v - 1e-9) [v, roll] = [r, 1];
            }
            if (c > 0) {
              const base = lay(b, c - 1) * S;
              let r = circPrice;
              for (const x of rollsAt[i]) r += x.w * cheapest(base, x.to).v;
              if (r < v - 1e-9) [v, roll] = [r, 2];
            }
          }
          Vall[L * S + i] = v;
          polAll[L * S + i] = pol;
          rollAll[L * S + i] = roll;
          if (roll) {
            const base = (roll === 1 ? lay(b - 1, c) : lay(b, c - 1)) * S;
            const keep = roll === 1 ? cheapest(base, keepAt[i]) : null;
            for (let mi = 0; mi < M; mi++) {
              let w = metrics[mi].perCirc;
              for (const x of rollsAt[i]) {
                const to = cheapest(base, x.to);
                const k = keep && keep.v <= to.v ? keep.k : to.k;
                w += x.w * (roll === 1 ? Wprev[mi][c * S + k] : Wcur[mi][(c - 1) * S + k]);
              }
              Wcur[mi][c * S + i] = w;
              if (i === root) rootAll[mi][L] = w;
            }
            continue;
          }
          // The move per result, chosen as `decide` does (the first one cheaper than going on and the ones before it),
          // and every cost under it.
          const t = trans[i][pol];
          const cv = cache[i][pol];
          let stay = 0;
          rest.fill(0);
          for (let o = 0; o < t.p.length; o++) {
            let pick = -1;
            let pv = v;
            for (let x = t.from[o]; x < t.from[o + 1]; x++)
              if (cv[x] < pv - 1e-9) [pv, pick] = [cv[x], x];
            if (pick < 0) {
              stay += t.p[o];
              continue;
            }
            const k = t.kind[pick];
            const nx = t.next[pick];
            const po = t.p[o];
            if (k === 0) for (let mi = 0; mi < M; mi++) rest[mi] += po * Wcur[mi][c * S + nx];
            else if (k === 1) for (let mi = 0; mi < M; mi++) rest[mi] += po * tailW[mi * goals.length + nx];
            else if (k === 3) for (let mi = 0; mi < M; mi++) rest[mi] += po * WcIn[nx * M + mi];
            else {
              goCosts(nx);
              for (let mi = 0; mi < M; mi++) rest[mi] += po * gcW[nx * M + mi];
            }
          }
          for (let mi = 0; mi < M; mi++) {
            const w = stay < 1 - 1e-15 ? (metrics[mi].part(t.m, lockCount[i]) + rest[mi]) / (1 - stay) : Infinity;
            Wcur[mi][c * S + i] = w;
            if (i === root) rootAll[mi][L] = w;
          }
        }
        // Arriving at a complete state here (after a circulator from above): also any cut of the locks, solved now.
        for (let k = 0; k < NK; k++) {
          let v = VcIn[L * NK + k];
          let cut = -1;
          for (const j of cmpCuts[k]) if (Vall[L * S + j] < v - 1e-9) [v, cut] = [Vall[L * S + j], j];
          VcAt[L * NK + k] = v;
          for (let mi = 0; mi < M; mi++) WcAtCur[(c * NK + k) * M + mi] = cut < 0 ? WcIn[k * M + mi] : Wcur[mi][c * S + cut];
        }
        for (let mi = 0; mi < M; mi++) {
          if (c === 0) Wcol0[mi].set(Wcur[mi].subarray(0, S), b * S);
          if (c === NC) WcolC[mi].set(Wcur[mi].subarray(NC * S, W1 * S), b * S);
        }
      }
      if (b === 0) Wrow0 = Wcur.map((w) => w.slice());
      if (b === NB) Wtop = Wcur;
      [Wprev, Wcur] = [Wcur, Wprev];
      [WcAtPrev, WcAtCur] = [WcAtCur, WcAtPrev];
    }
  } else
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
            else sum += r.p * (c.circ * circPrice + c.pen + (c.next === null ? tailMoney(c.goal) : V.get(c.next)!));
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
  const tailOf = (k: keyof PlanCost) => (g: number) => (tails ? tails(g, Infinity)[k] : 0);
  const unlimited = !held;
  const fameW = unlimited ? evalPart((m, l) => FAME[m][l] * fameMul, 0, tailOf("fame")) : new Map<FState, number>();
  const mesoW = unlimited ? evalPart((m, l) => MESO[m][l], 0, tailOf("meso")) : new Map<FState, number>();
  const resetW = unlimited ? evalPart(isReset, 0, tailOf("resets")) : new Map<FState, number>();
  const circW = unlimited ? evalPart(() => 0, 1, tailOf("circ")) : new Map<FState, number>();
  const miracleW = unlimited ? evalPart((m) => 1 - isReset(m), 0, tailOf("miracle")) : new Map<FState, number>();

  /** What a move leaves to pay (circulators of the move included). */
  const leftAfter = (c: Choice, ly: Lyr = "u"): PlanCost => {
    if (ly !== "u") {
      // The steps are shown at the top layer (the counts held), where the costs are kept.
      const of = (mi: number) => {
        const k = metrics[mi];
        const left = (b: number, cc: number, j: number) => (j >= 0 ? Wat(mi, b, cc, j) : k.tail(-1 - j, lay(b, cc)));
        if (c.kind === "circ" && c.next === null) {
          const x = cmpAt(c);
          return x < 0 ? Infinity : WcTop[x * M + mi];
        }
        if (c.kind === "circ") return goSum(c, ly, left, k.perCirc);
        return c.next === null ? k.tail(c.goal!, ly) : left(bOf(ly), cOf(ly), at.get(c.next)!);
      };
      return Object.fromEntries(COST_KEYS.map((key, mi) => [key, of(mi)])) as PlanCost;
    }
    const to = c.next;
    const tail = c.goal !== null && tails ? tails(c.goal, Infinity) : null;
    const left = (W: Map<FState, number>, k: keyof PlanCost) =>
      to === null ? (tail ? tail[k] : 0) : W.get(to)!;
    return {
      fame: left(fameW, "fame"),
      meso: left(mesoW, "meso"),
      circ: c.circ + left(circW, "circ"),
      resets: left(resetW, "resets"),
      miracle: left(miracleW, "miracle"),
    };
  };
  const actionOf = (c: Choice, ly: Lyr = "u"): PlanAction => {
    if (ly === "u") return { kind: c.kind, method: policy.get(c.next ?? "") ?? "fame", circCount: c.circ };
    const action: PlanAction = { kind: c.kind, method: methodAt(c.next ?? "", nextLayer(c, ly)) ?? "fame", circCount: 0 };
    if (c.kind === "circ" && c.next === null) {
      // Every option shows: one circulator at a time from the complete state (the run says how).
      action.circCount = cmpRunOf(cmpAt(c), ly)?.circCount ?? 0;
      return action;
    }
    if (c.kind === "circ") {
      const n = usable(c.go!, bOf(ly), cOf(ly));
      action.circKind = c.go;
      action.circCount = used(c.p!, n);
      action.circLeft = n;
      action.circChance = 1 - (1 - c.p!) ** n;
      // What is locked after the last miss, when that is known (black: the values stay; chaos: only when the miss can
      // leave just one picture) — Codex review: the guide shows that way too.
      const rolls = c.go === "black" ? [] : rollsOf(c);
      if (c.go === "black") action.circMissKeep = keysOf(missBest(keptOf(c), cOf(ly)));
      else if (rolls.length === 1) action.circMissKeep = keysOf(missAll(rolls[0].kept));
    }
    return action;
  };

  /**
   * One set at the goal kept as the counts go down from layer L0 (chaos takes one from c, black one from b): the first
   * move that differs from the one before — chaos running out into black aside — and how many of that kind are left then.
   */
  const switchOf = <A extends { use: RunUse }>(act: (L: number) => A, L0: number, kept: (a: A) => AbilityKey[]) => {
    let b = bOf(L0);
    let c = cOf(L0);
    let prev = act(L0);
    while (prev.use !== "stop") {
      if (prev.use === "chaos") c--;
      else b--;
      if (b + c === 0) return undefined;
      const d = act(lay(b, c));
      const outOfChaos = prev.use === "chaos" && c === 0 && d.use === "black";
      if (d.use !== prev.use && !outOfChaos)
        return {
          kind: prev.use,
          at: prev.use === "chaos" ? c : b,
          use: d.use,
          ...(d.use === "stop" ? { keep: kept(d) } : {}),
        };
      prev = d;
    }
    return undefined;
  };

  /**
   * The same from complete state k0 (every option shows): what to use for each set of its lines at the goal (the line-1
   * option among them; lines always at their value are not named), how many on average and the chance all end at it.
   */
  function cmpRunOf(k0: number, ly: Lyr): PlanRun | undefined {
    if (k0 < 0 || ly === "u") return undefined;
    const L0 = ly;
    const x = cmps[k0];
    const all = (1 << x.ls.length) - 1;
    const fixed = x.ls.reduce((m, y, k) => (y.q >= 1 ? m | (1 << k) : m), 0);
    const kAt = (mask: number) => cmpVar[k0][mask | fixed];
    const act = (mask: number, L: number) => {
      const k = kAt(mask);
      let v = VcIn[L * NK + k];
      let cut = -1;
      for (const j of cmpCuts[k]) if (Vall[L * S + j] < v - 1e-9) [v, cut] = [Vall[L * S + j], j];
      if (cut >= 0) return { use: "stop" as const, k, cut };
      const p = cmpPick[L * NK + k];
      return { use: p === 2 ? ("chaos" as const) : p === 1 ? ("black" as const) : ("stop" as const), k, cut };
    };
    const memo = new Map<number, [number, number]>();
    const walk = (mask: number, L: number): [number, number] => {
      if ((mask | fixed) === all) return [1, 0];
      const key = L * (all + 1) + mask;
      const hit = memo.get(key);
      if (hit) return hit;
      const a = act(mask, L);
      let out: [number, number] = [0, 0];
      if (a.use !== "stop") {
        const L2 = a.use === "black" ? lay(bOf(L) - 1, cOf(L)) : lay(bOf(L), cOf(L) - 1);
        out = [0, 1];
        const ws = cmpW[k0];
        for (let m2 = 0; m2 <= all; m2++) {
          if (!(ws[m2] > 0)) continue;
          const take = a.use === "chaos" || VcAt[L2 * NK + cmpVar[k0][m2]] < VcAt[L2 * NK + a.k];
          const [p, e] = walk(take ? m2 : mask, L2);
          out = [out[0] + ws[m2] * p, out[1] + ws[m2] * e];
        }
      }
      memo.set(key, out);
      return out;
    };
    // Nothing to circulate from where it starts (at the goal already, or the plan stops there): no run (Codex review).
    if ((x.mask | fixed) === all || act(x.mask, L0).use === "stop") return undefined;
    const [chance, circCount] = walk(x.mask, L0);
    const named = x.ls.flatMap((y, k) => (fixed & (1 << k) ? [] : [{ k, key: keys[y.t], l: y.l }]));
    const masks = Array.from({ length: all + 1 }, (_, m) => m).filter((m) => (m & fixed) === fixed && m !== all);
    masks.sort((m1, m2) => VcAt[L0 * NK + kAt(m1)] - VcAt[L0 * NK + kAt(m2)]);
    const kept = (a: { cut: number }) => (a.cut >= 0 ? [...decF(order[a.cut]).values()].map((v) => keys[v.t]) : []);
    const by = masks.map((m) => {
      const a = act(m, L0);
      const have = named.filter((y) => m & (1 << y.k)).map((y) => y.key);
      const then = switchOf<ReturnType<typeof act>>((L) => act(m, L), L0, kept);
      return { have, use: a.use, ...(a.use === "stop" ? { keep: kept(a) } : {}), ...(then ? { then } : {}) };
    });
    return { keys: named.map((y) => y.key), lines: named.map((y) => y.l), by, circCount, chance };
  }

  /**
   * From rollable state s at the counts of layer ly: what to use for each set of its lines at the goal, and — following
   * that from s, cutting the locks whenever the plan does — the circulators used and the chance all of them end at it.
   */
  const runOf = (s: FState | null, ly: Lyr): PlanRun | undefined => {
    if (s === null || ly === "u") return undefined;
    const s0 = at.get(s);
    if (s0 === undefined || !rollable[s0]) return undefined;
    const ls = [...decF(s).entries()].sort((a, b) => a[0] - b[0]);
    const qs = ls.map(([l, v]) => pFull(l, v.t));
    const all = (1 << ls.length) - 1;
    const fixed = qs.reduce((m, q, k) => (q >= 1 ? m | (1 << k) : m), 0);
    const stateAt = (mask: number) =>
      at.get(encF(new Map(ls.map(([l, v], k) => [l, { t: v.t, full: !!((mask | fixed) & (1 << k)) }]))))!;
    const maskOf = (j: number) => ls.reduce((m, [l], k) => (decF(order[j]).get(l)?.full ? m | (1 << k) : m), 0);
    /** Arriving with `mask` at the goal in layer L: the cheapest cut of the locks, else the move the plan makes there. */
    const act = (mask: number, L: number) => {
      const j = stateAt(mask);
      const cut = cheapest(L * S, cutsOf(decF(order[j])));
      if (cut.k !== j && cut.v < Vall[L * S + j] - 1e-9) return { use: "stop" as const, j: cut.k };
      const r = rollAll[L * S + j];
      return { use: r === 2 ? ("chaos" as const) : r === 1 ? ("black" as const) : ("stop" as const), j };
    };
    const memo = new Map<number, [number, number]>();
    const walk = (mask: number, L: number): [number, number] => {
      if ((mask | fixed) === all) return [1, 0];
      const key = L * (all + 1) + mask;
      const hit = memo.get(key);
      if (hit) return hit;
      const a = act(mask, L);
      let out: [number, number] = [0, 0];
      if (a.use !== "stop") {
        const L2 = a.use === "black" ? lay(bOf(L) - 1, cOf(L)) : lay(bOf(L), cOf(L) - 1);
        const old = cheapest(L2 * S, keepAt[a.j]).v;
        out = [0, 1];
        for (let m2 = 0; m2 <= all; m2++) {
          if ((m2 & fixed) !== fixed) continue;
          const w = ls.reduce((p, _, k) => (fixed & (1 << k) ? p : p * ((m2 >> k) & 1 ? qs[k] : 1 - qs[k])), 1);
          if (w === 0) continue;
          const take = a.use === "chaos" || cheapest(L2 * S, cutsOf(decF(order[stateAt(m2)]))).v < old;
          const [p, e] = walk(take ? m2 : mask, L2);
          out = [out[0] + w * p, out[1] + w * e];
        }
      }
      memo.set(key, out);
      return out;
    };
    const L0 = ly as number;
    // Nothing to circulate from where it starts (at the goal already, or the plan stops there): no run (Codex review).
    const m0 = maskOf(s0);
    if ((m0 | fixed) === all || act(m0, L0).use === "stop") return undefined;
    const [chance, circCount] = walk(m0, L0);
    const name = (mask: number) => ls.filter((_, k) => (mask & (1 << k)) && !(fixed & (1 << k))).map(([, v]) => keys[v.t]);
    const masks = Array.from({ length: all + 1 }, (_, m) => m).filter((m) => (m & fixed) === fixed && m !== all);
    masks.sort((x, y) => cheapest(L0 * S, cutsOf(decF(order[stateAt(x)]))).v - cheapest(L0 * S, cutsOf(decF(order[stateAt(y)]))).v);
    const kept = (a: { j: number }) => [...decF(order[a.j]).values()].map((v) => keys[v.t]);
    const by = masks.map((m) => {
      const a = act(m, L0);
      const then = switchOf<ReturnType<typeof act>>((L) => act(m, L), L0, kept);
      return { have: name(m), use: a.use, ...(a.use === "stop" ? { keep: kept(a) } : {}), ...(then ? { then } : {}) };
    });
    return { keys: ls.map(([, v]) => keys[v.t]), lines: ls.map(([l]) => l), by, circCount, chance };
  };

  /** What happens after `lines` are seen from state `from`, what is left, and what the other moves would leave. */
  const after = (lines: Map<number, Line>, goal: number, from: FState = "", ly: Lyr = "u") => {
    const c = decide(lines, from, ly);
    // The cheapest move of each kind; finishing is not an alternative (it never shows up here).
    const byKind = new Map<PlanAction["kind"], Choice>();
    for (const x of typed(candidates(lines, from), ly)) {
      if (x.next === null && x.kind === "keep") continue;
      const cur = byKind.get(x.kind);
      if (!cur || valueAt(x, from, ly) < valueAt(cur, from, ly) - 1e-9) byKind.set(x.kind, x);
    }
    byKind.set(c.kind, c);
    const choices = [...byKind.values()]
      .filter((x) => Number.isFinite(valueAt(x, from, ly)))
      .sort((a, b) => (a === c ? -1 : b === c ? 1 : valueAt(a, from, ly) - valueAt(b, from, ly)))
      .map((x) => ({ action: actionOf(x, ly), ...leftAfter(x, ly) }));
    // Every option shows and the values are circulated one at a time: how (the steps say it under the row).
    const cmpRun = c.kind === "circ" && c.next === null ? cmpRunOf(cmpAt(c), ly) : undefined;
    return { next: c.next, nextLy: nextLayer(c, ly), goal, action: actionOf(c, ly), ...leftAfter(c, ly), choices, cmpRun };
  };
  /**
   * A wanted option that just showed up from state `from`: its value meets the goal only by luck (always, when there is
   * one value, or when the reset there is the miracle circulator, which gives the top value — Codex review).
   */
  const fresh = (line: number, t: number, from: FState, ly: Lyr = "u"): Line => ({
    t,
    full: !opts.values || methodAt(from, ly) === "miracle" || pFull(line, t) >= 1,
  });
  const strip = <T extends { next: FState | null; nextLy: Lyr }>(x: T) => {
    const { next: _next, nextLy: _nextLy, ...rest } = x;
    void _next;
    void _nextLy;
    return rest;
  };
  /** Option t may count on this line (L1+U2: line 1 only for a lead option, lines 2 · 3 not for the sole lead). */
  const canCount = (line: number, t: number) =>
    goalAt(t).mode === "l3" || (line === 0 ? leadOK(t) : !soleLead(t));

  /**
   * From `s`, only one option of its goal is missing: the move when it shows up (below the wanted value, unless it is
   * always at it) on each line where it finishes the goal. One entry per kind of move.
   */
  const finishFrom = (s: FState, ly: Lyr = "u"): PlanFinish[] | undefined => {
    const L = decF(s);
    if (!L.size) return undefined;
    const g = goalOf[[...L.values()][0].t];
    const have = new Set([...L.values()].map((v) => v.t));
    const missing = keys.map((_, t) => t).filter((t) => goalOf[t] === g && !have.has(t));
    if (missing.length !== 1) return undefined;
    const c = missing[0];
    const byMove = new Map<string, PlanFinish>();
    for (const line of [0, 1, 2]) {
      if (L.has(line) || !canCount(line, c)) continue;
      const lines = new Map(L).set(line, fresh(line, c, s, ly));
      if (!meets(lines, g)) continue;
      const d = decide(lines, s, ly);
      const move: PlanFinish["move"] = d.kind === "circ" ? "circ" : d.next === null ? "done" : "keep";
      const a = actionOf(d, ly);
      const run = d.kind === "circ" && d.next === null ? cmpRunOf(cmpAt(d), ly) : undefined;
      // Same move, same circulators (Codex review: what is left is counted after the move, like every other row).
      const id = `${move}:${Math.round(a.circCount * 1e6)}`;
      const cur = byMove.get(id);
      if (cur) cur.lines.push(line);
      else
        byMove.set(id, {
          ...leftAfter(d, ly),
          locked: [...L.values()].map((v) => keys[v.t]),
          last: keys[c],
          lines: [line],
          move,
          circCount: a.circCount,
          ...(a.circLeft !== undefined
            ? { circKind: a.circKind, circLeft: a.circLeft, circChance: a.circChance, circMissKeep: a.circMissKeep }
            : {}),
          ...(run ? { run } : {}),
        });
    }
    return byMove.size ? [...byMove.values()] : undefined;
  };

  /**
   * Option t shows up on `line` from state `from`, its value below the goal (unless it is always at it). Also the move
   * when it shows the wanted value, if that is a different idea (keep below it, lock at it): then the steps after it
   * follow that case. `finish` = how the goal ends when only its last option is left after the move.
   */
  const row = (from: FState, line: number, t: number, ly: Lyr = "u") => {
    const base = decF(from);
    const below = new Map(base).set(line, fresh(line, t, from, ly));
    const r = after(below, goalOf[t], from, ly);
    let next = r.next;
    let nextLy = r.nextLy;
    let atGoal: PlanAction | undefined;
    let atGoalLeft: PlanCost | undefined;
    let nextAtGoal: boolean | undefined;
    if (!below.get(line)!.full) {
      const c = decide(new Map(base).set(line, { t, full: true }), from, ly);
      if (r.action.kind === "keep" && c.kind !== "keep") {
        atGoal = actionOf(c, ly);
        atGoalLeft = leftAfter(c, ly);
        if (r.next === from) {
          next = c.next;
          nextLy = nextLayer(c, ly);
          nextAtGoal = true;
        }
      }
    }
    const lockRun = next !== from ? runOf(next, nextLy) : undefined;
    // After a run the lines are at the goal: the last option is looked at from there.
    const done = lockRun && next !== null ? encF(new Map([...decF(next)].map(([l, v]) => [l, { t: v.t, full: true }]))) : next;
    const finish = done !== null && next !== from ? finishFrom(done, nextLy) : undefined;
    const { cmpRun, ...rest } = r;
    const run = lockRun ?? (atGoal ? undefined : cmpRun);
    return { ...rest, next, nextLy, line, atGoal, atGoalLeft, nextAtGoal, finish, ...(run ? { run } : {}) };
  };

  // One option first on line 1 (always legendary). In L1+U2 only a lead option counts there; the others are left out
  // (on line 1 they are just rerolled).
  const afterFirst = keys.flatMap((key, t) => (canCount(0, t) ? [{ key, ...strip(row("", 0, t, top)) }] : []));
  // One option first on line 2 (lines 2 and 3 behave the same). The one option that has to be line 1 cannot sit there.
  const lowerFirst = keys.map((key, t) => (soleLead(t) ? null : { key, t, ...row("", 1, t, top) }));
  const afterFirstLower = lowerFirst
    .filter((x) => x !== null)
    .map((x) => {
      const { t: _t, next: _next, nextLy: _nextLy, ...rest } = x;
      void _t;
      void _next;
      void _nextLy;
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
    // Not kept (no lock, not even at the goal): the next reset rerolls it, so no "second option" step (Codex review).
    if (!done.next) continue;
    for (let second = 0; second < n; second++) {
      if (second === first || goalOf[second] !== goalOf[first]) continue;
      const secondLine = goalAt(second).mode === "l1u2" && soleLead(second) ? 0 : 2;
      afterTwo.push({
        keys: [keys[first], keys[second]],
        ...strip(row(done.next, secondLine, second, done.nextLy)),
      });
    }
  }

  // Several goals: the first ability alone (until one goal is met, the other preset left out), and how likely each
  // goal is the one it ends as (user, 2026-11-14: "either counts, so it is cheaper").
  const atTop = (mi: number) => rootAll[mi][top as number];
  const first = !tails || !wantFirst
    ? undefined
    : unlimited
      ? {
          fame: evalPart((m, l) => FAME[m][l] * fameMul, 0, none).get("")!,
          meso: evalPart((m, l) => MESO[m][l], 0, none).get("")!,
          resets: evalPart(isReset, 0, none).get("")!,
          circ: evalPart(() => 0, 1, none).get("")!,
          miracle: evalPart((m) => 1 - isReset(m), 0, none).get("")!,
          chance: goals.map((_, g) => evalPart(() => 0, 0, (x) => (x === g ? 1 : 0)).get("")!),
        }
      : {
          ...(Object.fromEntries(COST_KEYS.map((key, i) => [key, atTop(COST_KEYS.length + i)])) as PlanCost),
          chance: goals.map((_, g) => atTop(2 * COST_KEYS.length + g)),
        };

  // The cost from scratch with every count of circulators held, by layer (one preset of two: what is left for it).
  const byBudget =
    held && wantBudget
      ? Array.from(
          { length: NL },
          (_, L) => Object.fromEntries(COST_KEYS.map((key, mi) => [key, rootAll[mi][L]])) as PlanCost,
        )
      : undefined;

  const rootCost = (key: keyof PlanCost) =>
    unlimited
      ? { fame: fameW, meso: mesoW, circ: circW, resets: resetW, miracle: miracleW }[key].get("")!
      : atTop(COST_KEYS.indexOf(key));
  return {
    fame: rootCost("fame"),
    meso: rootCost("meso"),
    resets: rootCost("resets"),
    circ: rootCost("circ"),
    miracle: rootCost("miracle"),
    start: methodAt("", top)!,
    afterFirst,
    afterFirstLower,
    afterTwo,
    first,
    ...(byBudget ? { byBudget } : {}),
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
 * `a` and `b` = each build alone, `separate` = a, then b (with the circulators a left, when there is a limit).
 */
export function abilityPairPlan(
  a: AbilityGoal,
  b: AbilityGoal,
  opts: PlanOpts,
): { both: AbilityPlan; a: AbilityPlan; b: AbilityPlan; separate: PlanCost } {
  const limited = opts.values?.held !== undefined;
  const one = solve([a], opts, undefined, limited);
  const two = solve([b], opts, undefined, limited);
  const cost = (p: AbilityPlan): PlanCost => ({
    fame: p.fame,
    meso: p.meso,
    circ: p.circ,
    resets: p.resets,
    miracle: p.miracle,
  });
  // The other preset's cost with r circulators left (no limit: always the same).
  const rest = (p: AbilityPlan) => {
    const flat = cost(p);
    const by = p.byBudget;
    return (r: number) => (by ? by[Math.min(r, by.length - 1)] : flat);
  };
  const restA = rest(one);
  const restB = rest(two);
  // Finishing a leaves b for the other preset, and the other way round.
  const both = solve([a, b], opts, (g, r) => (g === 0 ? restB(r) : restA(r)));
  const separate = limited
    ? cost(solve([a], opts, (_, r) => restB(r), false, false))
    : (Object.fromEntries(
        (Object.keys(cost(one)) as (keyof PlanCost)[]).map((k) => [k, one[k] + two[k]]),
      ) as PlanCost);
  return { both, a: one, b: two, separate };
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
