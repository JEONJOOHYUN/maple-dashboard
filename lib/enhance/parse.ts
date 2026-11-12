// NEXON Open API "확률 정보 조회" rows → the trimmed rows this page keeps (browser only, IndexedDB).
// Field names and values checked against real responses on 2026-11-12 (see .agents/project-spec.md §3-2).
import type { StarEvent } from "../ev/starforce.ts";

export type RawStarEvent = {
  success_rate?: string | null;
  destroy_decrease_rate?: string | null;
  cost_discount_rate?: string | null;
  plus_value?: string | null;
  starforce_event_range?: string | null;
  recovery_cost_discount_rate?: string | null;
};

export type RawStarforce = {
  id?: string;
  item_upgrade_result?: string;
  before_starforce_count?: number;
  after_starforce_count?: number;
  starforce_event_list?: RawStarEvent[] | null;
  starcatch_result?: string | null;
  superior_item_flag?: string | null;
  destroy_defence?: string | null;
  chance_time?: string | null;
  event_field_flag?: string | null;
  upgrade_item?: string | null;
  character_name?: string;
  world_name?: string;
  target_item?: string;
  date_create?: string;
};

export type SfResult = "success" | "fail" | "destroy";

/** One star force try. Short keys because thousands of these sit in IndexedDB. */
export type SfRow = {
  id: string;
  /** When, ms epoch. */
  t: number;
  r: SfResult;
  from: number;
  to: number;
  item: string;
  who: string;
  world: string;
  /** Star catch succeeded, as the record says. Empty since the mini game was removed (2026-03-19): see caught() in judge.ts. */
  sc: boolean;
  /** Destroy prevention paid for. */
  pr: boolean;
  /** Superior item (타일런트): different rules, not judged. */
  sup: boolean;
  /** Chance time (only before the 2025 revamp). */
  ct: boolean;
  /** Tried on an event map that blocks destroy. */
  map: boolean;
  /** Enhancement item used instead of meso (강화권 · 펄스 인핸서 …), "" = meso. */
  via: string;
  /** Which events were on, as the calculator's event name. */
  set: StarEvent;
  /** Events that apply to this try's star: cost discount %, destroy cut %, restore discount %, success rate % (100 = sure), extra stars. */
  sale: number;
  cut: number;
  rs: number;
  sr: number;
  plus: number;
};

/** "… 적용" is on; "… 미적용" · "… 미해당" · empty is off. */
const applied = (flag: unknown) => typeof flag === "string" && flag !== "" && !flag.includes("미적용") && !flag.includes("미해당");

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Event range: "0~29", "15,16,17" or empty (= every star). */
export function inRange(range: string | null | undefined, star: number): boolean {
  if (!range) return true;
  return range.split(",").some((part) => {
    const [a, b] = part.split("~").map((x) => Number(x.trim()));
    if (!Number.isFinite(a)) return false;
    return Number.isFinite(b) ? star >= a && star <= b : star === a;
  });
}

export function parseStarforce(raw: RawStarforce): SfRow | null {
  const t = Date.parse(raw.date_create ?? "");
  const from = raw.before_starforce_count;
  if (!raw.id || !Number.isFinite(t) || typeof from !== "number") return null;
  const events = Array.isArray(raw.starforce_event_list) ? raw.starforce_event_list : [];
  let anySale = false;
  let anyCut = false;
  let sale = 0;
  let cut = 0;
  let rs = 0;
  let sr = 0;
  let plus = 0;
  for (const e of events) {
    const here = inRange(e.starforce_event_range, from);
    if (num(e.cost_discount_rate) > 0) {
      anySale = true;
      if (here) sale = Math.max(sale, num(e.cost_discount_rate));
    }
    if (num(e.destroy_decrease_rate) > 0) {
      anyCut = true;
      if (here) cut = Math.max(cut, num(e.destroy_decrease_rate));
    }
    if (num(e.recovery_cost_discount_rate) > 0) rs = Math.max(rs, num(e.recovery_cost_discount_rate));
    if (here) {
      sr = Math.max(sr, num(e.success_rate));
      plus = Math.max(plus, num(e.plus_value));
    }
  }
  const result = raw.item_upgrade_result ?? "";
  return {
    id: raw.id,
    t,
    r: result === "성공" ? "success" : result === "파괴" ? "destroy" : "fail",
    from,
    to: typeof raw.after_starforce_count === "number" ? raw.after_starforce_count : from,
    item: raw.target_item ?? "",
    who: raw.character_name ?? "",
    world: raw.world_name ?? "",
    sc: raw.starcatch_result === "성공",
    pr: applied(raw.destroy_defence),
    sup: applied(raw.superior_item_flag),
    ct: applied(raw.chance_time),
    map: applied(raw.event_field_flag),
    via: raw.upgrade_item ?? "",
    set: anySale && anyCut ? "shining" : anySale ? "sale30" : anyCut ? "destroy30" : "none",
    sale,
    cut,
    rs,
    sr,
    plus,
  };
}
