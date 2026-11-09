import type { Metadata } from "next";
import { EvCalculator } from "@/components/ev/ev-calculator";

export const metadata: Metadata = { title: "기댓값 계산기" };

export default function EvPage() {
  return <EvCalculator />;
}
