import assert from "node:assert/strict";
import { test } from "node:test";
import data from "./data/ability.json" with { type: "json" };
import miracleData from "./data/ability-miracle.json" with { type: "json" };
import { ABILITY_OPTIONS, ABILITY_PRESETS, abilityPairPlan, abilityPlan, buildPreset, legendaryOnly, presetLead, type AbilityKey, type AbilityMode, type PlanOpts, circulatorCount, valueChance, valueChoices } from "./ability.ts";
import { classAbilities } from "./ability-classes.ts";

type Grade = "epic" | "unique" | "legendary";
const rows = (data as unknown as { rows: [string, number, number, number][] }).rows;
const P: Record<Grade, number[]> = { epic: rows.map((r) => r[1]), unique: rows.map((r) => r[2]), legendary: rows.map((r) => r[3]) };
const idx = (k: AbilityKey) => rows.findIndex((r) => r[0] === ABILITY_OPTIONS[k].name);
// Screen defaults: highest values, 200만 per 5,000 fame (400 a fame), circulator 2.6억.
const maxGoal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
const valued = { sunday: false, famePricePerUnit: 400, values: { goal: maxGoal, circPrice: 2.6e8 } };
const money = (c: { fame: number; meso: number; circ: number }) => c.fame * 400 + c.meso + c.circ * 2.6e8;

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

test("values: official table and circulators (the extra ones, (1 − P) ÷ P, not 1 ÷ P)", () => {
  assert.ok(Math.abs(valueChance("boss", "legendary", 20) - 0.1) < 1e-12);
  assert.ok(Math.abs(valueChance("stat", "legendary", 10) - 0.6) < 1e-12);
  assert.equal(valueChance("pas", "legendary", 1), 1);
  const pbs = circulatorCount([
    { key: "pas", grade: "legendary", goal: 1 },
    { key: "boss", grade: "legendary", goal: 20 },
    { key: "stat", grade: "legendary", goal: 10 },
  ]);
  assert.ok(Math.abs(1 / pbs.p - 16.6667) < 0.001, "1 ÷ P = 16.7");
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
  // Not above the fixed route for the same prices (branch-weighted 432.6억 at 2.2억 a circulator, 2026-11-11).
  const cheap = abilityPlan(["pas", "boss", "stat"], "l3", { ...opts, values: { goal, circPrice: 2.2e8 } });
  const total = cheap.fame * 400 + cheap.meso + cheap.circ * 2.2e8;
  assert.ok(total <= 432.6e8 && total > 380e8, String(total));
  const cbh = abilityPlan(["cool", "boss", "hp"], "l3", opts);
  assert.ok(cbh.afterTwo.every((a) => a.action.kind === "circ"));
});

test("every discovery order has a row (Codex review); circulators wait until both lower lines are known (user, 2026-11-15)", () => {
  const goal = (k: AbilityKey, g: "legendary" | "unique") => Math.max(...valueChoices(k, g));
  const p = abilityPlan(["pas", "boss", "stat"], "l3", { sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 2.6e8 } });
  assert.equal(p.afterTwo.length, 6);
  // Boss below 20 % is locked as it is: circulating it now is about as dear and gets rerolled when 상추뎀 comes next.
  assert.ok(p.afterFirstLower.every((r) => r.action.kind === "lock"));
  const bossThenPas = p.afterTwo.find((a) => a.keys.join() === "boss,pas")!;
  const pasThenBoss = p.afterTwo.find((a) => a.keys.join() === "pas,boss")!;
  for (const r of [bossThenPas, pasThenBoss]) {
    assert.equal(r.action.kind, "circ");
    assert.ok(Math.abs(r.action.circCount - 10) < 1e-9);
  }
  assert.equal(p.afterTwo.find((a) => a.keys.join() === "boss,stat")!.action.kind, "lock");
});

test("the last step comes from the plan: lines circulated to the goal are not circulated again (user, 2026-11-15)", () => {
  const p = abilityPlan(["pas", "boss", "stat"], "l3", valued);
  const fin = (keys: string) => p.afterTwo.find((a) => a.keys.join() === keys)!.finish!;
  // 패시브 + 보공 (circulated to 20 %): reset line 1 until 상추뎀 shows 10 %, no circulator.
  assert.deepEqual(fin("pas,boss").map((f) => [f.last, f.lines, f.move]), [["stat", [0], "keep"]]);
  // 보공 + 상추뎀 locked below the goal: once 패시브 shows up on line 1, circulate all three lines (1 ÷ (0.1 × 0.6)).
  const bs = fin("boss,stat");
  assert.deepEqual(bs.map((f) => [f.last, f.move]), [["pas", "circ"]]);
  assert.ok(Math.abs(bs[0].circCount - 1 / 0.06) < 1e-6);
  // What is left is counted after the move (Codex review): only the circulators, not the search for 패시브.
  assert.ok(Math.abs(money(bs[0]) - (2.6e8 / 0.06)) < 1, String(money(bs[0])));
  assert.deepEqual(fin("pas,stat").map((f) => [f.last, f.move]), [["boss", "circ"]]);
  // L1+U2: boss and 상추뎀 at their goals, passive (always +1) on line 1 ends it, nothing left.
  const l1 = abilityPlan(["pas", "boss", "stat"], "l1u2", valued, 0);
  const done = l1.afterTwo.flatMap((r) => r.finish ?? []).find((f) => f.move === "done")!;
  assert.equal(done.last, "pas");
  assert.equal(money(done), 0);
});

test("circulators are used once on a path for 패보상 · 재보체 3줄: nothing circulated before the last circulation", () => {
  for (const keys of [["pas", "boss", "stat"], ["cool", "boss", "hp"]] as AbilityKey[][]) {
    const p = abilityPlan(keys, "l3", valued);
    assert.ok(p.afterFirstLower.every((r) => r.action.kind !== "circ"), keys.join());
    for (const r of p.afterTwo)
      if (r.action.kind === "circ") assert.ok(r.finish!.every((f) => f.move !== "circ"), r.keys.join());
  }
});

test("showing the wanted value can change the move: 패보재 3줄 boss goes on below 20 %, is locked at 20 %", () => {
  const p = abilityPlan(["pas", "boss", "cool"], "l3", valued);
  const boss = p.afterFirstLower.find((r) => r.key === "boss")!;
  assert.equal(boss.action.kind, "keep");
  assert.equal(boss.atGoal?.kind, "lock");
  // What follows assumes it was locked at 20 % (and what is left then is less than going on).
  assert.equal(boss.nextAtGoal, true);
  assert.ok(money(boss.atGoalLeft!) < money(boss));
  assert.ok(p.afterTwo.some((r) => r.keys[0] === "boss"));
  // Where the value changes nothing there is no second move.
  assert.equal(p.afterFirstLower.find((r) => r.key === "pas")!.atGoal, undefined);
});

test("line 1 lists only options that count there (L1+U2: the lead), and every row says its line", () => {
  const l1 = abilityPlan(["pas", "boss", "stat"], "l1u2", valued, 0);
  assert.deepEqual(l1.afterFirst.map((r) => r.key), ["pas"]);
  const l3 = abilityPlan(["pas", "boss", "stat"], "l3", valued);
  assert.deepEqual(l3.afterFirst.map((r) => r.key), ["pas", "boss", "stat"]);
  for (const p of [l1, l3]) {
    assert.ok(p.afterFirst.every((r) => r.line === 0));
    assert.ok(p.afterFirstLower.every((r) => r.line === 1));
  }
});

test("드메 ends by resetting until the other option shows the wanted value (not as soon as it shows up)", () => {
  const p = abilityPlan(["drop", "meso"], "l1u2", valued, [0, 1]);
  const drop = p.afterFirstLower.find((r) => r.key === "drop")!;
  assert.deepEqual(drop.finish!.map((f) => [f.last, f.lines, f.move]), [["meso", [0], "keep"]]);
  // Both legendary: the other one may finish on line 1 or 3.
  const l3 = abilityPlan(["drop", "meso"], "l3", valued);
  assert.deepEqual(l3.afterFirstLower.find((r) => r.key === "drop")!.finish!.map((f) => f.lines), [[0, 2]]);
});

test("every finish is keep · circ · done, with all the other options of its goal on the item", () => {
  const presets: [AbilityKey[], number[] | undefined][] = [
    [["pas", "boss", "stat"], [0]],
    [["boss", "stat", "atk"], [0]],
    [["pas", "boss", "crit"], [0]],
    [["cool", "boss", "stat"], [0]],
    [["pas", "boss", "cool"], [0]],
    [["cool", "boss", "hp"], [0]],
    [["drop", "meso"], [0, 1]],
  ];
  for (const [keys, lead] of presets)
    for (const mode of ["l3", "l1u2"] as const) {
      const p = abilityPlan(keys, mode, valued, mode === "l1u2" ? lead : undefined);
      for (const r of [...p.afterFirst, ...p.afterFirstLower, ...p.afterTwo])
        for (const f of r.finish ?? []) {
          assert.ok(["keep", "circ", "done"].includes(f.move));
          assert.equal(f.locked.length + 1, keys.length, keys.join());
          assert.ok(!f.locked.includes(f.last));
          assert.ok(f.lines.length > 0 && Number.isFinite(money(f)));
        }
    }
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

test("drop and meso: official values, legendary 18 ~ 20 and unique 13 ~ 15", () => {
  assert.deepEqual(valueChoices("drop", "legendary"), [18, 19, 20]);
  assert.deepEqual(valueChoices("meso", "unique"), [13, 14, 15]);
  assert.ok(Math.abs(valueChance("drop", "legendary", 20) - 0.25) < 1e-12);
  assert.ok(Math.abs(valueChance("meso", "unique", 14) - 0.6) < 1e-12);
});

test("드메 is two lines: drop or meso on line 1, the other below; no third-option step", () => {
  const l1 = abilityPlan(["drop", "meso"], "l1u2", valued, [0, 1]);
  const l3 = abilityPlan(["drop", "meso"], "l3", valued);
  assert.ok(Number.isFinite(l1.fame) && l1.fame > 0);
  // Both lines legendary needs the 2 % legendary lower line of the advanced reset: far more.
  assert.ok(money(l3) > money(l1) * 3, `${money(l3)} vs ${money(l1)}`);
  assert.equal(l1.afterTwo.length, 0);
  assert.deepEqual(l1.afterFirstLower.map((r) => r.key).sort(), ["drop", "meso"]);
  // Either option may be the legendary line 1.
  assert.deepEqual(l1.afterFirst.map((r) => r.key), ["drop", "meso"]);
});

test("every row lists each kind of move once, the chosen one first and never dearer than the others by a circulator", () => {
  const p = abilityPlan(["pas", "boss", "stat"], "l3", valued);
  for (const row of [...p.afterFirst, ...p.afterFirstLower, ...p.afterTwo]) {
    assert.equal(row.choices[0].action.kind, row.action.kind);
    assert.ok(Math.abs(money(row.choices[0]) - money(row)) < 1);
    // Rerolling lines already at the goal must save a circulator to be chosen, so the chosen move may cost a little
    // more on average than such a circulation (boss on line 2: locking leaves about 0.035억 more than circulating).
    for (const c of row.choices.slice(1)) assert.ok(money(c) >= money(row) - 2.6e8, `${c.action.kind} ${money(c)} < ${money(row)}`);
    assert.equal(new Set(row.choices.map((c) => c.action.kind)).size, row.choices.length);
  }
  // The user's case: boss first on a lower line. Locking it beats rolling on.
  const boss = p.afterFirstLower.find((r) => r.key === "boss")!;
  const keep = boss.choices.find((c) => c.action.kind === "keep")!;
  assert.ok(money(keep) > money(boss));
});

test("two presets (패보상 + 드메): together costs less than one after the other, the first preset less than the boss build alone", () => {
  for (const mode of ["l3", "l1u2"] as const) {
    const pair = abilityPairPlan(
      { keys: ["pas", "boss", "stat"], mode, lead: mode === "l1u2" ? [0] : undefined },
      { keys: ["drop", "meso"], mode, lead: mode === "l1u2" ? [0, 1] : undefined },
      valued,
    );
    const separate = money(pair.a) + money(pair.b);
    assert.ok(money(pair.both) < separate, `${mode}: ${money(pair.both)} vs ${separate}`);
    // Never below the dearer build alone: that one has to be made on some preset anyway.
    assert.ok(money(pair.both) > Math.max(money(pair.a), money(pair.b)));
    const first = pair.both.first!;
    assert.ok(Math.abs(first.chance[0] + first.chance[1] - 1) < 1e-9);
    assert.ok(money(first) < money(pair.a));
    // What is left after the first preset is the other build alone, weighted by which one came first.
    const second = first.chance[0] * money(pair.b) + first.chance[1] * money(pair.a);
    assert.ok(Math.abs(money(first) + second - money(pair.both)) < money(pair.both) * 1e-6);
    // Rows say which build a move works towards.
    assert.ok(pair.both.afterFirstLower.some((r) => r.key === "drop" && r.goal === 1));
    assert.ok(pair.both.afterFirstLower.some((r) => r.key === "boss" && r.goal === 0));
  }
});

// 일반 재설정 (fame reset, L1+U2) rerolls values with black · chaos circulators: event items, no price
// (user, 2026-11-15; official guide: grade and options kept, values only, not when lines 2 · 3 are legendary).
const free = { sunday: false, famePricePerUnit: 400, values: { goal: maxGoal, circPrice: 0 } };

test("일반 재설정: free black · chaos circulators fix the values, so the fame is that of the options alone", () => {
  const keys: AbilityKey[] = ["pas", "boss", "stat"];
  const p = abilityPlan(keys, "l1u2", free, 0);
  const options = abilityPlan(keys, "l1u2", { sunday: false, famePricePerUnit: 400 }, 0);
  assert.ok(Math.abs(p.fame - options.fame) < 1, `${p.fame} vs ${options.fame}`);
  // 846.0만 fame · 731.8 resets: the lowest values (no circulator needed) give the same.
  assert.ok(Math.abs(p.fame - 8_460_350) < 10, `${p.fame}`);
  assert.ok(Math.abs(p.resets - 731.84) < 0.01, `${p.resets}`);
  // Top values: P = 1 × 10 % × 25 % → (1 − P) ÷ P = 39, none spent before the last option shows up.
  assert.ok(Math.abs(p.circ - 39) < 1e-6, `${p.circ}`);
  assert.equal(p.afterFirstLower.find((r) => r.key === "boss")!.action.kind, "lock");
  // 상추뎀 first is not locked: waiting for 보공 with it locked costs more fame.
  assert.equal(p.afterFirstLower.find((r) => r.key === "stat")!.action.kind, "keep");
  // A blank fame price does not change the plan (free circulators cost a hair of a reset when choosing).
  const blank = abilityPlan(keys, "l1u2", { ...free, famePricePerUnit: 0 }, 0);
  assert.ok(Math.abs(blank.fame - p.fame) < 1 && Math.abs(blank.circ - p.circ) < 1e-6);
  // 재보체: three lines at 10 % each → 999.
  assert.ok(Math.abs(abilityPlan(["cool", "boss", "hp"], "l1u2", free, 0).circ - 999) < 1e-6);
});

// Black · chaos circulators held (event items, a few at a time — user, 2026-11-15: "400개를 돌리는 건 안 돼", usually
// 블랙 40 · 카오스 20, the page takes up to 50 of each).
const held = (black: number, chaos: number) => ({
  sunday: false,
  famePricePerUnit: 400,
  values: { goal: maxGoal, circPrice: 0, held: { black, chaos } },
});

test("circulators held: none = no circulators, very many = no limit, more never costs more, black worth more than chaos", () => {
  for (const preset of ABILITY_PRESETS) {
    const plan = (o: PlanOpts) => abilityPlan(preset.keys, "l1u2", o, presetLead(preset));
    const none = plan(held(0, 0));
    const without = plan({ sunday: false, famePricePerUnit: 400, values: { goal: maxGoal, circPrice: 1e18 } });
    assert.ok(Math.abs(none.fame - without.fame) < 1e-6 * without.fame, `${preset.label}: ${none.fame} vs ${without.fame}`);
    assert.equal(none.circ, 0);
    let last = none.fame;
    for (const n of [5, 30]) {
      const black = plan(held(n, 0));
      const chaos = plan(held(0, n));
      assert.ok(black.fame <= last * (1 + 1e-9), `${preset.label} ${n}: ${black.fame} > ${last}`);
      assert.ok(black.circ <= n + 1e-9 && chaos.circ <= n + 1e-9, `${preset.label} ${n}: ${black.circ} · ${chaos.circ}`);
      // Black keeps the values when a result is not applied, chaos applies every one.
      assert.ok(black.fame <= chaos.fame * (1 + 1e-9), `${preset.label} ${n}: black ${black.fame} > chaos ${chaos.fame}`);
      last = black.fame;
    }
    // Both kinds: 30 black ≤ 10 black + 20 chaos ≤ 30 chaos, and more of either never costs more.
    const mix = plan(held(10, 20));
    const fame = (b: number, c: number) => plan(held(b, c)).fame;
    assert.ok(fame(30, 0) <= mix.fame * (1 + 1e-9) && mix.fame <= fame(0, 30) * (1 + 1e-9), `${preset.label} mix ${mix.fame}`);
    assert.ok(mix.fame <= fame(10, 0) * (1 + 1e-9) && mix.fame <= fame(0, 20) * (1 + 1e-9), `${preset.label} mix more`);
    assert.ok(mix.circ <= 30 + 1e-9, `${preset.label} mix ${mix.circ}`);
  }
  // Very many: never worse than no limit — 패보상 the same (39 on average), 드메 the same fame with a few circulators
  // fewer (14.80 vs 15.00: one at a time, nothing is rolled that is already enough).
  for (const id of ["pbs", "dm"]) {
    const preset = ABILITY_PRESETS.find((p) => p.id === id)!;
    const lots = abilityPlan(preset.keys, "l1u2", held(3000, 0), presetLead(preset));
    const free = abilityPlan(preset.keys, "l1u2", { sunday: false, famePricePerUnit: 400, values: { goal: maxGoal, circPrice: 0 } }, presetLead(preset));
    assert.ok(Math.abs(lots.fame - free.fame) < 1e-6 * free.fame && lots.circ <= free.circ + 1e-4, `${id}: ${lots.fame} · ${lots.circ}`);
  }
});

test("30 black circulators for 패보상: 보공 on its own, then the two lines locked and circulated one at a time", () => {
  const p = abilityPlan(["pas", "boss", "stat"], "l1u2", held(30, 0), 0);
  // 1,653.3만 fame · 1,575 resets · 20.75 circulators.
  assert.ok(Math.abs(p.fame - 16_533_265) < 10, `${p.fame}`);
  assert.ok(Math.abs(p.resets - 1575.283) < 0.01 && Math.abs(p.circ - 20.7525) < 1e-4, `${p.resets} · ${p.circ}`);
  // 보공 below 10 % on line 2 or 3: circulate it (10 % a try) — 9.6 used on average, 96 % within 30.
  const boss = p.afterFirstLower.find((r) => r.key === "boss")!;
  assert.equal(boss.action.kind, "circ");
  assert.equal(boss.action.circKind, "black");
  assert.ok(Math.abs(boss.action.circCount - (1 - 0.9 ** 30) / 0.1) < 1e-9, `${boss.action.circCount}`);
  assert.equal(boss.action.circLeft, 30);
  assert.ok(Math.abs(boss.action.circChance! - (1 - 0.9 ** 30)) < 1e-12);
  // All 30 missing (black: the values stay): 보공 is still below 10 %, nothing locked.
  assert.deepEqual(boss.action.circMissKeep, []);
  // Then 상추뎀: lock it and circulate the two lines one at a time (the counts typed in, here still 30 — Codex review: not
  // an average left over). Black only: 53 % both at the goal, 21.3 used on average; 보공 10 % first in the list (a black
  // result is taken when it is higher up), then the last line is done.
  const two = p.afterTwo.find((r) => r.keys.join() === "boss,stat")!;
  assert.equal(two.action.kind, "lock");
  assert.deepEqual(two.run!.keys, ["boss", "stat"]);
  assert.deepEqual(two.run!.lines, [1, 2]);
  assert.ok(two.run!.by.every((x) => x.use === "black"));
  assert.deepEqual(two.run!.by[0].have, ["boss"]);
  assert.ok(Math.abs(two.run!.chance - 0.532116) < 1e-6 && Math.abs(two.run!.circCount - 21.2846) < 1e-4, `${two.run!.chance}`);
  assert.deepEqual(two.finish!.map((f) => f.move), ["done"]);
  // Chaos only (2,008.3만): chaos for 보공, then the two lines with chaos (38 % both at the goal).
  const chaos = abilityPlan(["pas", "boss", "stat"], "l1u2", held(0, 30), 0);
  assert.ok(Math.abs(chaos.fame - 20_083_095) < 10, `${chaos.fame}`);
  const chaosTwo = chaos.afterTwo.find((r) => r.keys.join() === "boss,stat")!;
  assert.equal(chaosTwo.action.kind, "lock");
  assert.ok(chaosTwo.run!.by.every((x) => x.use === "chaos"));
  // …but as chaos runs low the plan changes, and the guide says where (Codex review): with only 보공 at 10 % and 20
  // chaos left, stop and keep 보공 locked (resets for 상추뎀 8 %).
  assert.deepEqual(chaosTwo.run!.by.find((x) => x.have.join() === "boss")!.then, { kind: "chaos", at: 20, use: "stop", keep: ["boss"] });
  // Nothing to circulate when the lines start at the goal (1 chaos: 상추뎀 is locked only at 8 %) — no run (Codex review).
  const one = abilityPlan(["pas", "boss", "stat"], "l1u2", held(0, 1), 0);
  assert.ok([...one.afterFirstLower, ...one.afterTwo].every((r) => r.run === undefined || r.run.chance < 1));
  assert.equal(one.afterTwo.find((r) => r.keys.join() === "boss,stat")!.run, undefined);
  // Without a limit nothing changes: no counts, no runs (39 circulators, the test above).
  const freePlan = abilityPlan(["pas", "boss", "stat"], "l1u2", free, 0);
  assert.equal(freePlan.afterFirstLower.find((r) => r.key === "boss")!.action.circLeft, undefined);
  assert.ok(freePlan.afterTwo.every((r) => r.run === undefined));
});

test("블랙 40 · 카오스 20 for 패보상: 1,211.0만 (deciding after every circulator), chaos first, black to keep 보공 when few", () => {
  const p = abilityPlan(["pas", "boss", "stat"], "l1u2", held(40, 20), 0);
  // 1,211.0만 fame · 1,144 resets · 30.41 circulators — another calculator that decides after each circulator gives
  // 1,211.7만 · 1,144.1 (2026-11-16); deciding at the start of a go of many gave 1,300.9만.
  assert.ok(Math.abs(p.fame - 12_110_317) < 10 && Math.abs(p.resets - 1143.571) < 0.01 && Math.abs(p.circ - 30.41263) < 1e-4, `${p.fame}`);
  // 보공 below 10 %: chaos first, then black (60 tries, 99.8 %); nothing to lose, nothing locked when all miss.
  const boss = p.afterFirstLower.find((r) => r.key === "boss")!;
  assert.equal(boss.action.circKind, "both");
  assert.equal(boss.action.circLeft, 60);
  assert.ok(Math.abs(boss.action.circChance! - (1 - 0.9 ** 60)) < 1e-12);
  assert.deepEqual(boss.action.circMissKeep, []);
  // Then 상추뎀: lock, then chaos whatever is at the goal while chaos is left (78 % both at the goal, 31.2 used).
  const two = p.afterTwo.find((r) => r.keys.join() === "boss,stat")!;
  assert.equal(two.action.kind, "lock");
  assert.ok(two.run!.by.every((x) => x.use === "chaos"));
  assert.ok(Math.abs(two.run!.chance - 0.779811) < 1e-6 && Math.abs(two.run!.circCount - 31.1924) < 1e-4, `${two.run!.chance}`);
  // With only 보공 at 10 %: chaos until 2 are left, then black keeps it.
  assert.deepEqual(two.run!.by.find((x) => x.have.join() === "boss")!.then, { kind: "chaos", at: 2, use: "black" });
  // 블랙 3 · 카오스 3: with 보공 at 10 % black keeps it, otherwise chaos.
  const few = abilityPlan(["pas", "boss", "stat"], "l1u2", held(3, 3), 0).afterTwo.find((r) => r.keys.join() === "boss,stat")!;
  assert.deepEqual(few.run!.by.map((x) => [x.have.join(), x.use]), [["boss", "black"], ["", "chaos"], ["stat", "chaos"]]);
  // 블랙 10 · 카오스 20: 1,837.9만.
  const fewer = abilityPlan(["pas", "boss", "stat"], "l1u2", held(10, 20), 0);
  assert.ok(Math.abs(fewer.fame - 18_378_633) < 10 && Math.abs(fewer.resets - 1770.197) < 0.01, `${fewer.fame}`);
  assert.equal(fewer.afterFirstLower.find((r) => r.key === "boss")!.action.circKind, "both");
  assert.equal(fewer.afterTwo.find((r) => r.keys.join() === "boss,stat")!.action.kind, "lock");
});

test("circulators held, two presets: what the first ability leaves goes to the second; together costs less", () => {
  const hunt = ABILITY_PRESETS.find((p) => p.hunting)!;
  const goal = (keys: AbilityKey[], lead: number[]) => ({ keys, mode: "l1u2" as const, lead });
  const r = abilityPairPlan(goal(["pas", "boss", "stat"], [0]), goal(hunt.keys, presetLead(hunt)), held(30, 0));
  // Each preset alone with every count held (layers 0 … 30; the last one is the plan itself).
  assert.equal(r.a.byBudget!.length, 31);
  assert.ok(Math.abs(r.a.byBudget![30].fame - r.a.fame) < 1e-6 && Math.abs(r.b.byBudget![0].fame - 5_123_110) < 10, `${r.b.byBudget![0].fame}`);
  // 패보상 then 드메 with what is left: more than the two alone with 30 each (that would be 60 circulators).
  assert.ok(r.separate.fame > r.a.fame + r.b.fame, `${r.separate.fame}`);
  assert.ok(r.separate.circ <= 30 + 1e-9 && r.both.circ <= 30 + 1e-9);
  // One ability made into whichever build comes first: 1,939.0만 vs 2,001.4만 one after the other.
  assert.ok(Math.abs(r.both.fame - 19_389_798) < 10 && Math.abs(r.separate.fame - 20_014_472) < 10, `${r.both.fame} · ${r.separate.fame}`);
  // Both kinds (블랙 10 · 카오스 20): 2,092.9만 together vs 2,129.1만 one after the other, never more than held.
  const mix = abilityPairPlan(goal(["pas", "boss", "stat"], [0]), goal(hunt.keys, presetLead(hunt)), held(10, 20));
  assert.equal(mix.a.byBudget!.length, 11 * 21);
  assert.ok(Math.abs(mix.both.fame - 20_928_786) < 10 && Math.abs(mix.separate.fame - 21_290_724) < 10, `${mix.both.fame} · ${mix.separate.fame}`);
  assert.ok(mix.both.circ <= 30 + 1e-9 && mix.separate.circ <= 30 + 1e-9);
  // No limit: one after the other is just the two added up.
  const free2 = abilityPairPlan(goal(["pas", "boss", "stat"], [0]), goal(hunt.keys, presetLead(hunt)), free);
  assert.ok(Math.abs(free2.separate.fame - free2.a.fame - free2.b.fame) < 1e-6);
});

test("미라클 서큘레이터: own option chances, no locks, top values; at 1.5억 it is never worth it", () => {
  // Official miracle page: same 41 options, line 1 (legendary) chances as the fame reset, other grades its own.
  const mrows = (miracleData as unknown as { rows: [string, number, number, number][] }).rows;
  assert.equal(mrows.length, rows.length);
  for (const r of mrows) assert.equal(r[3], rows.find((x) => x[0] === r[0])![3], r[0]);
  assert.equal(mrows[idx("boss")][2], 0.022624);
  // Cheap enough to be used (100만): miracles while nothing is locked, then fame resets. Options only.
  const cheap = abilityPlan(["pas", "boss", "stat"], "l1u2", { sunday: false, famePricePerUnit: 400, miraclePrice: 1e6 }, 0);
  assert.equal(cheap.start, "miracle");
  assert.ok(Math.abs(cheap.miracle - 144.289) < 0.001, `${cheap.miracle}`);
  assert.ok(Math.abs(cheap.fame + cheap.miracle * 2500 - 6_046_720) < 10, `${cheap.fame}`);
  // Top values: with the lowest values wanted it is the options-only plan; with the top ones and no circulators
  // its lines are already at the goal (1,766.9만 vs 4,508.6만 fame worth).
  const lowest = (k: AbilityKey, g: "legendary" | "unique") => Math.min(...valueChoices(k, g));
  const noCirc = (goal: typeof maxGoal) => ({ sunday: false, famePricePerUnit: 400, values: { goal, circPrice: 1e18 }, miraclePrice: 1e6 });
  const atLowest = abilityPlan(["pas", "boss", "stat"], "l1u2", noCirc(lowest), 0);
  assert.ok(Math.abs(atLowest.fame - cheap.fame) < 1 && Math.abs(atLowest.miracle - cheap.miracle) < 1e-9);
  const atTop = abilityPlan(["pas", "boss", "stat"], "l1u2", noCirc(maxGoal), 0);
  assert.ok(Math.abs(atTop.fame + atTop.miracle * 2500 - 17_668_815) < 10, `${atTop.fame}`);
  // Rows after a miracle start from its top value (Codex review): 보공 found by a miracle leaves 30 black · chaos, not 40
  // (the last option is at the goal by luck 25 % of the time: 0.75 × 40).
  const viaMiracle = abilityPlan(["pas", "boss", "stat"], "l1u2", { ...free, miraclePrice: 1e6 }, 0);
  assert.equal(viaMiracle.start, "miracle");
  const bossRow = viaMiracle.afterFirstLower.find((r) => r.key === "boss")!;
  assert.ok(Math.abs(bossRow.circ - 30) < 1e-6, `${bossRow.circ}`);
  // 고급 재설정 never offers it (lines 2 · 3 are unique at best), even for 1 meso.
  assert.equal(abilityPlan(["pas", "boss", "stat"], "l3", { ...valued, miraclePrice: 1 }).miracle, 0);
  // At 1.5억 no preset uses one, with either reset (일반: free black · chaos, 고급: abyss 2.6억).
  for (const preset of ABILITY_PRESETS)
    for (const mode of ["l3", "l1u2"] as AbilityMode[]) {
      const opts = { ...(mode === "l3" ? valued : free), miraclePrice: 1.5e8 };
      const q = abilityPlan(preset.keys, mode, opts, mode === "l1u2" ? presetLead(preset) : undefined);
      assert.ok(q.miracle < 1e-9, `${preset.label} ${mode}: ${q.miracle}`);
    }
});

test("class builds: a matching chip preset when there is one, else the build itself", () => {
  const id = (letters: string, mode: AbilityMode) => buildPreset(letters, mode)?.id;
  assert.equal(id("패보상", "l3"), "pbs");
  assert.equal(id("패재보", "l3"), "pbcool"); // order does not matter on three legendary lines
  assert.equal(id("재보피", "l3"), "cbh");
  assert.equal(id("보상공", "l1u2"), "bsa");
  assert.equal(id("보상벞", "l1u2"), "bsa"); // buff duration is counted as 공/마
  assert.equal(id("재상보", "l1u2"), "cbs"); // cooldown on the legendary line, as the chip
  assert.equal(id("패상보", "l1u2"), "pbs");
  // the same three options with another legendary line is another build
  const b = buildPreset("보상재", "l1u2")!;
  assert.deepEqual([b.id, b.keys, presetLead(b)], ["build:보상재", ["boss", "stat", "cool"], [0]]);
  assert.deepEqual(buildPreset("재보크", "l3")!.keys, ["cool", "boss", "crit"]);
  assert.equal(buildPreset("보상", "l3"), null);
  assert.equal(buildPreset("공벞보", "l3"), null); // 공 and 벞 are one option
  assert.equal(buildPreset("보패상", "l1u2"), null); // 패시브 only comes legendary
});

test("every class build of the data file can be calculated on both resets", () => {
  const classes = classAbilities();
  assert.equal(classes.length, 48);
  const opts = { sunday: false, famePricePerUnit: 0 };
  const done = new Set<string>();
  for (const c of classes)
    for (const [mode, letters] of [["l3", c.full], ["l1u2", c.practical]] as const) {
      const p = buildPreset(letters, mode);
      assert.ok(p, `${c.name} ${mode} ${letters}`);
      const key = `${mode} ${p.keys.join(",")} ${presetLead(p)[0]}`;
      if (done.has(key)) continue;
      done.add(key);
      const plan = abilityPlan(p.keys, mode, opts, mode === "l1u2" ? presetLead(p) : undefined);
      assert.ok(plan.fame > 0 && Number.isFinite(plan.fame), `${c.name} ${mode} ${letters}: ${plan.fame}`);
    }
});
