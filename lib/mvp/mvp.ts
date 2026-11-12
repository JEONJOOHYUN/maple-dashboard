// MVP grade calculator. Official guide (maplestory.nexon.com/guide/n23gameinformation/articles/425, 2026-11-08):
// grade = Nexon Cash spent in the last 13 weeks including this week, weeks run Thu 00:00 ~ Wed 23:59 (KST),
// thresholds below. Amounts are in won (1 cash = 1 won).

export const MVP_TIERS = [
  { name: "브론즈", min: 150_000, color: "#B9805A" },
  { name: "실버", min: 300_000, color: "#A9B2BC" },
  { name: "골드", min: 600_000, color: "#E2B23C" },
  { name: "다이아", min: 900_000, color: "#6FC7E8" },
  { name: "레드", min: 1_500_000, color: "#E2504F" },
  { name: "블랙", min: 2_500_000, color: "#3A3836" },
] as const;
export type MvpTier = (typeof MVP_TIERS)[number];

export const WEEKS = 13;
const KST = 9 * 3600_000;
const DAY = 86400_000;

export function tierOf(sum: number): MvpTier | null {
  let found: MvpTier | null = null;
  for (const t of MVP_TIERS) if (sum >= t.min) found = t;
  return found;
}
export function nextTierOf(sum: number): MvpTier | null {
  return MVP_TIERS.find((t) => sum < t.min) ?? null;
}

/** "YYYY-MM-DD" (KST) of the Thursday that starts the week containing `now`. */
export function weekStart(now: number): string {
  const kst = new Date(now + KST);
  const dow = kst.getUTCDay(); // 0 = Sun … 4 = Thu
  const back = (dow + 7 - 4) % 7;
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - back * DAY);
  return start.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** The 13 closed weeks (oldest first) and this week. */
export function weekList(now: number): { closed: string[]; current: string } {
  const current = weekStart(now);
  return { closed: Array.from({ length: WEEKS }, (_, i) => addDays(current, -7 * (WEEKS - i))), current };
}

/** Milliseconds until this week closes (Wednesday 23:59:59 KST). */
export function msToDeadline(now: number): number {
  const current = weekStart(now);
  const end = Date.parse(`${addDays(current, 7)}T00:00:00Z`) - KST; // next Thursday 00:00 KST
  return Math.max(0, end - now);
}

export type MvpState = {
  /** Grade now = 13 weeks ending last week (set last Thursday). */
  sumNow: number;
  /** Grade next Thursday = this week + the 12 newest closed weeks. */
  sumNext: number;
  now: MvpTier | null;
  next: MvpTier | null;
  /** Next grade above what next Thursday gives, and how much more this week reaches it. */
  up: MvpTier | null;
  need: number;
};

export function mvpState(amounts: Record<string, number>, nowMs: number, extraThisWeek = 0): MvpState {
  const { closed, current } = weekList(nowMs);
  const get = (d: string) => amounts[d] ?? 0;
  const sumNow = closed.reduce((s, d) => s + get(d), 0);
  const sumNext = sumNow - get(closed[0]) + get(current) + extraThisWeek;
  const up = nextTierOf(sumNext);
  return { sumNow, sumNext, now: tierOf(sumNow), next: tierOf(sumNext), up, need: up ? up.min - sumNext : 0 };
}

export type ChargeMethod = { id: string; name: string; note: string; discountPct: number; monthlyCap: number; unit: number };

export type ChargePlan = { takes: Record<string, number>; pay: number; charged: number };

/**
 * Charge `cash` won of Nexon Cash, biggest discount first, within each method's monthly cap
 * (gift cards: 50,000 won notes, 200,000 per kind, 600,000 for the three together).
 */
export function chargePlan(cash: number, methods: ChargeMethod[], giftCardCap = 600_000): ChargePlan {
  let rest = Math.max(0, cash);
  let pay = 0;
  let charged = 0;
  let giftUsed = 0;
  const takes: Record<string, number> = {};
  for (const m of [...methods].sort((a, b) => b.discountPct - a.discountPct)) {
    let cap = Number.isFinite(m.monthlyCap) ? m.monthlyCap : Infinity;
    const isGift = m.unit >= 10_000 && Number.isFinite(m.monthlyCap);
    if (isGift) cap = Math.min(cap, giftCardCap - giftUsed);
    // Gift cards come in whole notes; round up so the need is covered when the cap allows.
    let take = Math.min(cap, Math.ceil(rest / m.unit) * m.unit);
    take = Math.max(0, Math.floor(take / m.unit) * m.unit);
    takes[m.id] = take;
    if (isGift) giftUsed += take;
    charged += take;
    pay += take * (1 - m.discountPct / 100);
    rest = Math.max(0, rest - take);
  }
  return { takes, pay, charged };
}

/** Won returned per 1 cash when buying an item and selling it on the auction house for meso. */
export function itemRate(cash: number, auctionEok: number, auctionFeePct: number, wonPer100m: number): number {
  if (!(cash > 0) || !(auctionEok > 0)) return 0;
  // Meso → won after the 3 % fee on selling meso.
  return (auctionEok * (1 - auctionFeePct / 100) * wonPer100m * 0.97) / cash;
}

/** Won returned per 1 maple point sold on the meso market (`mpPer100m` points buy 1억 meso). */
export function mesoMarketRate(mpPer100m: number, wonPer100m: number): number {
  return mpPer100m > 0 ? (wonPer100m * 0.97) / mpPer100m : 0;
}

// ---------------------------------------------------------------------------
// Selling the cash back: which items to buy, meso market, gifting, and credits.
// Meso turns into won at the meso price minus the 3 % selling fee.

/** Selling fee when meso is sold for won. */
export const MESO_SELL_KEEP = 0.97;

export type Market = {
  /** Won per 1억 meso. */
  wonPer100m: number;
  /** Maple points per 1억 meso on the meso market. */
  mpPer100m: number;
  /** Auction house fee in % (3 with MVP silver or above, else 5). */
  auctionFeePct: number;
  /** Won received per 10,000 cash gifted (gift route: cash right away, no credit). */
  giftWonPer10k: number;
  /** Credit earned per cash spent in the cash shop (incl. maple points), in %. */
  creditPct: number;
  useCredit: boolean;
  /** Credit already owned. */
  creditNow: number;
};
export type SellItem = { id: string; name: string; cash: number; eok: number };
export type CreditItem = { id: string; name: string; credit: number; eok: number };

/** Won for an item sold once on the auction house at `eok` 억. */
export function auctionWon(eok: number, m: Market): number {
  return eok > 0 ? eok * (1 - m.auctionFeePct / 100) * m.wonPer100m * MESO_SELL_KEEP : 0;
}

/** Best credit spend: unbounded knapsack over the credit shop (credits in steps of 100). */
export function creditPlan(credits: number, shop: CreditItem[], m: Market): { won: number; used: number; buys: Record<string, number> } {
  const STEP = 100;
  const items = shop.filter((s) => s.credit > 0 && s.eok > 0).map((s) => ({ ...s, c: Math.ceil(s.credit / STEP), w: auctionWon(s.eok, m) }));
  const n = Math.max(0, Math.floor(credits / STEP));
  if (n === 0 || items.length === 0) return { won: 0, used: 0, buys: {} };
  const best = new Float64Array(n + 1);
  const pick = new Int16Array(n + 1).fill(-1);
  for (let c = 1; c <= n; c++) {
    best[c] = best[c - 1];
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.c <= c && best[c - it.c] + it.w > best[c]) {
        best[c] = best[c - it.c] + it.w;
        pick[c] = k;
      }
    }
  }
  const buys: Record<string, number> = {};
  let used = 0;
  for (let c = n; c > 0; ) {
    const k = pick[c];
    if (k < 0) {
      c -= 1;
      continue;
    }
    buys[items[k].id] = (buys[items[k].id] ?? 0) + 1;
    used += items[k].credit;
    c -= items[k].c;
  }
  return { won: best[n], used, buys };
}

/** Won one credit is worth at best (for ranking items; the route itself uses creditPlan). */
export function creditWorth(shop: CreditItem[], m: Market): number {
  return Math.max(0, ...shop.filter((s) => s.credit > 0).map((s) => auctionWon(s.eok, m) / s.credit));
}

/** Best won for every credit amount up to `maxCredits`, in steps of 100 credit (index = credits ÷ 100). */
export function creditTable(maxCredits: number, shop: CreditItem[], m: Market): Float64Array {
  const STEP = 100;
  const items = shop.filter((s) => s.credit > 0 && s.eok > 0).map((s) => ({ c: Math.ceil(s.credit / STEP), w: auctionWon(s.eok, m) }));
  const n = Math.max(0, Math.floor(maxCredits / STEP));
  const best = new Float64Array(n + 1);
  for (let c = 1; c <= n; c++) {
    best[c] = best[c - 1];
    for (const it of items) if (it.c <= c && best[c - it.c] + it.w > best[c]) best[c] = best[c - it.c] + it.w;
  }
  return best;
}

export type RouteMode = "best" | "mm" | "gift";
export type Route = {
  mode: RouteMode;
  /** Cash going in. */
  cash: number;
  items: { id: string; name: string; count: number; cash: number; won: number }[];
  mm: { cash: number; eok: number; won: number };
  gift: { cash: number; won: number };
  credit: { earned: number; total: number; used: number; won: number; buys: { id: string; name: string; count: number; won: number }[] };
  /** Cash left unspent (the charge was rounded up, or nothing fits). */
  leftover: number;
  /** Cash still missing to reach the amount the grade needs (0 when the route spends enough). */
  short: number;
  /** True when the cash is too large for the exact search (over MAX_STATES at a 1-cash step). */
  approx: boolean;
  /** Won back in total (credit included). */
  won: number;
  /** Auction house sales (credit-shop items counted apart in credit.buys). */
  sales: number;
};

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Largest table the route search builds (cash ÷ step). 6M covers 600만 원 even at a 1-cash step. */
const MAX_STATES = 6_000_000;
const GIFT_UNIT = 10_000;

/**
 * How to turn `cash` into won while spending at least `need` (only spending counts toward MVP).
 * best = items · meso market · gifting mixed, mm = maple points only, gift = gifting only.
 * Items and maple points are searched over every exact spend (unbounded knapsack), credit is added
 * with its real exchange (creditTable) for that spend, and gifting fills what is left in 10,000 steps.
 */
export function sellRoute(cash: number, need: number, mode: RouteMode, items: SellItem[], shop: CreditItem[], m: Market): Route {
  type Opt = { kind: "item" | "mm"; id: string; cost: number; won: number };
  const opts: Opt[] = [];
  if (mode === "best")
    for (const it of items) {
      const w = auctionWon(it.eok, m);
      if (it.cash > 0 && w > 0) opts.push({ kind: "item", id: it.id, cost: Math.round(it.cash), won: w });
    }
  if ((mode === "best" || mode === "mm") && m.mpPer100m > 0 && m.wonPer100m > 0)
    opts.push({ kind: "mm", id: "mm", cost: Math.round(m.mpPer100m), won: m.wonPer100m * MESO_SELL_KEEP });
  const giftWon = mode === "best" || mode === "gift" ? Math.max(0, m.giftWonPer10k) : 0;

  const total = Math.max(0, Math.floor(cash));
  const want = Math.min(Math.max(0, Math.floor(need)), total);

  // Step every option cost shares, so the search is exact. An odd meso-market price (e.g. 1,801) can make
  // that step tiny; then the meso market becomes a filler counted on top of an exact item search.
  // Only if items alone are still too fine are costs rounded UP (never overspends), with each state's real spend kept.
  let dpOpts = opts;
  let filler: Opt | null = null;
  let g = opts.reduce((a, o) => gcd(a, o.cost), 0) || total || 1;
  if (total / g > MAX_STATES) {
    const mmOpt = opts.find((o) => o.kind === "mm") ?? null;
    const rest = opts.filter((o) => o.kind !== "mm");
    const g2 = rest.reduce((a, o) => gcd(a, o.cost), 0) || total || 1;
    if (mmOpt && total / g2 <= MAX_STATES) {
      dpOpts = rest;
      filler = mmOpt;
      g = g2;
    }
  }
  const coarse = total / g > MAX_STATES;
  if (coarse) g = Math.ceil(total / MAX_STATES);
  const units = dpOpts.map((o) => Math.max(1, Math.ceil(o.cost / g)));
  const n = Math.floor(total / g);
  // Float32 is plenty for comparing won totals (≤ a few million) and halves the memory of a big table.
  const reach = new Float32Array(n + 1).fill(-Infinity);
  const pick = new Int8Array(n + 1).fill(-1);
  const real = coarse ? new Float64Array(n + 1) : null;
  reach[0] = 0;
  for (let c = 1; c <= n; c++)
    for (let k = 0; k < dpOpts.length; k++) {
      const u = units[k];
      if (u <= c && reach[c - u] > -Infinity && reach[c - u] + dpOpts[k].won > reach[c]) {
        reach[c] = reach[c - u] + dpOpts[k].won;
        pick[c] = k;
        if (real) real[c] = real[c - u] + dpOpts[k].cost;
      }
    }

  const pct = m.useCredit && mode !== "gift" ? m.creditPct / 100 : 0;
  const creditNow = m.useCredit ? Math.max(0, Math.floor(m.creditNow)) : 0;
  const ctab = m.useCredit ? creditTable(Math.floor(total * pct) + creditNow, shop, m) : new Float64Array(1);
  const creditWon = (shopCash: number) => ctab[Math.min(ctab.length - 1, Math.floor((Math.floor(shopCash * pct) + creditNow) / 100))] ?? 0;

  // Pick the spend: the most won among plans that spend at least `want`; if none can, the one that spends the most.
  // Filler counts tried for each item spend: the ends and 60 around them. Exact only up to MAX_STATES cash
  // (the full search); past that the route is marked approximate (route.approx) because a middle count can
  // be slightly better when gifting soaks up the remainder.
  const fillerCounts = (room: number): number[] => {
    if (!filler) return [0];
    const max = Math.floor(room / filler.cost);
    const out = new Set<number>();
    for (let k = 0; k <= Math.min(60, max); k++) out.add(k);
    for (let k = Math.max(0, max - 60); k <= max; k++) out.add(k);
    return [...out];
  };
  let bestC = -1;
  let bestK = 0;
  let bestVal = -Infinity;
  let fallbackC = 0;
  let fallbackK = 0;
  let fallbackSpent = -1;
  for (let c = 0; c <= n; c++) {
    if (reach[c] === -Infinity) continue;
    const s0 = real ? real[c] : c * g;
    for (const k of fillerCounts(total - s0)) {
      const s = s0 + (filler ? k * filler.cost : 0);
      const gifts = giftWon > 0 ? Math.floor((total - s) / GIFT_UNIT) : 0;
      const spent = s + gifts * GIFT_UNIT;
      const val = reach[c] + (filler ? k * filler.won : 0) + gifts * giftWon + creditWon(s);
      if (spent >= want) {
        if (val > bestVal) [bestVal, bestC, bestK] = [val, c, k];
      } else if (spent > fallbackSpent) [fallbackSpent, fallbackC, fallbackK] = [spent, c, k];
    }
  }
  const [chosen, chosenK] = bestC >= 0 ? [bestC, bestK] : [fallbackC, fallbackK];

  const counts = new Map<string, number>();
  for (let c = chosen; c > 0; ) {
    const k = pick[c];
    counts.set(dpOpts[k].id, (counts.get(dpOpts[k].id) ?? 0) + 1);
    c -= units[k];
  }
  if (filler && chosenK > 0) counts.set(filler.id, chosenK);

  const route: Route = {
    mode,
    cash: total,
    items: [],
    mm: { cash: 0, eok: 0, won: 0 },
    gift: { cash: 0, won: 0 },
    credit: { earned: 0, total: 0, used: 0, won: 0, buys: [] },
    leftover: 0,
    short: 0,
    approx: filler !== null || coarse,
    won: 0,
    sales: 0,
  };
  let shopCash = 0;
  for (const o of opts) {
    const k = counts.get(o.id) ?? 0;
    if (!k) continue;
    shopCash += k * o.cost;
    if (o.kind === "item") {
      const it = items.find((x) => x.id === o.id)!;
      route.items.push({ id: it.id, name: it.name, count: k, cash: k * o.cost, won: k * o.won });
      route.sales += k;
    } else {
      route.mm = { cash: k * o.cost, eok: k, won: k * o.won };
      route.sales += 1;
    }
  }
  route.items.sort((a, b) => b.won - a.won);
  if (giftWon > 0) {
    const gifts = Math.floor((total - shopCash) / GIFT_UNIT);
    route.gift = { cash: gifts * GIFT_UNIT, won: gifts * giftWon };
  }
  const spent = shopCash + route.gift.cash;
  route.leftover = total - spent;
  route.short = Math.max(0, want - spent);
  if (m.useCredit) {
    const earned = Math.floor(shopCash * pct);
    const all = earned + creditNow;
    const cp = creditPlan(all, shop, m);
    route.credit = {
      earned,
      total: all,
      used: cp.used,
      won: cp.won,
      buys: shop
        .filter((s) => cp.buys[s.id])
        .map((s) => ({ id: s.id, name: s.name, count: cp.buys[s.id], won: cp.buys[s.id] * auctionWon(s.eok, m) })),
    };
  }
  route.won = route.items.reduce((s, x) => s + x.won, 0) + route.mm.won + route.gift.won + route.credit.won;
  return route;
}
