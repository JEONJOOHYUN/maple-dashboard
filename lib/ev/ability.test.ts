import assert from "node:assert/strict";
import { test } from "node:test";
import data from "./data/ability.json" with { type: "json" };
import { ABILITY_OPTIONS, abilityPlan, legendaryOnly, type AbilityKey, circulatorCount, valueChance, valueChoices } from "./ability.ts";

type Grade = "epic" | "unique" | "legendary";
const rows = (data as unknown as { rows: [string, number, number, number][] }).rows;
const P: Record<Grade, number[]> = { epic: rows.map((r) => r[1]), unique: rows.map((r) => r[2]), legendary: rows.map((r) => r[3]) };
const idx = (k: AbilityKey) => rows.findIndex((r) => r[0] === ABILITY_OPTIONS[k].name);

// Seeded random so the test is stable.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** Fixed plan with fame resets (L1+U2): lock good lines 2 · 3 as they come; line 1 is only locked when lockFirst. */
function simulate(keys: AbilityKey[], runs: number, lockFirst: boolean): number {
  const rand = rng(42);
  const targets = keys.map(idx);
  const pick = (g: Grade, excluded: number[]) => {
    const denom = 1 - excluded.reduce((s, i) => s + P[g][i], 0);
    let r = rand() * denom;
    for (let i = 0; i < rows.length; i++) {
      if (excluded.includes(i)) continue;
      r -= P[g][i];
      if (r <= 0) return i;
    }
    return rows.findIndex((_, i) => !excluded.includes(i));
  };
  let total = 0;
  for (let run = 0; run < runs; run++) {
    const locked = new Map<number, number>();
    let fame = 0;
    for (let guard = 0; guard < 1e6; guard++) {
      fame += [8000, 11000, 16000][locked.size];
      const excluded = [...locked.values()];
      const result = new Map(locked);
      for (const line of [0, 1, 2]) {
        if (locked.has(line)) continue;
        const g: Grade = line === 0 ? "legendary" : rand() < 0.15 ? "unique" : "epic";
        const opt = pick(g, excluded);
        excluded.push(opt);
        if (targets.includes(opt) && g !== "epic") result.set(line, opt);
      }
      if (result.size === 3) break;
      // Keep at most two locks: prefer what was already locked, then new good lines.
      for (const [line, opt] of result) if (!locked.has(line) && locked.size < 2 && (lockFirst || line > 0)) locked.set(line, opt);
    }
    total += fame;
  }
  return total / runs;
}

test("the plan beats fixed locking plans and is close to the best of them", () => {
  const keys: [AbilityKey, AbilityKey, AbilityKey] = ["boss", "stat", "atk"];
  const plan = abilityPlan(keys, "l1u2", { sunday: false, famePricePerUnit: 0 });
  const greedy = simulate(keys, 2000, true);
  const lastFirst = simulate(keys, 2000, false);
  // Monte Carlo noise is a few %, so allow a little slack.
  assert.ok(plan.fame <= greedy * 1.05, `plan ${plan.fame} vs lock-all ${greedy}`);
  assert.ok(plan.fame <= lastFirst * 1.05, `plan ${plan.fame} vs first-line-last ${lastFirst}`);
  assert.ok(plan.fame >= Math.min(greedy, lastFirst) * 0.8, `plan ${plan.fame} vs ${Math.min(greedy, lastFirst)}`);
  assert.equal(plan.meso, 0);
});

test("legendary 3 lines needs advanced resets (meso) and costs more fame", () => {
  const keys: [AbilityKey, AbilityKey, AbilityKey] = ["boss", "stat", "atk"];
  const l1 = abilityPlan(keys, "l1u2", { sunday: false, famePricePerUnit: 0 });
  const l3 = abilityPlan(keys, "l3", { sunday: false, famePricePerUnit: 0 });
  assert.ok(l3.meso > 0);
  assert.ok(l3.fame > l1.fame);
  assert.ok(Number.isFinite(l3.resets));
});

test("Sunday halves fame, passive is legendary-only", () => {
  const keys: [AbilityKey, AbilityKey, AbilityKey] = ["pas", "boss", "stat"];
  const normal = abilityPlan(keys, "l1u2", { sunday: false, famePricePerUnit: 0 });
  const sunday = abilityPlan(keys, "l1u2", { sunday: true, famePricePerUnit: 0 });
  assert.ok(Math.abs(sunday.fame - normal.fame / 2) < 1);
  assert.ok(legendaryOnly("pas"));
  assert.ok(!legendaryOnly("boss"));
});

test("passive first: only line 1 can hold it, and locking it is not worth it for 패보상 L1+U2", () => {
  const plan = abilityPlan(["pas", "boss", "stat"], "l1u2", { sunday: false, famePricePerUnit: 0 });
  const pas = plan.afterFirst.find((a) => a.key === "pas")!;
  // Codex review: locking passive on line 1 costs ~945만 left vs ~846만 from scratch → reroll instead.
  assert.equal(pas.action.kind, "keep");
  assert.ok(Math.abs(pas.fame - plan.fame) < 1);
});

test("values: official table and circulators (chuchu.gg counts 1 ÷ P, we count the extra (1 − P) ÷ P)", () => {
  assert.ok(Math.abs(valueChance("boss", "legendary", 20) - 0.1) < 1e-12);
  assert.ok(Math.abs(valueChance("stat", "legendary", 10) - 0.6) < 1e-12);
  assert.equal(valueChance("pas", "legendary", 1), 1);
  const pbs = circulatorCount([
    { key: "pas", grade: "legendary", goal: 1 },
    { key: "boss", grade: "legendary", goal: 20 },
    { key: "stat", grade: "legendary", goal: 10 },
  ]);
  assert.ok(Math.abs(1 / pbs.p - 16.6667) < 0.001, "chuchu 16.7");
  assert.ok(Math.abs(pbs.count - 15.6667) < 0.001);
});

test("L1+U2 with a chosen legendary line only finishes with that option on line 1 (Codex review)", () => {
  const opts = { sunday: false, famePricePerUnit: 0 };
  const free = abilityPlan(["boss", "stat", "atk"], "l1u2", opts);
  const bossLead = abilityPlan(["boss", "stat", "atk"], "l1u2", opts, 0);
  assert.ok(Number.isFinite(bossLead.fame));
  // Fewer finished layouts count, so it costs more than "any option on line 1".
  assert.ok(bossLead.fame > free.fame);
});

test("values: two options together → circulate them to the goal, lock, then reset the last line (user's route)", () => {
  const goal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
  const opts = { sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 2.6e8 } };
  const pbs = abilityPlan(["pas", "boss", "stat"], "l3", opts);
  const pasBoss = pbs.afterTwo.find((a) => a.keys.join() === "pas,boss")!;
  assert.equal(pasBoss.action.kind, "circ");
  // Legendary lines 2 · 3 are rolled with the advanced reset to the end (user, 2026-11-11).
  assert.equal(pasBoss.action.method, "advanced");
  // Boss 20 % is 10 % a roll; passive is always +1 → 10 circulators.
  assert.ok(Math.abs(pasBoss.action.circCount - 10) < 1e-9);
  // Not above chuchu.gg's fixed route for the same prices (branch-weighted 432.6억 at 2.2억 a circulator, 2026-11-11).
  const cheap = abilityPlan(["pas", "boss", "stat"], "l3", { ...opts, values: { goal, circPrice: 2.2e8 } });
  const total = cheap.fame * 400 + cheap.meso + cheap.circ * 2.2e8;
  assert.ok(total <= 432.6e8 && total > 380e8, String(total));
  const cbh = abilityPlan(["cool", "boss", "hp"], "l3", opts);
  assert.ok(cbh.afterTwo.every((a) => a.action.kind === "circ"));
});

test("second option depends on discovery order (Codex review): boss maxed first, then passive just locks", () => {
  const goal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
  const p = abilityPlan(["pas", "boss", "stat"], "l3", { sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 2.6e8 } });
  assert.equal(p.afterTwo.length, 6);
  const bossThenPas = p.afterTwo.find((a) => a.keys.join() === "boss,pas")!;
  const pasThenBoss = p.afterTwo.find((a) => a.keys.join() === "pas,boss")!;
  assert.equal(bossThenPas.action.kind, "lock");
  assert.equal(bossThenPas.action.circCount, 0);
  assert.equal(pasThenBoss.action.kind, "circ");
});

test("second option: what is left after two lines (resets included) is less than after one", () => {
  const goal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
  const p = abilityPlan(["pas", "boss", "stat"], "l3", { sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 2.6e8 } });
  for (const two of p.afterTwo) {
    const one = p.afterFirstLower.find((a) => a.key === two.keys[0])!;
    assert.ok(Number.isFinite(two.resets) && two.resets > 0, two.keys.join());
    assert.ok(two.resets < one.resets, two.keys.join());
    // Two lines locked: only the last line is left, rerolled by advanced resets (fame + meso).
    assert.ok(two.meso > 0, two.keys.join());
  }
});

test("an option that is not kept has no follow-up step (Codex review: 패보크 boss)", () => {
  const goal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
  const p = abilityPlan(["pas", "boss", "crit"], "l3", { sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 2.6e8 } });
  const boss = p.afterFirstLower.find((a) => a.key === "boss")!;
  assert.equal(boss.action.kind, "keep");
  assert.ok(p.afterTwo.every((a) => a.keys[0] !== "boss"));
});
