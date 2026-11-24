"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CALLBACK_PATH, NEXT_COOKIE, safeNext } from "@/lib/auth/rules";
import { clearHintCookie, sessionClient } from "@/lib/auth/server";

/** The address this request came in on. Supabase only sends the member back to addresses on its allow list. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/** Starts the round trip to Google. The form may carry `next`: the page to come back to. */
export async function signInWithGoogle(form: FormData) {
  const store = await cookies();
  // Remembered in a cookie, not in the callback address: the allow list can then hold that address exactly.
  store.set(NEXT_COOKIE, safeNext(form.get("next")), {
    path: CALLBACK_PATH,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
  });

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}${CALLBACK_PATH}` },
  });
  if (error || !data.url) redirect("/login?error=start");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await sessionClient();
  // "local": this browser only. Other devices of the same member stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  await clearHintCookie();
  redirect("/");
}
