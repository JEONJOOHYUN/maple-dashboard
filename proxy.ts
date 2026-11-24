import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { HINT_COOKIE, isMemberClaims } from "@/lib/auth/rules";

// Refreshes the member session cookies. Server Components cannot write cookies, so an expired token is renewed
// here before the page renders. Runs only on the member routes below: public tools stay static and untouched.
// Access itself is checked again in each page / action (lib/auth/server.ts getMember).
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });

  // Nothing between createServerClient and getClaims (Supabase SSR guide): this call is what renews the token.
  const { data } = await supabase.auth.getClaims();

  // The header shows a login hint from a readable cookie; drop it when the session is gone.
  if (!isMemberClaims(data?.claims) && request.cookies.has(HINT_COOKIE)) response.cookies.delete(HINT_COOKIE);
  return response;
}

export const config = {
  matcher: ["/login", "/me/:path*"],
};
