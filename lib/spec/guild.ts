// 숨은 스펙업 · 길드 (user, 2026-11-19: "길드로도 검색되게" · "중요한 스킬들"). Server only.
// Guild name → the guild of that name in every world → each member's skill lines (checkSkills: the very lines the
// character view shows). Four calls a member (id · basic · 0th-job skills · hyper passives) through nexonGetBulk,
// which keeps a search to 250 a second; a member's lines are cached 3 hours like a character, so a guild looked at
// again costs nothing. Measured 2026-11-19: 1,078 members = 4,346 calls (the biggest guild seen), 366 = 1,468.
import "server-only";
import { unstable_cache } from "next/cache";
import { NexonError, nexonGet, nexonGetBulk, nexonOcid } from "@/lib/nexon/api";
import { SPEC_DATA, checkSkills, type SkillRaw } from "@/lib/spec/check";
import { cellOf, type Cell, type MemberRow } from "@/lib/spec/guild-table";
import { RULES_VERSION, SPEC_CACHE_SECONDS, specTag } from "@/lib/spec/load";

/** Every world the API takes (2026-11-19: guild/id refuses any other name with OPENAPI00004 — 핼리오스, not 헬리오스). */
export const WORLDS = ["스카니아", "베라", "루나", "제니스", "크로아", "유니온", "엘리시움", "이노시스", "레드", "오로라", "아케인", "노바", "에오스", "핼리오스", "챌린저스", "챌린저스2", "챌린저스3", "챌린저스4"];

const GUILD_CACHE_SECONDS = 30 * 60;
/** Members checked at the same time: few enough that members finish one after another (the bar moves steadily). */
const MEMBERS_AT_ONCE = 25;
/** Members per streamed piece of the result. */
export const CHUNK = 10;

export type GuildHit = { world: string; name: string; level: number; master: string; count: number; members: string[] };

type GuildBasic = {
  world_name?: string;
  guild_name?: string;
  guild_level?: number;
  guild_master_name?: string;
  guild_member_count?: number;
  guild_member?: string[];
};

/** The name in every world, together (18 calls) → the guilds found, most members first. Errors are thrown (not cached). */
async function lookUp(name: string): Promise<GuildHit[]> {
  const ids = await Promise.all(
    WORLDS.map(async (world) => ({ world, id: (await nexonGet<{ oguild_id: string | null }>("guild/id", { guild_name: name, world_name: world })).oguild_id })),
  );
  const found = ids.filter((x): x is { world: string; id: string } => !!x.id);
  const hits = await Promise.all(
    found.map(async ({ world, id }) => {
      const g = await nexonGet<GuildBasic>("guild/basic", { oguild_id: id });
      // Each name once: a name is a row (and its key) on the page.
      const members = [...new Set((g.guild_member ?? []).filter((m): m is string => typeof m === "string" && !!m))];
      return { world: g.world_name ?? world, name: g.guild_name ?? name, level: g.guild_level ?? 0, master: g.guild_master_name ?? "", count: members.length, members };
    }),
  );
  return hits.sort((a, b) => b.count - a.count || WORLDS.indexOf(a.world) - WORLDS.indexOf(b.world));
}

/** Guilds of this name (names are case-sensitive in the API), cached half an hour. */
export function findGuilds(name: string): Promise<GuildHit[]> {
  const key = name.trim();
  return unstable_cache(() => lookUp(key), ["spec-guild", key], { revalidate: GUILD_CACHE_SECONDS })();
}

// Bump when a member's row changes shape, so rows cached in the old shape are not served.
const ROW_VERSION = "3";

async function loadMember(name: string, eventSkills: string[]): Promise<MemberRow> {
  let ocid: string;
  try {
    ocid = await nexonOcid(name, nexonGetBulk);
  } catch (e) {
    if (e instanceof NexonError && e.kind === "notFound") return { ok: false, name, reason: "notFound" };
    throw e;
  }
  const q = { ocid };
  const [basic, skill0, hyperPassive] = await Promise.all([
    nexonGetBulk<SkillRaw["basic"] & { access_flag?: string }>("character/basic", q),
    nexonGetBulk<SkillRaw["skill0"]>("character/skill", { ...q, character_skill_grade: "0" }),
    nexonGetBulk<SkillRaw["hyperPassive"]>("character/skill", { ...q, character_skill_grade: "hyperpassive" }),
  ]);
  // Never logged in since the API began (2023-12): empty fields, like the character view's "not found".
  if (!basic?.character_class) return { ok: false, name, reason: "notFound" };
  const cells = checkSkills({ basic, skill0, hyperPassive }, SPEC_DATA, eventSkills)
    .map(cellOf)
    .filter((c): c is Cell => !!c);
  return {
    ok: true,
    name: basic.character_name || name,
    level: basic.character_level,
    cls: basic.character_class,
    known: Object.hasOwn(SPEC_DATA.classes, basic.character_class),
    // NEXON's flag: logged in within the last 7 days.
    recent: basic.access_flag === "true",
    cells,
  };
}

/** A member's row, cached 3 hours under the same tag as the character ("다시 조회" there drops this too). */
function memberRow(name: string, eventSkills: string[]): Promise<MemberRow> {
  const key = name.trim();
  return unstable_cache(() => loadMember(key, eventSkills), ["spec-guild-member", ROW_VERSION, RULES_VERSION, SPEC_DATA.updated, eventSkills.join("|"), key], {
    revalidate: SPEC_CACHE_SECONDS,
    tags: ["spec-check", specTag(key)],
  })();
}

/**
 * Every member checked, MEMBERS_AT_ONCE at a time in guild order, handed out as pieces of CHUNK members: the page
 * streams each piece as it is done. A member that fails (quota, network) comes back as failed; nothing throws.
 */
export function checkMembers(members: string[], eventSkills: string[]): Promise<MemberRow[]>[] {
  const results: Promise<MemberRow>[] = [];
  const starts: (() => void)[] = [];
  let running = 0;
  let next = 0;
  const startNext = () => {
    while (running < MEMBERS_AT_ONCE && next < starts.length) {
      running++;
      starts[next++]();
    }
  };
  for (const name of members) {
    results.push(
      new Promise<void>((go) => starts.push(go))
        .then(() => memberRow(name, eventSkills))
        .catch((): MemberRow => ({ ok: false, name, reason: "failed" }))
        .finally(() => {
          running--;
          startNext();
        }),
    );
  }
  startNext();
  const pieces: Promise<MemberRow[]>[] = [];
  for (let i = 0; i < results.length; i += CHUNK) pieces.push(Promise.all(results.slice(i, i + CHUNK)));
  return pieces;
}
