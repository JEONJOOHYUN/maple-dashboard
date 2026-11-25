// A row of the shared item dictionary (public.item_dict) as the admin page edits it. Visitors' browsers add rows
// (name · level · icon · part); the admin may correct them, give an item a spare price, or block a name.
// Pure: the page works out what changed with these, and the server checks what it is sent with the same ones.
import { KNOWN_NAMES } from "./values.ts";

export const DICT = "dict|";
export const dictKey = (name: string) => `${DICT}${name}`;

/** What can be changed in a row. `spareEok` null = no price of its own; `blocked` = taken out (the name stays put). */
export type DictState = { level: number; part: string; icon: string; spareEok: number | null; blocked: boolean };
export type DictRow = DictState & { name: string; /** An admin has looked at it. */ checked: boolean };

const MAX_NAME = 60;
const MAX_PART = 20;
const MAX_LEVEL = 300;
const MAX_EOK = 1_000_000;
const ICON = /^[A-Za-z0-9]{0,40}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

/** The item name of a dictionary key, or null when the key is not one or the name could not be a row's. */
export function dictName(key: string): string | null {
  if (!key.startsWith(DICT)) return null;
  const name = key.slice(DICT.length);
  return name.length >= 1 && name.length <= MAX_NAME && name === name.trim() && !CONTROL.test(name) ? name : null;
}

/** Whether an item may carry a price of its own: one the code lists has its price there (one price, one place). */
export const canPrice = (name: string) => !KNOWN_NAMES.has(name);

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** A row's fields as they may be stored for `name`, or null when any of them does not pass. */
export function cleanDictState(value: unknown, name: string): DictState | null {
  if (!value || typeof value !== "object") return null;
  const { level, part, icon, spareEok, blocked } = value as Record<string, unknown>;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return null;
  if (typeof part !== "string" || part !== part.trim() || part.length > MAX_PART || CONTROL.test(part)) return null;
  if (typeof icon !== "string" || !ICON.test(icon)) return null;
  if (typeof blocked !== "boolean") return null;
  if (spareEok !== null && (typeof spareEok !== "number" || !Number.isFinite(spareEok) || spareEok < 0 || spareEok > MAX_EOK || round4(spareEok) !== spareEok)) return null;
  if (spareEok !== null && !canPrice(name)) return null;
  return { level, part, icon, spareEok, blocked };
}

export const stateOf = (row: DictState): DictState => ({ level: row.level, part: row.part, icon: row.icon, spareEok: row.spareEok, blocked: row.blocked });

export function sameDict(a: DictState | null, b: DictState | null): boolean {
  if (!a || !b) return a === b;
  return a.level === b.level && a.part === b.part && a.icon === b.icon && a.spareEok === b.spareEok && a.blocked === b.blocked;
}

/**
 * What is typed in a row, field by field (a field that was not touched is left out). The price is the one field
 * that can be emptied: "" takes the price away.
 */
export type DictEdit = { level?: string; part?: string; spare?: string; icon?: string; blocked?: boolean };

const numberOf = (text: string) => {
  const n = Number(text.replace(/,/g, "").trim());
  return text.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * The row as it would be stored with `edit` laid over it; `row` null = a name the dictionary does not have yet.
 * Returns the fields that do not pass instead when there are any.
 */
export function editedState(row: DictState | null, edit: DictEdit, name: string): { state: DictState } | { bad: (keyof DictEdit)[] } {
  const bad: (keyof DictEdit)[] = [];
  let level = row?.level ?? 0;
  if (edit.level !== undefined && edit.level.trim() !== "") {
    const n = numberOf(edit.level);
    if (n === null || !Number.isInteger(n) || n < 1 || n > MAX_LEVEL) bad.push("level");
    else level = n;
  }
  if (level < 1) bad.push("level");
  const part = (edit.part ?? row?.part ?? "").trim();
  if (part.length > MAX_PART || CONTROL.test(part)) bad.push("part");
  let spareEok = row?.spareEok ?? null;
  if (edit.spare !== undefined) {
    if (edit.spare.trim() === "") spareEok = null;
    else {
      const n = numberOf(edit.spare);
      if (n === null || n < 0 || n > MAX_EOK || !canPrice(name)) bad.push("spare");
      else spareEok = round4(n);
    }
  }
  if (bad.length > 0) return { bad: [...new Set(bad)] };
  return { state: { level, part, icon: edit.icon ?? row?.icon ?? "", spareEok, blocked: edit.blocked ?? row?.blocked ?? false } };
}
