// Default values the admin page can change: prices that move with patches and the market.
// The code keeps its own defaults (lib/ev/defaults.ts · lib/revenue/data.ts); the database holds only the cells that
// differ from them (public.site_values, migration 014), so a cell nobody changed follows the code.
// Everything here is pure: the same functions run on the server, in the browser and in tests.
// Chances and game rules are not here on purpose: they change in the code only.
//
// Three files, so a screen carries only the tables it shows:
//   values.ts  (this one) what the calculators read — the star force items, the shops, the market
//   revenue.ts what the boss revenue page reads — crystal prices, reward prices
//   cells.ts   every cell with its unit and limits — the admin page and the server's checks
import { CREDIT_SHOP, GIFT_WON_PER_10K, MESO_MARKET_MP, MESO_RATE_WON, MVP_ITEMS, STAR_ITEMS, type StarItem } from "../ev/defaults.ts";

/** Stored values by key: what the database has, already checked (cells.ts `cleanValues`). */
export type SiteValues = Readonly<Record<string, unknown>>;
export const NO_VALUES: SiteValues = Object.freeze({});

/** An item added from the shared item dictionary: it joins the star force list at its level. */
export type Extra = { level: number; icon: string; spareEok: number };
export const EXTRA = "extra|";
export const extraKey = (name: string) => `${EXTRA}${name}`;
/** The star force list's id of an added item. */
export const extraId = (name: string) => `x:${name}`;

/** Names of the items the code lists (an added item cannot take one of them). */
export const KNOWN_NAMES: ReadonlySet<string> = new Set(STAR_ITEMS.flatMap((g) => g.items.map((it) => it.name)));
/** The name of an added item, or null when the key is not one (or names an item the code already lists). */
export function extraName(key: string): string | null {
  if (!key.startsWith(EXTRA)) return null;
  const name = key.slice(EXTRA.length);
  return name.length >= 1 && name.length <= 60 && name === name.trim() && !KNOWN_NAMES.has(name) ? name : null;
}

/** The credit shop's 플래티넘 카르마의 가위 is the cash shop's: one auction price, kept with the cash item. */
export const SAME_AUCTION: Record<string, string> = { pga: "pga" };

/** The stored number under `key`, else the code's. */
export const numberOr = (values: SiteValues, key: string, def: number): number => {
  const v = values[key];
  return typeof v === "number" ? v : def;
};

// Each answer is worked out once per values object (the layout hands every screen the same one), and with nothing
// stored for it the code's own table comes back as it is.

export const has = (values: SiteValues, ...prefixes: string[]) => Object.keys(values).some((k) => prefixes.some((p) => k.startsWith(p)));
export function once<T>(make: (values: SiteValues) => T): (values?: SiteValues) => T {
  const done = new WeakMap<SiteValues, T>();
  return (values = NO_VALUES) => {
    let out = done.get(values);
    if (out === undefined) done.set(values, (out = make(values)));
    return out;
  };
}

export type StarGroup = { level: number; items: StarItem[] };

/**
 * The star limit an added item has by its name: a piece of a set keeps the limit of the list's entry for that set
 * (a 데스티니 weapon stops at 25 stars). The same names lib/enhance/items.ts knownItem reads as that set.
 */
const SET_LIMITS: [prefix: string, id: string][] = [["데스티니", "destiny"]];
function limitOf(name: string): number | undefined {
  const set = SET_LIMITS.find(([prefix]) => name.replace(/ /g, "").startsWith(prefix));
  return set && STAR_ITEMS.flatMap((g) => g.items).find((it) => it.id === set[1])?.maxStar;
}

/** The added items, by name. */
export const extras = once((values): Record<string, Extra> => {
  const out: Record<string, Extra> = {};
  for (const [key, value] of Object.entries(values)) {
    const name = extraName(key);
    if (name !== null && value && typeof value === "object") out[name] = value as Extra;
  }
  return out;
});

/** The star force items by level with their spare prices (억), cheapest first inside a level. */
export const starItems = once((values): StarGroup[] => {
  if (!has(values, "spare|", EXTRA)) return STAR_ITEMS;
  const byLevel = new Map<number, StarItem[]>();
  for (const g of STAR_ITEMS) byLevel.set(g.level, g.items.map((it) => ({ ...it, spareEok: numberOr(values, `spare|${it.id}`, it.spareEok) })));
  for (const [name, extra] of Object.entries(extras(values))) {
    const items = byLevel.get(extra.level) ?? [];
    const maxStar = limitOf(name);
    items.push({ id: extraId(name), name, icons: extra.icon ? [extra.icon] : [], spareEok: extra.spareEok, ...(maxStar === undefined ? {} : { maxStar }) });
    byLevel.set(extra.level, items);
  }
  return [...byLevel]
    .sort((a, b) => a[0] - b[0])
    .map(([level, items]) => ({ level, items: items.sort((a, b) => a.spareEok - b.spareEok) }));
});

/** MVP: the cash items with their prices. */
export const mvpItems = once((values): typeof MVP_ITEMS => {
  if (!has(values, "mvp|")) return MVP_ITEMS;
  return MVP_ITEMS.map((it) => ({
    ...it,
    cash: numberOr(values, `mvp|${it.id}|cash`, it.cash),
    ...(it.ticketMan !== undefined ? { ticketMan: numberOr(values, `mvp|${it.id}|ticket`, it.ticketMan) } : { auctionEok: numberOr(values, `mvp|${it.id}|auction`, it.auctionEok) }),
  }));
});

/** The credit shop items with their prices. */
export const creditShop = once((values): typeof CREDIT_SHOP => {
  if (!has(values, "credit|", "mvp|")) return CREDIT_SHOP;
  const cash = mvpItems(values);
  return CREDIT_SHOP.map((it) => {
    const same = SAME_AUCTION[it.id];
    const auctionEok = same ? (cash.find((x) => x.id === same)?.auctionEok ?? it.auctionEok) : numberOr(values, `credit|${it.id}|auction`, it.auctionEok);
    return { ...it, credit: numberOr(values, `credit|${it.id}|credit`, it.credit), auctionEok };
  });
});

export type Market = { mesoWon: number; mesoMp: number; giftWon: number };
/** 1억 메소 in won · 메소마켓 1억 in maple points · won for 10,000 cash gifted. */
export const market = once(
  (values): Market => ({
    mesoWon: numberOr(values, "market|mesoWon", MESO_RATE_WON),
    mesoMp: numberOr(values, "market|mesoMp", MESO_MARKET_MP),
    giftWon: numberOr(values, "market|giftWon", GIFT_WON_PER_10K),
  })
);
