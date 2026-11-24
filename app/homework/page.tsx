import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Board, Waiting } from "@/components/homework/board";
import { getMember } from "@/lib/auth/server";
import { memberBoard, pickedHere } from "@/lib/homework/server";

export const metadata: Metadata = { title: "숙제 현황" };

/** NEXON is asked for each character on show, a few a second: the page shows at once and this part follows. */
async function Loaded({ memberId }: { memberId: string }) {
  return <Board data={await memberBoard(memberId, await pickedHere())} />;
}

export default async function HomeworkPage() {
  const member = await getMember();
  if (!member) redirect("/login?next=/homework");
  return (
    <Suspense fallback={<Waiting />}>
      <Loaded memberId={member.id} />
    </Suspense>
  );
}
