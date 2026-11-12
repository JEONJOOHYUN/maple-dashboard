import type { Metadata } from "next";
import { EnhanceApp } from "@/components/enhance/enhance-app";

export const metadata: Metadata = { title: "강화 기록" };

export default function EnhancePage() {
  return <EnhanceApp />;
}
