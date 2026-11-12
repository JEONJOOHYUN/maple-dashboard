// The shared item dictionary: item name → equipment level · icon code · part, collected from what visitors' browsers
// learn from the NEXON Open API (their characters' equipment, and the level in their potential history) and kept on
// our server (public.item_dict) so everyone sees a picture and a level for items they no longer wear.
// Only item facts travel: no character name, no key, no history. This file is the part both sides share —
// the browser builds a report with it, the server action checks every value with it before saving.
import type { FoundItem } from "./items.ts";

/** `icon` = the code after NEXON's icon address ("" = not known yet). */
export type DictItem = { level: number; icon: string; part: string };
export type Dict = Record<string, DictItem>;
export type ReportItem = DictItem & { name: string };

export const ICON_BASE = "https://open.api.nexon.com/static/maplestory/item/icon/";
const ICON_CODE = /^[A-Za-z0-9]{1,40}$/;

export const MAX_NAME = 60;
export const MAX_PART = 20;
export const MAX_LEVEL = 300;
/** Items in one report, and names in one lookup. */
export const MAX_REPORT = 50;
export const MAX_NAMES = 500;

/** Code of a NEXON item icon address, "" for anything else (only that host and path is ever shown or stored). */
export function iconCode(url: unknown): string {
  if (typeof url !== "string" || !url.startsWith(ICON_BASE)) return "";
  const code = url.slice(ICON_BASE.length);
  return ICON_CODE.test(code) ? code : "";
}
export const iconUrl = (code: string) => (code ? ICON_BASE + code : "");

// Control characters never belong in an item name; the name is trimmed, never rewritten.
const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= max && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
};
export const cleanName = (value: unknown): string | null => {
  const name = cleanText(value, MAX_NAME);
  return name ? name : null;
};

/** Names of a lookup as they arrive from a browser: strings only, no repeats; too many = none (not a real visitor). */
export function cleanNames(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > MAX_NAMES) return [];
  const out = new Set<string>();
  for (const value of input) {
    const name = cleanName(value);
    if (name) out.add(name);
  }
  return [...out];
}

/**
 * One item fact as it arrives from a browser, or null when it is not exactly that: a level outside 1~300 or a part
 * that is too long drops the item; an icon that is not a NEXON icon code is left empty.
 */
export function cleanItem(value: unknown): ReportItem | null {
  if (typeof value !== "object" || value === null) return null;
  const { name: rawName, level, icon, part: rawPart } = value as Record<string, unknown>;
  const name = cleanName(rawName);
  if (!name) return null;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return null;
  const part = cleanText(rawPart ?? "", MAX_PART);
  if (part === null) return null;
  return { name, level, icon: typeof icon === "string" && ICON_CODE.test(icon) ? icon : "", part };
}

/** A report as it arrives from a browser: the items that pass cleanItem(), one per name. Too many items = none. */
export function cleanReport(input: unknown): ReportItem[] {
  if (!Array.isArray(input) || input.length > MAX_REPORT) return [];
  const out = new Map<string, ReportItem>();
  for (const value of input) {
    const item = cleanItem(value);
    if (item && !out.has(item.name)) out.set(item.name, item);
  }
  return [...out.values()];
}

/**
 * What a report adds to a saved item: only an icon or a part that was empty. The level that came first stays
 * (a later, different level never replaces it). null = nothing to add.
 */
export function fillOf(saved: DictItem, next: DictItem): Partial<Pick<DictItem, "icon" | "part">> | null {
  const fill: Partial<Pick<DictItem, "icon" | "part">> = {};
  if (!saved.icon && next.icon) fill.icon = next.icon;
  if (!saved.part && next.part) fill.part = next.part;
  return fill.icon || fill.part ? fill : null;
}

/**
 * What this browser knows that the dictionary does not: items missing from it, and items whose icon or part it lacks.
 * `found` = the account's equipment (level · icon · part), `rolled` = items of the potential history (level · part).
 * `dict` must hold everything the dictionary has for these names (a lookup of them made first).
 */
export function reportOf(found: Record<string, FoundItem>, rolled: { item: string; level: number; part: string }[], dict: Dict): ReportItem[] {
  const facts = new Map<string, ReportItem>();
  for (const [name, it] of Object.entries(found)) facts.set(name, { name, level: it.level, icon: iconCode(it.icon), part: it.part });
  for (const r of rolled) {
    const had = facts.get(r.item);
    // The equipment's own level and icon win; the history's part is the more exact one ("방패" rather than "보조무기").
    if (had) facts.set(r.item, { ...had, part: r.part || had.part });
    else facts.set(r.item, { name: r.item, level: r.level, icon: "", part: r.part });
  }
  const out: ReportItem[] = [];
  for (const raw of facts.values()) {
    // The same check the server makes: what it would drop is not sent.
    const fact = cleanItem(raw);
    if (!fact) continue;
    const saved = dict[fact.name];
    if (!saved || fillOf(saved, fact)) out.push(fact);
  }
  return out;
}
