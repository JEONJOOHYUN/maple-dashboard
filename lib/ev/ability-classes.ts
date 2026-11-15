// Per-class ability builds for the calculator's 직업별 추천 table: the same data file as the spec check
// (lib/spec/data/classes.json `ability`): full[0] = the user's all-legendary table (고급 재설정), practical = legendary
// line 1 + unique lines 2 · 3 from ranker data (일반 재설정), collector = the user's * mark.
// Server only (the /ev page): the page passes these 48 short rows down, so the browser never loads the ~50 KB class file.
import classesJson from "../spec/data/classes.json" with { type: "json" };

export type ClassAbility = {
  name: string;
  /** 고급 재설정: three legendary lines, letters as in the data file (lib/ev/ability.ts BUILD_LETTERS). */
  full: string;
  /** 일반 재설정: the legendary line first, then the two unique lines. */
  practical: string;
  /** Stronger than the alternatives only when a collector is used (user's table *). */
  collector: boolean;
};

type Rule = { ability: { full: string[]; practical: string; collector?: boolean } };

export function classAbilities(): ClassAbility[] {
  const { classes } = classesJson as unknown as { classes: Record<string, Rule> };
  return Object.entries(classes)
    .map(([name, r]) => ({ name, full: r.ability.full[0], practical: r.ability.practical, collector: r.ability.collector === true }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
