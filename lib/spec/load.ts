// Server only: nickname → NEXON Open API responses (13 calls, fired together) → checkSpec result,
// cached 3 hours per nickname so the same character is not fetched again.
import { unstable_cache } from "next/cache";
import { NexonError, nexonGet, nexonOcid } from "@/lib/nexon/api";
import { SPEC_DATA, checkSpec, type SpecRaw, type SpecResult } from "@/lib/spec/check";
import { eventSkillNames, type EventNotice } from "@/lib/spec/event-skill";

export const SPEC_CACHE_SECONDS = 3 * 60 * 60;
// Bump when check.ts rules change so cached results from older rules are not served.
const RULES_VERSION = "10";

type Loaded = { ok: true; result: SpecResult; at: number } | { ok: false; kind: "notFound" };

async function load(name: string, eventSkills: string[]): Promise<Loaded> {
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
  // Fired together: with the service-stage key nothing spaces them (a development-stage key falls back to 220 ms
  // between starts, see lib/nexon/api.ts).
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
  return { ok: true, result: checkSpec(raw, new Date(), SPEC_DATA, eventSkills), at: Date.now() };
}

/** The event notices, an hour at a time (a failure is thrown, so it is not cached). */
const eventNotices = unstable_cache(
  async () => (await nexonGet<{ event_notice?: EventNotice[] }>("notice-event", {})).event_notice ?? [],
  ["spec-event-notices"],
  { revalidate: 60 * 60 }
);

/** Errors (quota, network) are thrown, so they are not cached; "not found" is cached like a result. */
export async function getSpec(name: string): Promise<Loaded> {
  const key = name.trim();
  // Without the notices the event skill is simply not asked for: the rest of the check does not wait on them.
  const eventSkills = eventSkillNames(await eventNotices().catch(() => []), Date.now());
  return unstable_cache(() => load(key, eventSkills), ["spec-check", RULES_VERSION, SPEC_DATA.updated, eventSkills.join("|"), key], {
    revalidate: SPEC_CACHE_SECONDS,
    tags: ["spec-check"],
  })();
}
