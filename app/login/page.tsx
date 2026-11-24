import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { NavIcon } from "@/components/nav-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { safeNext } from "@/lib/auth/rules";
import { getMember } from "@/lib/auth/server";
import { allNavItems } from "@/lib/nav";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "로그인" };

/** What the callback and the action send back (app/auth/callback/route.ts, ./actions.ts). */
const ERRORS: Record<string, string> = {
  cancel: "로그인 취소됨",
  failed: "로그인 실패 → 다시 시도",
  start: "구글 연결 실패 → 잠시 뒤 다시",
};

/** The member tools, in the menu's order and words (lib/nav.ts). */
const PERKS = [
  { slug: "income", title: "내 수익", line: "캡처 한 장으로 오늘 · 주간 · 월간 사냥 수익" },
  { slug: "homework", title: "숙제 현황", line: "스케줄러로 남은 숙제를 자동으로" },
  { slug: "alerts", title: "알림 설정", line: "보스 · 숙제를 원하는 시각에" },
];

/** The ones that are open, as the menu knows them: the badge goes when a tool does. */
const READY = new Set(allNavItems.filter((item) => item.ready).map((item) => item.slug));

type Props = { searchParams: Promise<{ error?: string | string[]; next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  // Without a page to go back to, a new member lands on 내 정보 (where the API key goes).
  const back = typeof next === "string" ? safeNext(next) : "/me";
  if (await getMember()) redirect(back);
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="로그인" />
      <div className="grid items-start gap-2 lg:grid-cols-2">
        <section className="flex flex-col gap-4 tile p-5 lg:p-7">
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-bold">구글 계정으로 시작</h2>
            <p className="text-[13px] text-muted-foreground">가입 절차 없음 · 처음 로그인하면 계정이 만들어짐</p>
          </div>
          <form action={signInWithGoogle} className="flex flex-col">
            <input type="hidden" name="next" value={back} />
            <GoogleButton />
          </form>
          {message && (
            <p role="alert" className="text-[13px] font-semibold text-destructive">
              {message}
            </p>
          )}
          <ul className="flex list-disc flex-col gap-1 pl-[18px] text-xs leading-relaxed text-muted-foreground">
            <li>구글에서 받는 것 = 이메일 · 이름 · 프로필 사진</li>
            <li>
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                개인정보처리방침
              </Link>
            </li>
          </ul>
        </section>

        {/* The corners and the edge of the tile next to it; the fill stays the quieter one (as on the key screens). */}
        <section className="flex flex-col gap-3.5 rounded-[1rem] tile-edge bg-muted p-5 lg:p-7">
          <h2 className="text-base font-bold">로그인하면</h2>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] tile-edge bg-card text-primary-text">
              <KeyRound className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col">
              <b className="text-sm">API 키 보관</b>
              <span className="text-[13px] text-muted-foreground">기기를 바꿔도 키를 다시 안 넣음</span>
            </div>
          </div>
          {PERKS.map((p) => (
            <div key={p.slug} className="flex items-center gap-3">
              <NavIcon slug={p.slug} className="size-9" />
              <div className="flex min-w-0 flex-col">
                <b className="text-sm">{p.title}</b>
                {/* Balanced: on a phone the longest line breaks in two, not into a line and one last word. */}
                <span className="text-[13px] text-balance text-muted-foreground">{p.line}</span>
              </div>
              {!READY.has(p.slug) && (
                <Badge variant="outline" className="ml-auto h-[18px] px-1.5 text-[10px] font-medium text-muted-foreground">
                  준비 중
                </Badge>
              )}
            </div>
          ))}
          <p className="border-t border-border pt-3.5 text-xs text-muted-foreground">보스 수익 · 강화 기록 = 로그인 없이 지금처럼</p>
        </section>
      </div>
    </div>
  );
}
