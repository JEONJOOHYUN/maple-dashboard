// What the 잠재능력 views show: rolls grouped into pieces (one physical item's main or additional potential),
// each with the meso spent and what the same result costs on average.
//
// Expected cost of a piece = for every grade it went up: average rolls to go up × the price at that grade,
// plus, at the grade it ended on: average rolls to get the option it ended with (or better) × the price.
// Profit = expected − spent. Cash cubes have no meso price, so they only count as rolls.
import type { Grade, StatConv } from "../ev/potential.ts";
import { kstDate } from "./kst.ts";
import { goalChance, goalOf, gradeBefore, potKey, rollMeso, rollsToUp, upChance, type Goal, type Pieces, type PotRow } from "./potential.ts";

export type PotEntry = { row: PotRow; piece: number; taken: boolean; cost: number };
export const potEntryKey = (e: Pick<PotEntry, "row" | "piece">) => `${potKey(e.row)}\u0000${e.piece}`;

export function potEntries(rows: PotRow[], pieces: Pieces): PotEntry[] {
  return rows.map((row) => ({ row, piece: pieces.piece.get(row.id) ?? 1, taken: pieces.taken.has(row.id), cost: rollMeso(row) }));
}

export type Phase = {
  grade: Grade;
  rolls: number;
  meso: number;
  /** The phase ended with the grade going up. */
  up: boolean;
  /** Average rolls for what happened in this phase (grade-up, or the final option); null when it cannot be told. */
  expected: number | null;
};

export type PieceStat = {
  key: string;
  item: string;
  who: string;
  add: boolean;
  part: string;
  level: number;
  /** Piece number, and how many pieces of this name (and potential kind) the character rolled in the period. */
  n: number;
  of: number;
  rolls: number;
  /** Rolls paid with meso. */
  resets: number;
  ups: number;
  spent: number;
  /** Average meso for the same result; null when no phase could be priced. */
  expected: number | null;
  delta: number | null;
  from: Grade | null;
  grade: Grade | null;
  /** The option it ended with, the goal read from it and the average rolls that goal takes at this grade. */
  option: string[];
  goal: Goal | null;
  goalRolls: number | null;
  /** The one line total the average is measured on (e.g. "INT 26%"). */
  goalBy: string;
  /** Average meso for that option at the grade it ended on (null for cash cubes). */
  goalMeso: number | null;
  phases: Phase[];
  first: number;
  last: number;
  types: string[];
};

export type PotStats = {
  rolls: number;
  resets: number;
  cubes: number;
  ups: number;
  spent: number;
  /** Sum of the pieces that could be priced. */
  delta: number;
  priced: number;
  pieces: PieceStat[];
  /** Meso spent per KST day. */
  days: Map<string, { date: string; rolls: number; spent: number }>;
  characters: string[];
};

/**
 * The option a piece was left with. The history shows what a roll started from and what it produced, not what the
 * player then chose, so for the last batch it is assumed they took the best of what was on the table
 * (the old option or one of the batch's results; "best" = the rarest goal).
 * An option that was on the item before these rolls and that none of them produced was not won by them, so it has no
 * chance to compare with: the rolls were spent and the item is as it was (user, 2026-11-12).
 */
function finalOption(list: PotEntry[], conv: StatConv): { option: string[]; goal: Goal | null; chance: number | null; by: string } {
  const last = list[list.length - 1].row;
  const grade = last.grade;
  const candidates = [last.before, ...list.filter((e) => e.row.t === last.t).map((e) => e.row.after)];
  let best = { option: last.before, goal: null as Goal | null, chance: null as number | null, by: "" };
  let first = true;
  for (const option of candidates) {
    const goal = goalOf(option, last.add);
    const hit = goal && grade ? goalChance(last, grade, goal, conv) : null;
    const chance = hit?.p ?? null;
    // Rarer is better; an option with no goal never beats one that has a goal.
    const better = first || (goal !== null && (best.goal === null || (chance !== null && (best.chance === null || chance < best.chance))));
    if (better) best = { option, goal, chance, by: hit?.by ?? "" };
    first = false;
  }
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((line, i) => line === b[i]);
  if (best.option === last.before && !list.some((e) => same(e.row.after, last.before))) return { ...best, chance: null, by: "" };
  return best;
}

/** `entries` oldest first. `conv` = how much other lines are worth in main stat % (the calculator's setting). */
export function buildPotStats(entries: PotEntry[], conv: StatConv): PotStats {
  const groups = new Map<string, PotEntry[]>();
  const days = new Map<string, { date: string; rolls: number; spent: number }>();
  const characters = new Set<string>();
  for (const e of entries) {
    const key = potEntryKey(e);
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(e);
    characters.add(e.row.who);
    const date = kstDate(e.row.t);
    let day = days.get(date);
    if (!day) days.set(date, (day = { date, rolls: 0, spent: 0 }));
    day.rolls++;
    day.spent += e.cost;
  }

  const pieces: PieceStat[] = [];
  for (const [key, list] of groups) {
    const head = list[0].row;
    const tail = list[list.length - 1].row;
    // Phases: rolls at one grade, closed by the roll that raised it.
    // Each roll has its own chance of going up (its cube, and exactly twice that in miracle time): `chance` adds
    // them up, `caps` = the guarantees met, `blind` = a roll whose cube cannot raise the grade at all.
    const phases: (Phase & { chance: number; caps: Set<number>; blind: boolean })[] = [];
    for (const e of list) {
      const grade = gradeBefore(e.row);
      if (!grade) continue;
      let phase = phases[phases.length - 1];
      if (!phase || phase.up || phase.grade !== grade) phases.push((phase = { grade, rolls: 0, meso: 0, up: false, expected: null, chance: 0, caps: new Set(), blind: false }));
      phase.rolls++;
      const up = upChance(e.row, grade);
      if (up) {
        phase.chance += up.p;
        phase.caps.add(up.cap);
      } else phase.blind = true;
      phase.meso += e.cost;
      if (e.row.up) phase.up = true;
    }
    const final = finalOption(list, conv);
    const tailPhase = phases[phases.length - 1];
    let expected: number | null = null;
    for (const phase of phases) {
      // The stretch is judged at the average chance of its rolls (all in miracle time = exactly double). The guarantee
      // only counts when every roll shared it: rolls of different cubes do not fill one counter.
      if (phase.up) phase.expected = phase.blind ? null : rollsToUp(phase.chance / phase.rolls, phase.caps.size === 1 ? [...phase.caps][0] : 0);
      else if (phase === phases[phases.length - 1]) phase.expected = final.chance ? 1 / final.chance : null;
      // Priced only where the rolls were paid with meso.
      if (phase.expected !== null && phase.meso > 0) expected = (expected ?? 0) + phase.expected * (phase.meso / phase.rolls);
    }
    // A last phase with nothing to show for it yet (no goal) still cost meso: it counts as spent with no worth.
    const spent = list.reduce((sum, e) => sum + e.cost, 0);
    pieces.push({
      key,
      item: head.item,
      who: head.who,
      add: head.add,
      part: head.part,
      level: head.level,
      n: list[0].piece,
      of: 1,
      rolls: list.length,
      resets: list.filter((e) => e.row.meso).length,
      ups: list.filter((e) => e.row.up).length,
      spent,
      expected,
      delta: expected === null ? null : expected - spent,
      from: gradeBefore(head),
      grade: tail.grade,
      option: final.option,
      goal: final.goal,
      goalRolls: final.chance ? 1 / final.chance : null,
      goalBy: final.by,
      goalMeso: final.chance && tailPhase && !tailPhase.up && tailPhase.meso > 0 ? (tailPhase.meso / tailPhase.rolls) / final.chance : null,
      phases: phases.map((p) => ({ grade: p.grade, rolls: p.rolls, meso: p.meso, up: p.up, expected: p.expected })),
      first: head.t,
      last: tail.t,
      types: [...new Set(list.map((e) => e.row.type))],
    });
  }
  const count = new Map<string, number>();
  for (const p of pieces) count.set(`${p.who}\u0000${p.item}\u0000${p.add}`, Math.max(count.get(`${p.who}\u0000${p.item}\u0000${p.add}`) ?? 0, p.n));
  for (const p of pieces) p.of = count.get(`${p.who}\u0000${p.item}\u0000${p.add}`) ?? 1;

  const priced = pieces.filter((p) => p.delta !== null);
  return {
    rolls: entries.length,
    resets: entries.filter((e) => e.row.meso).length,
    cubes: entries.filter((e) => !e.row.meso).length,
    ups: entries.filter((e) => e.row.up).length,
    spent: entries.reduce((sum, e) => sum + e.cost, 0),
    delta: priced.reduce((sum, p) => sum + (p.delta ?? 0), 0),
    priced: priced.length,
    pieces,
    days,
    characters: [...characters].sort((a, b) => a.localeCompare(b, "ko")),
  };
}
