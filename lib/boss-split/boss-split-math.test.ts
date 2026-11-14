import assert from "node:assert/strict";
import { test } from "node:test";
import { MESO_MARKET_FEE_RATE, computeBossSplit, wholeMeso } from "./boss-split-math.ts";

const near = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);

test("same server: everyone ends with the same share after the second fee", () => {
  // Sold for 10억 at 5 %: 9.5억 in hand, two people.
  const [leader, member] = computeBossSplit(950_000_000, [0.5, 0.5], 0.05);
  near(leader.finalMeso, member.finalMeso, "equal final shares");
  near(member.beforeMeso * 0.95, member.finalMeso, "member pays the fee again");
  near(member.handedMeso, member.beforeMeso, "handed amount is the amount set aside");
  near(leader.finalMeso + member.beforeMeso, 950_000_000, "nothing left over");
});

test("other server: the meso market takes 1 % more out of that member's amount", () => {
  const net = 950_000_000;
  const [leader, near1, far] = computeBossSplit(net, [1 / 3, 1 / 3, 1 / 3], 0.05, [false, false, true]);
  near(leader.finalMeso, near1.finalMeso, "same final share (same server)");
  near(leader.finalMeso, far.finalMeso, "same final share (other server)");
  // Sold on the meso market → 1 % gone → handed over on the other server → the member pays the usual fee.
  near(far.beforeMeso * (1 - MESO_MARKET_FEE_RATE), far.handedMeso, "what is left after the meso market");
  near(far.handedMeso * 0.95, far.finalMeso, "then the usual fee");
  near(near1.handedMeso, near1.beforeMeso, "same-server member is unchanged in shape");
  assert.ok(far.beforeMeso > near1.beforeMeso, "the other-server share costs the leader more");
  near(leader.finalMeso + near1.beforeMeso + far.beforeMeso, net, "nothing left over");
  // Everyone gets a little less than when nobody is on another server.
  const plain = computeBossSplit(net, [1 / 3, 1 / 3, 1 / 3], 0.05);
  assert.ok(leader.finalMeso < plain[0].finalMeso);
});

test("the leader's own flag is ignored, custom ratios keep their proportions, empty input is zero", () => {
  const a = computeBossSplit(1_000_000_000, [0.5, 0.3, 0.2], 0.03, [true, true, false]);
  near(a[1].finalMeso / a[0].finalMeso, 0.3 / 0.5, "ratio kept for the other-server member");
  near(a[2].finalMeso / a[0].finalMeso, 0.2 / 0.5, "ratio kept for the same-server member");
  near(a[0].beforeMeso, a[0].finalMeso, "leader keeps the share as is");
  assert.deepEqual(computeBossSplit(0, [0.5, 0.5], 0.05, [false, true]).map((s) => s.beforeMeso), [0, 0]);
});

/** The exact amount each card stands for: the leader's final share, each member's amount out of the net. */
const exactOf = (shares: ReturnType<typeof computeBossSplit>) => shares.map((s, i) => (i === 0 ? s.finalMeso : s.beforeMeso));

test("whole meso: the cards add up to the net, each within a meso of its exact amount", () => {
  for (const [ratios, other] of [
    [[0.2, 0.2, 0.2, 0.2, 0.2], [false, false, true, false, false]],
    [[0.5, 0.5], [false, true]],
    [[1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], [false, true, true, false, true, false]],
  ] as const) {
    const net = 1234567890 * 0.97;
    const exact = exactOf(computeBossSplit(net, [...ratios], 0.03, [...other]));
    const whole = wholeMeso(net, exact);
    assert.equal(whole.reduce((sum, v) => sum + v, 0), Math.round(net));
    whole.forEach((v, i) => assert.ok(Math.abs(v - exact[i]) < 1, `card ${i}: ${v} vs ${exact[i]}`));
  }
});

test("whole meso: a leader on 0 % never goes below zero", () => {
  // The case that rounded every member up: net 970,000,002 but members 970,000,003.
  const net = 1000000002 * 0.97;
  const whole = wholeMeso(net, exactOf(computeBossSplit(net, [0, 0.33, 0.33, 0.34], 0.03)));
  assert.ok(whole.every((v) => v >= 0));
  assert.equal(whole.reduce((sum, v) => sum + v, 0), Math.round(net));
  assert.equal(wholeMeso(0, [1, 2]).join(), "0,0");
});

test("whole meso: a negative share is no split, never a payout above the net", () => {
  // −10 % and 110 % add up to 100 %; the calculator does not show it, and the split pays nothing either.
  const net = 1000000000 * 0.97;
  const whole = wholeMeso(net, exactOf(computeBossSplit(net, [-0.1, 1.1], 0.03)));
  assert.deepEqual(whole, [0, 0]);
});
