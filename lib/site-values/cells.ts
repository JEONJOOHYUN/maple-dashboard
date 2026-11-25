// Every value the admin page shows, as a cell: its key, name, unit and limits. The admin page draws them and the
// server checks what is stored and what is sent against them. (What the screens read is in values.ts · revenue.ts.)
import { CREDIT_SHOP, GIFT_WON_PER_10K, MESO_MARKET_MP, MESO_RATE_WON, MVP_ITEMS, STAR_ITEMS } from "../ev/defaults.ts";
import { CRYSTAL, ITEMS, SPARE_LINK, type ItemId } from "../revenue/data.ts";
import { SAME_AUCTION, extraName, numberOr, type Extra, type SiteValues } from "./values.ts";

export type Group = "market" | "crystal" | "spare" | "reward" | "mvp" | "credit";

/**
 * One number the admin page shows. `scale` turns what is typed into what is stored (보스 결정석 is typed in 만 and
 * stored in meso, a boss reward typed in 억 and stored in 만: the units the screens already use); `digits` = the
 * decimals a stored value keeps.
 */
export type Cell = {
  key: string;
  group: Group;
  name: string;
  /** The unit of the typed number, as the page writes it. */
  unit: string;
  /** The code's value, stored units. */
  def: number;
  scale: number;
  digits: number;
  max: number;
};

const MAX_EOK = 1_000_000;
const eok = (key: string, group: Group, name: string, def: number): Cell => ({ key, group, name, unit: "억", def, scale: 1, digits: 4, max: MAX_EOK });
const whole = (key: string, group: Group, name: string, unit: string, def: number): Cell => ({ key, group, name, unit, def, scale: 1, digits: 0, max: 100_000_000 });

/** Boss rewards with a price of their own (the others follow a star force item, lib/revenue/data.ts SPARE_LINK). */
export const OWN_REWARDS = (Object.keys(ITEMS) as ItemId[]).filter((id) => !(id in SPARE_LINK));

function build(): Cell[] {
  const out: Cell[] = [
    whole("market|mesoWon", "market", "1억 메소", "원", MESO_RATE_WON),
    whole("market|mesoMp", "market", "메소마켓 1억", "메포", MESO_MARKET_MP),
    whole("market|giftWon", "market", "선물 1만 캐시", "원", GIFT_WON_PER_10K),
  ];
  for (const [key, meso] of Object.entries(CRYSTAL)) {
    out.push({ key: `crystal|${key}`, group: "crystal", name: key.replace("|", " "), unit: "만", def: meso, scale: 10_000, digits: 0, max: 1e12 });
  }
  for (const g of STAR_ITEMS) for (const it of g.items) out.push(eok(`spare|${it.id}`, "spare", it.name, it.spareEok));
  for (const id of OWN_REWARDS) out.push({ key: `reward|${id}`, group: "reward", name: ITEMS[id].name, unit: "억", def: ITEMS[id].price, scale: 10_000, digits: 0, max: 1e10 });
  for (const it of MVP_ITEMS) {
    out.push(whole(`mvp|${it.id}|cash`, "mvp", it.name, "캐시", it.cash));
    if (it.ticketMan !== undefined) out.push(whole(`mvp|${it.id}|ticket`, "mvp", `${it.name} · 부티크 티켓`, "만", it.ticketMan));
    else out.push(eok(`mvp|${it.id}|auction`, "mvp", it.name, it.auctionEok));
  }
  for (const it of CREDIT_SHOP) {
    out.push(whole(`credit|${it.id}|credit`, "credit", it.name, "크레딧", it.credit));
    if (!(it.id in SAME_AUCTION)) out.push(eok(`credit|${it.id}|auction`, "credit", it.name, it.auctionEok));
  }
  return out;
}

/** Every fixed cell (the code decides which exist). Added items are the only keys outside this list. */
export const CELLS: readonly Cell[] = build();
const BY_KEY = new Map(CELLS.map((c) => [c.key, c]));
export const cellOf = (key: string): Cell | undefined => BY_KEY.get(key);

const round = (n: number, digits: number) => {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

/** What is typed in a cell → the stored number, or null when it is not a number the cell can hold. */
export function storedOf(cell: Cell, typed: number): number | null {
  if (!Number.isFinite(typed) || typed < 0) return null;
  const stored = round(typed * cell.scale, cell.digits);
  return stored <= cell.max ? stored : null;
}
/** The stored number as the cell shows it (a rounding tail such as 0.30000000000000004 is cut). */
export const typedOf = (cell: Cell, stored: number): number => round(stored / cell.scale, 8);

function cleanExtra(value: unknown): Extra | null {
  if (!value || typeof value !== "object") return null;
  const { level, icon, spareEok } = value as Record<string, unknown>;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 300) return null;
  if (typeof icon !== "string" || !/^[A-Za-z0-9]{0,40}$/.test(icon)) return null;
  if (typeof spareEok !== "number" || !Number.isFinite(spareEok) || spareEok < 0 || spareEok > MAX_EOK) return null;
  return { level, icon, spareEok: round(spareEok, 4) };
}

/** A value as it may be stored under `key`, or null: an unknown key, a wrong type or a number out of range. */
export function cleanValue(key: string, value: unknown): number | Extra | null {
  const cell = cellOf(key);
  if (cell) return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= cell.max && round(value, cell.digits) === value ? value : null;
  return extraName(key) === null ? null : cleanExtra(value);
}

/** Database rows → values. A row that does not pass is left out, so a bad row can never reach a screen. */
export function cleanValues(rows: readonly { key: unknown; value: unknown }[]): SiteValues {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if (typeof row.key !== "string") continue;
    const value = cleanValue(row.key, row.value);
    if (value !== null) out[row.key] = value;
  }
  return out;
}

/** The value in force for a fixed cell: the stored one, else the code's. */
export const numberAt = (values: SiteValues, cell: Cell): number => numberOr(values, cell.key, cell.def);

/** Whether two values of one key are the same (numbers, or an added item's three fields). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const x = a as Extra;
  const y = b as Extra;
  return x.level === y.level && x.icon === y.icon && x.spareEok === y.spareEok;
}

// ── The admin page's four parts ──

export type Section = "market" | "crystal" | "items" | "shop";
/** The part of the admin page a key is shown in. */
export const sectionOf = (key: string): Section =>
  key.startsWith("market|") ? "market" : key.startsWith("crystal|") ? "crystal" : key.startsWith("mvp|") || key.startsWith("credit|") ? "shop" : "items";
/**
 * The day (KST) the code's own values of each part were last changed, for "n일 전에 고침" while the admin page has
 * no change of its own for that part. Move the date when a default in the code is changed.
 */
export const CODE_DATES: Record<Section, string> = { market: "2026-11-21", crystal: "2026-11-24", items: "2026-11-13", shop: "2026-11-17" };
