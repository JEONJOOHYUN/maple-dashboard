// How one star force try compares with what it was expected to give, in meso.
//
// Worth of a star = the average meso it takes to get there with the cheapest choices (the calculator's
// starSteps, same events as the try; MVP / PC room are not in the API, so they are what the user set). For one try:
//   success  + worth of the stars gained − meso paid
//   fail     − meso paid
//   destroy  − meso paid − spare item − the stars lost (back to 12), or − restore price when it was restored
// Tries made with the cheapest choice average out to 0, so the total says how lucky the account was.
//
// The API has no meso cost: it is rebuilt from item level, star and the events on the try (spec §3-2).
import { FLOOR_STAR, MVP_DISCOUNT, PC_DISCOUNT, baseCost, rates, restorePrice, starRange, starSteps, type MvpGrade, type StarStep } from "../ev/starforce.ts";
import type { SfRow } from "./parse.ts";

/** Rules changed on 2025-03-20 (client 1.2.401: no star drop, 30 stars). That day is left out as well. */
export const REVAMP_END = Date.parse("2025-03-21T00:00:00+09:00");

/**
 * The star catch mini game was removed on 2026-03-19 (user, 2026-11-12): since then every try gets its bonus,
 * and the API leaves starcatch_result empty. Before that the record says whether it was caught.
 */
export const STARCATCH_ALWAYS = Date.parse("2026-03-19T00:00:00+09:00");
export const caught = (row: Pick<SfRow, "sc" | "t">) => row.sc || row.t >= STARCATCH_ALWAYS;

const RESTORE_TOP = 22;

export type SkipReason = "old" | "superior" | "item" | "level" | "range";

export type Judged = {
  /** Counted in profit and odds. */
  ok: boolean;
  why?: SkipReason;
  /** Meso paid: the try itself, plus the restore price when the destroy was restored (spare items are not meso). */
  cost: number;
  /** Price of the try before any discount (prevention included): shown struck through when a discount applied. */
  list: number;
  /** Result vs expectation (meso). */
  delta: number;
  /** Chances the game gave this try. */
  p: number;
  d: number;
  /** Expected delta and its variance for this try (for the luck index). */
  mean: number;
  variance: number;
  /** Destroyed and brought back at the same star with 확정 복구. */
  restored: boolean;
};

// A try left out of profit still remembers whether its destroy was restored: the log shows the star it ended on.
const SKIP = (why: SkipReason, restored: boolean): Judged => ({ ok: false, why, cost: 0, list: 0, delta: 0, p: 0, d: 0, mean: 0, variance: 0, restored });

/** Discounts the API does not record: the user says which ones they had (applied to every try, up to the 16→17 one). */
export type Discount = { mvp: MvpGrade; pcRoom: boolean };
export const NO_DISCOUNT: Discount = { mvp: "none", pcRoom: false };

const stepsCache = new Map<string, StarStep[]>();
function stepsFor(level: number, row: SfRow, spare: number, maxStar: number | undefined, discount: Discount): StarStep[] {
  const key = `${level}|${row.set}|${caught(row) ? 1 : 0}|${spare}|${maxStar ?? ""}|${discount.mvp}|${discount.pcRoom ? 1 : 0}`;
  let steps = stepsCache.get(key);
  if (!steps) {
    steps = starSteps({ level, event: row.set, mvp: discount.mvp, pcRoom: discount.pcRoom, starCatch: caught(row), maxStar, spareMeso: spare, protect: "auto", restore: "auto" });
    if (stepsCache.size > 400) stepsCache.clear();
    stepsCache.set(key, steps);
  }
  return steps;
}

export type JudgeItem = { level: number; spare: number; maxStar?: number };

/** `restored` = this destroy was followed by a try at the same star (see trackCopies). */
export function judge(row: SfRow, item: JudgeItem, restored = false, discount: Discount = NO_DISCOUNT): Judged {
  const wasRestored = row.r === "destroy" && restored;
  if (row.t < REVAMP_END || row.ct) return SKIP("old", wasRestored);
  if (row.sup) return SKIP("superior", wasRestored);
  if (row.via) return SKIP("item", wasRestored);
  if (!(item.level > 0)) return SKIP("level", wasRestored);
  const steps = stepsFor(item.level, row, item.spare, item.maxStar, discount);
  const s = row.from;
  if (s < 0 || s >= steps.length) return SKIP("range", wasRestored);

  const base = baseCost(item.level, s);
  // Same rule as the calculator: MVP and PC room add up and stop after the 16→17 try; the event sale multiplies on top.
  const flat = s < 17 ? MVP_DISCOUNT[discount.mvp] + (discount.pcRoom ? PC_DISCOUNT : 0) : 0;
  const cost = base * (1 - flat) * (1 - row.sale / 100) + (row.pr ? 2 * base : 0);

  const r = rates(s, { event: "none", starCatch: caught(row) });
  const p = row.sr >= 100 ? 1 : r.success;
  const d = row.sr >= 100 || row.pr || row.map ? 0 : r.destroy * (1 - row.cut / 100);

  const worth = (from: number, to: number) => starRange(steps, from, Math.min(to, steps.length)).meso;
  const toFloor = item.spare + worth(FLOOR_STAR, s);
  // Restore is sold up to 22 stars: above that the item comes back at 22 for the 22-star price.
  const restoreAt = Math.min(s, RESTORE_TOP);
  const restore = restorePrice(item.level, restoreAt);
  const toRestore = restore ? restore.meso * (1 - row.rs / 100) + restore.items * item.spare + worth(restoreAt, s) : Infinity;

  const gainSuccess = worth(s, s + 1 + row.plus) - cost;
  const gainFail = -cost;
  // What the cheapest plan would do after a destroy here (what the worth of the stars assumes).
  const planRestore = Number.isFinite(toRestore) && !!steps[restoreAt]?.restore;
  const gainDestroy = -cost - (planRestore ? toRestore : toFloor);
  const mean = p * gainSuccess + (1 - p - d) * gainFail + d * gainDestroy;
  const variance = p * gainSuccess ** 2 + (1 - p - d) * gainFail ** 2 + d * gainDestroy ** 2 - mean ** 2;

  const didRestore = row.r === "destroy" && restored && Number.isFinite(toRestore);
  const delta =
    row.r === "success"
      ? worth(s, Math.max(row.to, s + 1)) - cost
      : row.r === "fail"
        ? gainFail
        : -cost - (didRestore ? toRestore : toFloor);

  const paid = cost + (didRestore && restore ? restore.meso * (1 - row.rs / 100) : 0);
  return { ok: true, cost: paid, list: base + (row.pr ? 2 * base : 0), delta, p, d, mean, variance: Math.max(0, variance), restored: didRestore };
}

/**
 * Star the item has after a try. The API repeats the old star on a destroy, so that case is ours:
 * restored = back at the same star (22 at most), otherwise 12. A fail keeps what the API says (it dropped before 2025-03).
 */
export function starAfter(row: SfRow, restored: boolean): number {
  if (row.r === "success") return Math.max(row.to, row.from + 1);
  if (row.r === "destroy") return Math.min(row.from, restored ? RESTORE_TOP : FLOOR_STAR);
  return row.to;
}

/** Same item = same character + same item name (the API has no item id). */
export const itemKey = (row: Pick<SfRow, "who" | "item">) => `${row.who}\u0000${row.item}`;

export type Tracked = {
  /** Try id → which piece of that item name it belongs to (1, 2, …). */
  copy: Map<string, number>;
  /** Destroys that were restored on the spot. */
  restored: Set<string>;
};

/**
 * The API names the item, not the piece: two pieces with one name (sold and bought again, a second one for another
 * character slot …) would look like a single item. They are told apart by following the stars — a try belongs to
 * the piece whose current star it starts from; a try that fits no piece starts a new one.
 * The same walk finds restored destroys: the API repeats the old star on a destroy, so the piece's next try tells —
 * still at that star (22 at most) = restored, at 12 = went back to 12.
 * Two pieces sitting at the same star cannot be told apart: the try goes to the one used last.
 */
export function trackCopies(rows: SfRow[]): Tracked {
  type Piece = { n: number; star: number; boom: SfRow | null; used: number };
  const pieces = new Map<string, Piece[]>();
  const copy = new Map<string, number>();
  const restored = new Set<string>();
  let clock = 0;
  for (const row of [...rows].sort((a, b) => a.t - b.t)) {
    const key = itemKey(row);
    let list = pieces.get(key);
    if (!list) pieces.set(key, (list = []));
    const recent = [...list].sort((a, b) => b.used - a.used);
    let piece = recent.find((p) => p.star === row.from);
    if (!piece) {
      piece = recent.find((p) => p.boom && p.boom.from > FLOOR_STAR && row.from === Math.min(p.boom.from, RESTORE_TOP));
      if (piece?.boom) restored.add(piece.boom.id);
    }
    if (!piece) list.push((piece = { n: list.length + 1, star: row.from, boom: null, used: 0 }));
    copy.set(row.id, piece.n);
    piece.used = ++clock;
    piece.boom = row.r === "destroy" ? row : null;
    // A destroy counts as "back to 12" until the next try shows it was restored.
    piece.star = starAfter(row, false);
  }
  return { copy, restored };
}

export const restoredIds = (rows: SfRow[]) => trackCopies(rows).restored;
