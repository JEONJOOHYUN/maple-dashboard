import type { Metadata } from "next";
import { RevenueApp } from "@/components/revenue/revenue-app";

export const metadata: Metadata = { title: "보스 수익" };

export default function RevenuePage() {
  return <RevenueApp />;
}
