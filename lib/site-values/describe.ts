// A changed value as one line of words, for the admin page's "n개 바뀜" bar and its history: the same words in both.
import { koreanUnits } from "../format.ts";
import { cellOf, typedOf, type Cell } from "./cells.ts";
import { extraName, type Extra } from "./values.ts";

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

/** The name a change goes by ("림보 익스트림", "프라임 큐브 경매장"), or null for a key the code no longer has. */
export function changeName(key: string): string | null {
  const cell = cellOf(key);
  if (cell) return cell.name + (cell.group === "mvp" || cell.group === "credit" ? (KIND[key.slice(key.lastIndexOf("|") + 1)] ?? "") : "");
  return extraName(key);
}

/** "1,400 → 1,350원" · "75억 → 78억" · "새로 넣음 · 20억" · "뺌". Empty for a key the code no longer has. */
export function changeText(key: string, from: unknown, to: unknown): string {
  const cell = cellOf(key);
  if (cell) {
    if (typeof from !== "number" || typeof to !== "number") return "";
    const meso = cell.group === "crystal" || cell.group === "reward";
    return `${amount(cell, from)} → ${amount(cell, to)}${meso ? "" : cell.unit}`;
  }
  if (extraName(key) === null) return "";
  const a = from as Extra | null;
  const b = to as Extra | null;
  if (!b) return "뺌";
  if (!a) return `새로 넣음 · ${num(b.spareEok)}억`;
  return `${num(a.spareEok)} → ${num(b.spareEok)}억`;
}

/** Both together: "림보 익스트림 75억 → 78억". */
export function describeChange(key: string, from: unknown, to: unknown): string {
  const name = changeName(key);
  const text = changeText(key, from, to);
  return name && text ? `${name} ${text}` : "";
}
