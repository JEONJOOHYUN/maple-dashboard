// The characters a member picked for the homework page, kept in a cookie of this browser (as boss revenue keeps its
// picks in the browser). Pure: parsing and packing only.

export const PICK_COOKIE = "maple_hw_pick";
/** NEXON's character ids are 32 or 64 hex characters. */
const OCID = /^[0-9a-f]{32,64}$/;

/** The picked ids out of a cookie value (or out of what a form sent): well-formed ones, each once, at most `max`. */
export function cleanPick(value: unknown, max: number): string[] {
  const parts = typeof value === "string" ? value.split(".") : Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const p of parts) {
    if (typeof p !== "string" || !OCID.test(p) || out.includes(p)) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export const packPick = (ocids: string[]): string => ocids.join(".");

/**
 * What the picker opens with. The member's own pick, as the server reads it at that moment, always stands: what the
 * page showed before may be older (a list that failed then and came back now) and must not replace it. Only
 * without a pick of the member's own does the picker start from the characters on show.
 */
export function startingPick(found: { picking: boolean; picked: string[] }, shown: string[]): string[] {
  return found.picking ? found.picked : shown;
}
