import type { Metadata } from "next";
import { MvpCalculator } from "@/components/mvp/mvp-calculator";

export const metadata: Metadata = { title: "MVP 계산기" };

export default function MvpPage() {
  return <MvpCalculator />;
}
