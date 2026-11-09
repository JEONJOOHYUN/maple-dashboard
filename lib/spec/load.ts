// Server only: nickname → NEXON Open API responses (13 calls, starts 220 ms apart) → checkSpec result,
// cached 3 hours per nickname so the same character does not spend the 1,000 calls/day dev key again.
import { unstable_cache } from "next/cache";
import { NexonError, nexonGet, nexonOcid } from "@/lib/nexon/api";
import { SPEC_DATA, checkSpec, type SpecRaw, type SpecResult } from "@/lib/spec/check";

export const SPEC_CACHE_SECONDS = 3 * 60 * 60;
// Bump when check.ts rules change so cached results from older rules are not served.
const RULES_VERSION = "8";

type Loaded = { ok: true; result: SpecResult; at: number } | { ok: false; kind: "notFound" };

async function load(name: string): Promise<Loaded> {
  let ocid: string;
  try {
    ocid = await nexonOcid(name);
  } catch (e) {
    if (e instanceof NexonError && e.kind === "notFound") return { ok: false, kind: "notFound" };
    throw e;
  }
  const q = { ocid };
  const get = <K extends keyof SpecRaw>(path: string, extra: Record<string, string> = {}) =>
    nexonGet<SpecRaw[K]>(path, { ...q, ...extra });
  // Fired together: nexonGet still spaces the request starts 220 ms apart (5/s), but no call waits for the previous
  // response, so 12 calls take under 3 s instead of about 5 s one after another (2026-11-09 measured 5.3 s).
  const [basic, skill0, hyperPassive, vmatrix, propensity, artifact, equipment, hyper, link, ability, pet, symbol] = await Promise.all([
    get<"basic">("character/basic"),
    get<"skill0">("character/skill", { character_skill_grade: "0" }),
    get<"hyperPassive">("character/skill", { character_skill_grade: "hyperpassive" }),
    get<"vmatrix">("character/vmatrix"),
    get<"propensity">("character/propensity"),
    get<"artifact">("user/union-artifact"),
    get<"equipment">("character/item-equipment"),
    get<"hyper">("character/hyper-stat"),
    get<"link">("character/link-skill"),
    get<"ability">("character/ability"),
    get<"pet">("character/pet-equipment"),
    get<"symbol">("character/symbol-equipment"),
  ]);
  const raw: SpecRaw = { basic, skill0, hyperPassive, vmatrix, propensity, artifact, equipment, hyper, link, ability, pet, symbol };
  // A character that never logged in after the API started (2023-12) comes back with empty fields.
  if (!raw.basic?.character_class) return { ok: false, kind: "notFound" };
  return { ok: true, result: checkSpec(raw), at: Date.now() };
}

/** Errors (quota, network) are thrown, so they are not cached; "not found" is cached like a result. */
export function getSpec(name: string): Promise<Loaded> {
  const key = name.trim();
  return unstable_cache(() => load(key), ["spec-check", RULES_VERSION, SPEC_DATA.updated, key], {
    revalidate: SPEC_CACHE_SECONDS,
    tags: ["spec-check"],
  })();
}
