// Server only: nickname → NEXON Open API responses (15 calls, fired together) → checkSpec result,
// cached 3 hours per nickname so the same character is not fetched again.
import { unstable_cache } from "next/cache";
import { NexonError, liveOrYesterday, nexonGet, nexonOcid } from "@/lib/nexon/api";
import { SPEC_DATA, checkSpec, type SpecRaw, type SpecResult } from "@/lib/spec/check";
import { eventSkillNames, type EventNotice } from "@/lib/spec/event-skill";

export const SPEC_CACHE_SECONDS = 3 * 60 * 60;
// A result made from a past day's data (NEXON under maintenance) is kept only this long, and only looked at when live
// data is refused: the moment maintenance ends the live result takes over.
export const DATED_CACHE_SECONDS = 30 * 60;
// Bump when check.ts rules change so cached results from older rules are not served (the guild view's too).
export const RULES_VERSION = "17";

/** One tag per nickname, so "다시 조회" drops only that character's saved result. */
export const specTag = (name: string) => `spec-check:${name.trim()}`;

/** asOf = the day (KST, "2026-11-19") the data is of, when it is not live. */
type Loaded = { ok: true; result: SpecResult; at: number; asOf?: string } | { ok: false; kind: "notFound" };

/** With a date: that day's data instead of live (the name → ocid lookup has no date and is asked as usual). */
async function load(name: string, eventSkills: string[], date?: string): Promise<Loaded> {
  let ocid: string;
  try {
    ocid = await nexonOcid(name);
  } catch (e) {
    if (e instanceof NexonError && e.kind === "notFound") return { ok: false, kind: "notFound" };
    throw e;
  }
  const q: Record<string, string> = date ? { ocid, date } : { ocid };
  const get = <K extends keyof SpecRaw>(path: string, extra: Record<string, string> = {}) =>
    nexonGet<SpecRaw[K]>(path, { ...q, ...extra });
  // Fired together: with the service-stage key nothing spaces them (a development-stage key falls back to 220 ms
  // between starts, see lib/nexon/api.ts).
  const [basic, skill0, hyperPassive, vmatrix, propensity, artifact, equipment, hyper, link, ability, pet, symbol, cash, otherStat] = await Promise.all([
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
    // Periods and 마스터라벨 플러스 only: when these two fail the rest of the check still stands (their checks are skipped).
    get<"cash">("character/cashitem-equipment").catch(() => undefined),
    get<"otherStat">("character/other-stat").catch(() => undefined),
  ]);
  const raw: SpecRaw = { basic, skill0, hyperPassive, vmatrix, propensity, artifact, equipment, hyper, link, ability, pet, symbol, cash, otherStat };
  // A character that never logged in after the API started (2023-12) comes back with empty fields.
  if (!raw.basic?.character_class) return { ok: false, kind: "notFound" };
  return { ok: true, result: checkSpec(raw, new Date(), SPEC_DATA, eventSkills), at: Date.now(), ...(date ? { asOf: date } : {}) };
}

/** The event notices, an hour at a time (a failure is thrown, so it is not cached). */
const eventNotices = unstable_cache(
  async () => (await nexonGet<{ event_notice?: EventNotice[] }>("notice-event", {})).event_notice ?? [],
  ["spec-event-notices"],
  { revalidate: 60 * 60 }
);

/** The running event's skills ("보약"). Without the notices the event skill is simply not asked for. */
export async function currentEventSkills(): Promise<string[]> {
  return eventSkillNames(await eventNotices().catch(() => []), Date.now());
}

/**
 * Errors (quota, network) are thrown, so they are not cached; "not found" is cached like a result.
 * While NEXON is under maintenance the result comes from yesterday's data (user, 2026-11-20), marked with `asOf`.
 */
export async function getSpec(name: string): Promise<Loaded> {
  const key = name.trim();
  const eventSkills = await currentEventSkills();
  const tags = ["spec-check", specTag(key)];
  const live = unstable_cache(() => load(key, eventSkills), ["spec-check", RULES_VERSION, SPEC_DATA.updated, eventSkills.join("|"), key], {
    revalidate: SPEC_CACHE_SECONDS,
    tags,
  });
  const dated = (date: string) =>
    unstable_cache(() => load(key, eventSkills, date), ["spec-check-dated", RULES_VERSION, SPEC_DATA.updated, eventSkills.join("|"), key, date], {
      revalidate: DATED_CACHE_SECONDS,
      tags,
    })();
  return liveOrYesterday(live, dated);
}
