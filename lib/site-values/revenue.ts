// What the boss revenue page reads from the site values: crystal prices and the default price of every reward.
// Kept apart from values.ts so the calculators do not carry the boss tables (see the note at the top of values.ts).
import { CRYSTAL, ITEMS, SPARE_LINK, type ItemId } from "../revenue/data.ts";
import { has, numberOr, once, starItems } from "./values.ts";

/** Crystal sale prices (meso) by "boss|difficulty". */
export const crystalTable = once((values): Record<string, number> => {
  if (!has(values, "crystal|")) return CRYSTAL;
  const out: Record<string, number> = {};
  for (const [key, meso] of Object.entries(CRYSTAL)) out[key] = numberOr(values, `crystal|${key}`, meso);
  return out;
});

/** Default price of every boss reward, 만 메소: a linked one follows its star force item. */
export const rewardPrices = once((values): Record<ItemId, number> => {
  const spare = new Map(starItems(values).flatMap((g) => g.items.map((it) => [it.id, it.spareEok] as const)));
  const out = {} as Record<ItemId, number>;
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    const link = (SPARE_LINK as Partial<Record<ItemId, string>>)[id];
    out[id] = link ? Math.round((spare.get(link) ?? 0) * 10_000) : numberOr(values, `reward|${id}`, ITEMS[id].price);
  }
  return out;
});
