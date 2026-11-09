import type { Metadata } from "next";
import { PinballGame } from "@/components/pinball/pinball-game";

export const metadata: Metadata = { title: "핀볼 추첨" };

export default function PinballPage() {
  return <PinballGame />;
}
