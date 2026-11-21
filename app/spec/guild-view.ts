// 숨은 스펙업 · 길드: the address (?guild= &world=) → what the guild tab shows. Server only.
import "server-only";
import type { GuildInfo, GuildView } from "@/components/spec/guild-check";
import { NexonError } from "@/lib/nexon/api";
import { allowAttempt, clientIp } from "@/lib/rate-limit";
import { checkMembers, findGuilds, type GuildHit } from "@/lib/spec/guild";
import { MAX_GUILD_NAME } from "@/lib/spec/guild-table";
import { currentEventSkills } from "@/lib/spec/load";

// A visitor's guild searches (a world list or a guild, cached or not), counted per address.
const SEARCHES_PER_HOUR = 30;
// The whole site's guild checks a day, in NEXON calls (7 a member, counted even when the members come from the
// cache): half of what NEXON allows our key a day (20,000,000, official guide 2026-11-20), so a run of guild
// searches can never take the 개인 tab and the other tools down with it.
const CALLS_PER_MEMBER = 7;
const GUILD_CALLS_PER_DAY = 10_000_000;

/** What the page gets of a guild: everything but the member list (sent as checked rows instead). */
const info = (h: GuildHit): GuildInfo => ({ world: h.world, name: h.name, level: h.level, master: h.master, count: h.count, users: h.users, asOf: h.asOf });

export async function guildView(name: string, world: string): Promise<GuildView> {
  if (!name) return { kind: "empty" };
  if (name.length > MAX_GUILD_NAME || /\s/.test(name)) return { kind: "notFound", name };
  if (!(await allowAttempt([{ name: "spec:guild", value: await clientIp(), max: SEARCHES_PER_HOUR, windowSeconds: 3600 }]))) {
    return { kind: "limit", name };
  }
  try {
    const hits = await findGuilds(name);
    const hit = world ? hits.find((h) => h.world === world) : hits.length === 1 ? hits[0] : undefined;
    if (!hits.length || (world && !hit)) return { kind: "notFound", name };
    if (!hit) return { kind: "pick", name, guilds: hits.map(info) };
    const budget = { name: "spec:guild-calls", value: "all", max: GUILD_CALLS_PER_DAY, windowSeconds: 24 * 3600, add: hit.members.length * CALLS_PER_MEMBER };
    if (!(await allowAttempt([budget]))) return { kind: "busy", name };
    const eventSkills = await currentEventSkills();
    return {
      kind: "guild",
      guild: info(hit),
      pieces: checkMembers(hit.members, eventSkills),
      others: hits.length - 1,
    };
  } catch (e) {
    if (e instanceof NexonError && e.kind === "quota") return { kind: "quota", name };
    if (e instanceof NexonError && e.kind === "maintenance") return { kind: "maintenance", name };
    console.error("spec-guild failed", e);
    return { kind: "failed", name };
  }
}
