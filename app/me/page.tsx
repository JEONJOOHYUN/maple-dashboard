import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { DotLine } from "@/components/auth/dot-line";
import { KeyPanel, LeaveLink, type NexonAccount } from "@/components/auth/key-panel";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { KeyGuide } from "@/components/enhance/key-guide";
import { PageHeader } from "@/components/page-header";
import { avatarLetter, unpackLabel } from "@/lib/auth/rules";
import { getMember, sessionClient } from "@/lib/auth/server";
import { kstDate } from "@/lib/enhance/kst";

export const metadata: Metadata = { title: "내 정보" };

export default async function MePage() {
  const member = await getMember();
  if (!member) redirect("/login?next=/me");

  // Read as the member: the row policy gives only their own accounts, and the grant only the columns of the list
  // (never the sealed key). The day the account was made is not in the token: one call to the auth server.
  const supabase = await sessionClient();
  const [{ data: who }, { data: rows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("nexon_accounts").select("id, label, created_at").order("created_at"),
  ]);
  const joined = who.user?.created_at ? kstDate(Date.parse(who.user.created_at)) : "";
  const accounts: NexonAccount[] = (rows ?? []).map((r) => ({ id: r.id, ...unpackLabel(r.label), added: kstDate(Date.parse(r.created_at)) }));

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="내 정보" />
      <div className="grid items-start gap-2 lg:grid-cols-2">
        {/* min-w-0: a grid column is never narrower than its longest word, and an email address is one word. */}
        <div className="flex min-w-0 flex-col gap-2">
          <section className="flex items-center gap-3.5 tile px-5 py-5 lg:px-7" data-clarity-mask="true">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[17px] font-bold text-primary-text">
              {avatarLetter(member.email)}
            </span>
            <div className="flex min-w-0 flex-col">
              <b className="truncate text-[15px]">{member.email}</b>
              <DotLine className="text-xs text-muted-foreground" parts={["Google 로그인", joined && `${joined} 가입`]} />
            </div>
            <form action={signOut} className="ml-auto flex">
              <SignOutButton />
            </form>
          </section>

          <KeyPanel accounts={accounts} />
          <LeaveLink />
        </div>

        <KeyGuide have="새로 안 받아도 됨 · 강화 기록 · 보스 수익에 넣은 키 그대로" />
      </div>
    </div>
  );
}
