import { test } from "node:test";
import assert from "node:assert/strict";
import { BOUTIQUE_FEVER, BOUTIQUE_NORMAL, fewestTickets, isFever, shareAtLeast, ticketsAtTop, ticketsPer10 } from "./boutique.ts";

const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} vs ${b}`);

test("부티크 기프트: official tables add up, averages per 10 opens", () => {
  near(BOUTIQUE_NORMAL.reduce((s, [, p]) => s + p, 0), 100, 1e-9);
  near(BOUTIQUE_FEVER.reduce((s, [, p]) => s + p, 0), 100, 1e-9);
  near(ticketsPer10(true), 32.7611, 1e-4, "plain average");
  // The players' "30.5개" is the average with the 500+ (fever 1000+) rows taken out.
  near(ticketsPer10(), 30.5703, 1e-4, "without jackpots");
  assert.ok(isFever(10) && isFever(20) && !isFever(9) && !isFever(11));
  assert.equal(fewestTickets(9), 9);
  assert.equal(fewestTickets(10), 19);
  assert.equal(fewestTickets(30), 57);
});

test("부티크 기프트: shares and luck levels, exact (checked against 2,000,000 simulated buyers, 2026-11-17)", () => {
  near(shareAtLeast(30, 95), 0.24921, 0.00002, "30 opens, 95 tickets (simulated 0.24967, z 1.5)");
  near(shareAtLeast(10, 33), 0.23519, 0.00002, "10 opens, 33 tickets (simulated 0.23482, z −1.2)");
  near(shareAtLeast(10, fewestTickets(10)), 1, 1e-12, "everyone gets the fewest");
  assert.ok(shareAtLeast(10, fewestTickets(10) + 1) < 1);
  // 운 좋으면 (상위 10%) · 절반 · 운 나쁘면 (상위 90%), 10 opens.
  assert.deepEqual([0.1, 0.5, 0.9].map((top) => ticketsAtTop(top)), [37, 28, 23]);
});
