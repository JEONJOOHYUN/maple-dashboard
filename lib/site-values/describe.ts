// A changed value as one line of words, for the admin page's "n개 바뀜" bar and its history: the same words in both.
import { koreanUnits } from "../format.ts";
import { cellOf, typedOf, type Cell } from "./cells.ts";
import { dictName, type DictState } from "./dict-edit.ts";

/** A value as the admin page writes it: commas, up to the four decimals a price keeps. */
export const num = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });

/** What kind of price a cell of the shops is (two cells of one item share its name). */
const KIND: Record<string, string> = { cash: " 캐시 가격", auction: " 경매장", credit: " 크레딧" };

/** A stored number as it is read aloud: meso amounts in 만 · 억, the rest in the cell's own unit. */
function amount(cell: Cell, stored: number): string {
  if (cell.group === "crystal") return koreanUnits(stored);
  if (cell.group === "reward") return koreanUnits(stored * 10_000);
  return num(typedOf(cell, stored));
}

/** The name a change goes by ("림보 익스트림", "프라임 큐브 경매장", an item of the dictionary), or null for a key the code no longer has. */
export function changeName(key: string): string | null {
  const cell = cellOf(key);
  if (cell) return cell.name + (cell.group === "mvp" || cell.group === "credit" ? (KIND[key.slice(key.lastIndexOf("|") + 1)] ?? "") : "");
  return dictName(key);
}

const isState = (v: unknown): v is DictState => !!v && typeof v === "object" && typeof (v as DictState).level === "number";
const price = (eok: number | null) => (eok === null ? "없음" : `${num(eok)}억`);

/** What changed in a dictionary row: "레벨 250 → 200 · 노작값 없음 → 12억 · 막음". */
function dictText(from: unknown, to: unknown): string {
  if (!isState(to)) return "";
  if (!isState(from)) return [`새로 넣음 · Lv.${to.level}`, to.part, to.spareEok !== null && `노작값 ${price(to.spareEok)}`].filter(Boolean).join(" · ");
  const out: string[] = [];
  if (from.blocked !== to.blocked) out.push(to.blocked ? "막음" : "막기 풂");
  if (from.level !== to.level) out.push(`레벨 ${from.level} → ${to.level}`);
  if (from.part !== to.part) out.push(`부위 ${from.part || "없음"} → ${to.part || "없음"}`);
  if (from.spareEok !== to.spareEok) out.push(`노작값 ${price(from.spareEok)} → ${price(to.spareEok)}`);
  if (from.icon !== to.icon) out.push(to.icon ? "그림 바꿈" : "그림 지움");
  return out.join(" · ");
}

/** "1,400 → 1,350원" · "75억 → 78억" · "레벨 250 → 200". Empty for a key the code no longer has. */
export function changeText(key: string, from: unknown, to: unknown): string {
  const cell = cellOf(key);
  if (cell) {
    if (typeof from !== "number" || typeof to !== "number") return "";
    const meso = cell.group === "crystal" || cell.group === "reward";
    return `${amount(cell, from)} → ${amount(cell, to)}${meso ? "" : cell.unit}`;
  }
  return dictName(key) === null ? "" : dictText(from, to);
}

/** Both together: "림보 익스트림 75억 → 78억". */
export function describeChange(key: string, from: unknown, to: unknown): string {
  const name = changeName(key);
  const text = changeText(key, from, to);
  return name && text ? `${name} ${text}` : "";
}
