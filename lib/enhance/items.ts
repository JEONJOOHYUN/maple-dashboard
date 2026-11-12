// What we know about an item from its name alone. The history API has no item level, so the page looks it up in
// this order: the user's own value → the account's equipment (Open API item-equipment) → this table →
// the shared dictionary (what other visitors' browsers found, lib/enhance/dict.ts) → unknown.
// The dictionary comes last on purpose: a wrong value someone sent can never beat what this account itself knows.
// Levels and spare prices come from the calculator's list (lib/ev/defaults.ts, user-checked); the set prefixes are
// the level every piece of that set has (에테르넬 250 · 아케인셰이드 200 · 앱솔랩스 160 · 파프니르 150).
import { STAR_ITEMS, itemImage } from "../ev/defaults.ts";
import { iconUrl, type Dict } from "./dict.ts";

export type KnownItem = {
  level: number;
  /** Spare item price in meso (0 = not known). */
  spare: number;
  maxStar?: number;
  icon?: string;
};

const norm = (s: string) => s.replace(/\s+/g, "");

const byId = new Map(STAR_ITEMS.flatMap((g) => g.items.map((it) => [it.id, { ...it, level: g.level }] as const)));
const pick = (id: string, withIcon = false): KnownItem => {
  const it = byId.get(id)!;
  return { level: it.level, spare: it.spareEok * 1e8, maxStar: it.maxStar, icon: withIcon ? itemImage(it.icons[0]) : undefined };
};

/** List entries that are one item (not a group such as "아케인셰이드 장비"). */
const GROUPS = new Set(["arcane", "astra", "eterArmor", "eterAcc", "destiny"]);
const EXACT = new Map(
  STAR_ITEMS.flatMap((g) => g.items.filter((it) => !GROUPS.has(it.id)).map((it) => [norm(it.name), it.id] as const))
);

export function knownItem(name: string): KnownItem | null {
  const n = norm(name);
  const exact = EXACT.get(n);
  if (exact) return pick(exact, true);
  // "여명의 가디언 엔젤 링" is the same ring as "가디언 엔젤 링".
  if (n.endsWith("가디언엔젤링")) return pick("gaen", true);
  if (n.startsWith("에테르넬")) return pick(/(글러브|슈즈|케이프)$/.test(n) ? "eterAcc" : "eterArmor");
  if (n.startsWith("아케인셰이드")) return pick("arcane");
  if (n.startsWith("아스트라")) return pick("astra");
  if (n.startsWith("데스티니")) return pick("destiny");
  // A spare costs about 4만 메소: counted as nothing (user, 2026-11-12).
  if (n === "로얄블랙메탈숄더") return { level: 120, spare: 0 };
  if (n.startsWith("앱솔랩스")) return { level: 160, spare: 0 };
  if (n.startsWith("파프니르")) return { level: 150, spare: 0 };
  return null;
}

/** Item facts read from the account's equipment (Open API), keyed by item name. */
export type FoundItem = { level: number; icon: string; part: string };

export type ItemInfo = {
  /** 0 = unknown (the try is not judged). */
  level: number;
  /** Spare price in meso. */
  spare: number;
  maxStar?: number;
  icon?: string;
  part?: string;
  /** Where the level came from. */
  source: "user" | "api" | "table" | "dict" | "none";
};

export type ItemOverrides = {
  /** Item name → level typed by the user. */
  levels: Record<string, number>;
  /** Item name → spare price in 억 typed by the user. */
  spares: Record<string, number>;
};

export function resolveItem(name: string, found: Record<string, FoundItem>, over: ItemOverrides, dict: Dict = {}): ItemInfo {
  const table = knownItem(name);
  const api = found[name];
  const shared = Object.hasOwn(dict, name) ? dict[name] : undefined;
  const userLevel = over.levels[name];
  const level = userLevel > 0 ? userLevel : api?.level > 0 ? api.level : (table?.level ?? shared?.level ?? 0);
  const userSpare = over.spares[name];
  return {
    level,
    spare: userSpare >= 0 ? userSpare * 1e8 : (table?.spare ?? 0),
    maxStar: table?.maxStar,
    icon: api?.icon || table?.icon || iconUrl(shared?.icon ?? "") || undefined,
    part: api?.part || shared?.part || undefined,
    source: userLevel > 0 ? "user" : api?.level > 0 ? "api" : table ? "table" : shared ? "dict" : "none",
  };
}

/** Picture of an item whose level is already known (potential rolls carry it): equipment → the calculator's list → the dictionary. */
export const itemIcon = (name: string, found: Record<string, FoundItem>, dict: Dict = {}): string | undefined =>
  found[name]?.icon || knownItem(name)?.icon || iconUrl(Object.hasOwn(dict, name) ? dict[name].icon : "") || undefined;
