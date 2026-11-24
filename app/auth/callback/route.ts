// Where Google sign-in comes back to (PKCE). A Route Handler because the code has to be traded for session
// cookies on a plain GET, which a page cannot do: the fourth HTTP route next to the Cron and the score upload.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { CALLBACK_PATH, MEMBER_APP, NEXT_COOKIE, safeNext } from "@/lib/auth/rules";
import { sessionClient, setHintCookie } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const next = safeNext(store.get(NEXT_COOKIE)?.value);
  // Same path as it was set with, or the browser keeps it.
  store.delete({ name: NEXT_COOKIE, path: CALLBACK_PATH });

  // No code = the member closed Google's screen or refused.
  const code = request.nextUrl.searchParams.get("code");
  if (!code) redirect("/login?error=cancel");

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) redirect("/login?error=failed");
  const user = data.user;

  // First sign-in: mark the account as a member of this site. app_metadata can only be written with the service
  // role key, never by the member, and the row policies ask for this mark. The token just issued does not carry
  // it yet, so the session is renewed once.
  if (user.app_metadata?.app !== MEMBER_APP) {
    const { error: markError } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, app: MEMBER_APP },
    });
    const renewed = markError ? null : await supabase.auth.refreshSession();
    if (markError || !renewed || renewed.error) {
      console.error("[auth] could not mark the new member:", markError?.code ?? renewed?.error?.code ?? "unknown");
      await supabase.auth.signOut({ scope: "local" });
      redirect("/login?error=failed");
    }
  }

  await setHintCookie(user.email);
  redirect(next);
}
