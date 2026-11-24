// Member session on the server (Server Components, Server Actions and the login callback only).
// The session lives in cookies written by @supabase/ssr; proxy.ts refreshes it on the routes that need it.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { HINT_COOKIE, avatarLetter, isMemberClaims } from "./rules";

const HINT_MAX_AGE = 60 * 60 * 24 * 400;

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 가 설정되지 않았습니다.");
  return { url, key };
}

/** Supabase client bound to this request's session cookies. Queries run as the member (RLS applies). */
export async function sessionClient() {
  const { url, key } = env();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, which cannot write cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export type Member = { id: string; email: string | null };

/**
 * The signed-in member, or null. The token is verified (getClaims), and an account that was never marked as a
 * member of this site is treated as signed out. Cached per request.
 */
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || !isMemberClaims(claims)) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** Server Actions and Route Handlers only (they can write cookies). */
export async function setHintCookie(email: string | null | undefined) {
  const store = await cookies();
  store.set(HINT_COOKIE, avatarLetter(email), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: HINT_MAX_AGE,
  });
}

export async function clearHintCookie() {
  const store = await cookies();
  store.delete(HINT_COOKIE);
}
