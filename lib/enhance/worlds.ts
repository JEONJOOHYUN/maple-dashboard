// Worlds in three groups, so seasonal and event characters can be left out of the numbers (user, 2026-11-12):
// regular worlds · 챌린저스 and 버닝 (seasonal worlds whose characters move to a regular world when the season ends)
// · event worlds (anything else, e.g. "스페셜").
//
// Star force tries carry the world they were made in. Potential rolls do not (checked against real responses,
// 2026-11-12), so a roll's world is worked out from the character: its star force tries, and where it is now.

export type WorldGroup = "regular" | "challengers" | "event";
export const WORLD_GROUPS: WorldGroup[] = ["regular", "challengers", "event"];
export const GROUP_LABEL: Record<WorldGroup, string> = { regular: "일반", challengers: "챌린저스 · 버닝", event: "이벤트" };

/** The regular worlds (에오스 · 헬리오스 = the former 리부트 worlds). A name that is not here and not seasonal is an event world. */
const REGULAR = new Set(["스카니아", "베라", "루나", "제니스", "크로아", "유니온", "엘리시움", "이노시스", "레드", "오로라", "아케인", "노바", "에오스", "헬리오스"]);

/** An unknown world ("") counts as regular: nothing says the character is a seasonal or event one. */
export function worldGroup(world: string): WorldGroup {
  if (/^(챌린저스|버닝)/.test(world)) return "challengers";
  return world === "" || REGULAR.has(world) ? "regular" : "event";
}

export type GroupTally = { id: WorldGroup; n: number; spent: number };

/** Count and meso per group, in the fixed order, only the groups that have something. */
export function groupTallies(items: { world: string; spent: number }[]): GroupTally[] {
  const by = new Map<WorldGroup, GroupTally>();
  for (const it of items) {
    const id = worldGroup(it.world);
    let tally = by.get(id);
    if (!tally) by.set(id, (tally = { id, n: 0, spent: 0 }));
    tally.n++;
    tally.spent += it.spent;
  }
  return WORLD_GROUPS.flatMap((id) => by.get(id) ?? []);
}

/** A stretch of one character's star force tries in one world. */
export type WorldRun = { from: number; to: number; world: string };

/** Each character's tries as runs of one world, oldest first. */
export function worldRuns(tries: { t: number; who: string; world: string }[]): Map<string, WorldRun[]> {
  const out = new Map<string, WorldRun[]>();
  for (const row of [...tries].sort((a, b) => a.t - b.t)) {
    if (!row.who || !row.world) continue;
    let runs = out.get(row.who);
    if (!runs) out.set(row.who, (runs = []));
    const last = runs[runs.length - 1];
    if (last && last.world === row.world) last.to = row.t;
    else runs.push({ from: row.t, to: row.t, world: row.world });
  }
  return out;
}

/**
 * The world a character was in at `t`: the run of tries that holds `t`, else the next run after it, else (after
 * its last try) where the character is now, else the world of its last try. `now` = character → world today.
 * A character only ever moves one way, from a seasonal world to a regular one, and people enhance up to the end
 * of a season, so between two runs the later world is the better guess. It is still a guess: a roll made after
 * the last seasonal try but before the move is counted in the world the character went to.
 */
export function worldAt(runs: Map<string, WorldRun[]>, now: Record<string, string>, who: string, t: number): string {
  const list = runs.get(who) ?? [];
  const here = list.find((run) => run.to >= t);
  if (here) return here.world;
  const today = Object.hasOwn(now, who) ? now[who] : "";
  return today || list[list.length - 1]?.world || "";
}
