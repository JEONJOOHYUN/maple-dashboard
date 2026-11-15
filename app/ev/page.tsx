import type { Metadata } from "next";
import { EvCalculator } from "@/components/ev/ev-calculator";
import { classAbilities } from "@/lib/ev/ability-classes";

export const metadata: Metadata = { title: "기댓값 계산기" };

export default function EvPage() {
  // Built here on the server so the browser gets 48 short rows, not the whole class data file.
  return <EvCalculator abilityClasses={classAbilities()} />;
}
