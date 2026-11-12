import assert from "node:assert/strict";
import { test } from "node:test";
import { MESO_MARKET_FEE_RATE, computeBossSplit } from "./boss-split-math.ts";

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
