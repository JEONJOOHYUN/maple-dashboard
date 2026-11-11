// Symbols whose growth is already enough for more levels but the meso was not paid ("체납", like maplescouter's tax page):
// level reachable with the current growth, meso to get there, stat / force gained.
// Growth needed per level (matches the source tables): arcane Lv² + 11, authentic / grand authentic 9·Lv² + 20·Lv.
// Costs: data/symbols.json (per-level upgrade meso, in-game values as of 2026-10-25; totals checked against the source page).
// Stats (checked on API responses 2026-11-09): arcane main stat = 100 × (Lv + 2), force 10 × (Lv + 2);
// authentic main stat = 200 × Lv + 300, force 10 × Lv; Demon Avenger HP = 21 × main stat. Grand authentic stats unverified → cost only.
import { koreanUnits } from "../format.ts";
import symbolsJson from "./data/symbols.json" with { type: "json" };

type Costs = Record<string, number[]>;
const DATA = symbolsJson as unknown as { arcane: Costs; authentic: Costs; grand: Costs };

export type SymbolIn = {
  symbol_name: string;
  symbol_level: number;
  symbol_growth_count?: number;
  symbol_str?: string;
  symbol_dex?: string;
  symbol_int?: string;
  symbol_luk?: string;
  symbol_hp?: string;
};

export type SymbolGap = {
  region: string;
  kind: "arcane" | "authentic" | "grand";
  level: number;
  /** Level reachable with the growth already collected. */
  to: number;
  max: number;
  /** null when the region is not in the cost table. */
  meso: number | null;
  /** e.g. [["LUK", 400]]; empty when the stat formula is unknown (grand authentic). */
  stats: [string, number][];
  force: number;
  forceName: string;
};

const KIND = [
  { kind: "grand", re: /^그랜드 어센틱심볼 : (.+)$/, max: 11, force: "어센틱포스" },
  { kind: "authentic", re: /^어센틱심볼 : (.+)$/, max: 11, force: "어센틱포스" },
  { kind: "arcane", re: /^아케인심볼 : (.+)$/, max: 20, force: "아케인포스" },
] as const;

const needAt = (kind: SymbolGap["kind"], lv: number) => (kind === "arcane" ? lv * lv + 11 : 9 * lv * lv + 20 * lv);
const statAt = (kind: SymbolGap["kind"], lv: number) => (kind === "arcane" ? 100 * (lv + 2) : 200 * lv + 300);
const forceAt = (kind: SymbolGap["kind"], lv: number) => (kind === "arcane" ? 10 * (lv + 2) : 10 * lv);

export function symbolGaps(symbols: SymbolIn[]): SymbolGap[] {
  const out: SymbolGap[] = [];
  for (const s of symbols) {
    const k = KIND.find((x) => x.re.test(s.symbol_name));
    if (!k || s.symbol_level >= k.max || s.symbol_level < 1) continue;
    let to = s.symbol_level;
    let growth = s.symbol_growth_count ?? 0;
    while (to < k.max && growth >= needAt(k.kind, to)) {
      growth -= needAt(k.kind, to);
      to++;
    }
    if (to === s.symbol_level) continue;
    const region = s.symbol_name.match(k.re)![1].trim();
    const table = DATA[k.kind][region];
    const meso = table ? table.slice(s.symbol_level - 1, to - 1).reduce((a, b) => a + b, 0) : null;
    const stats: [string, number][] = [];
    if (k.kind !== "grand") {
      // Scale whatever stat the API shows (one main stat, three for Xenon, HP for Demon Avenger) by the level formula.
      const ratio = statAt(k.kind, to) / statAt(k.kind, s.symbol_level) - 1;
      for (const [label, v] of [["STR", s.symbol_str], ["DEX", s.symbol_dex], ["INT", s.symbol_int], ["LUK", s.symbol_luk], ["HP", s.symbol_hp]] as const) {
        const n = Number(v ?? 0);
        if (n > 0) stats.push([label, Math.round(n * ratio)]);
      }
    }
    out.push({
      region,
      kind: k.kind,
      level: s.symbol_level,
      to,
      max: k.max,
      meso,
      stats,
      force: forceAt(k.kind, to) - forceAt(k.kind, s.symbol_level),
      forceName: k.force,
    });
  }
  return out;
}

/** 7,920,000,000 → "79억 2,000만", 670,000 → "67만". */
export function koreanMeso(n: number): string {
  // From 1조 the unit changes again ("1조 2,345억").
  if (n >= 9999.5e8) return koreanUnits(n);
  const eok = Math.floor(n / 1e8);
  const man = Math.round((n % 1e8) / 1e4);
  if (eok && man) return `${eok.toLocaleString("ko-KR")}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok) return `${eok.toLocaleString("ko-KR")}억`;
  return `${man.toLocaleString("ko-KR")}만`;
}
