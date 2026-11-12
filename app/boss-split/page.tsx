import type { Metadata } from "next";
import { BossSplitCalculator } from "@/components/boss-split/boss-split-calculator";

export const metadata: Metadata = { title: "분배금 계산기" };

export default function BossSplitPage() {
  return <BossSplitCalculator />;
}
