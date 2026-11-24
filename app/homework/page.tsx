import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Board } from "@/components/homework/board";
import { getMember } from "@/lib/auth/server";
import { memberBoard, pickedHere } from "@/lib/homework/server";

export const metadata: Metadata = { title: "숙제 현황" };

/**
 * NEXON is asked for each character on show, a few a second: ./loading.tsx shows meanwhile. That is the only
 * boundary on purpose: React keeps a fallback up for 300ms once it is shown, so a second one inside the page made
 * an answer that was already here (it is kept for five minutes) wait that long again.
 */
export default async function HomeworkPage() {
  const member = await getMember();
  if (!member) redirect("/login?next=/homework");
  return <Board data={await memberBoard(member.id, await pickedHere())} />;
}
