// Who may change the site values (public.site_admins, migration 014): a signed-in member with a row there.
// The table has no policy, so it is read with the service role key and the query names the member.
import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMember, type Member } from "./server";

export type Admin = Member & { role: "owner" | "editor"; /** The name the change history shows. */ name: string };

/** The signed-in admin, or null (not signed in, not an admin, or the table could not be read). Cached per request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const member = await getMember();
  if (!member) return null;
  try {
    const { data, error } = await supabaseAdmin().from("site_admins").select("role, name").eq("user_id", member.id).maybeSingle();
    if (error || !data) return null;
    const name = String(data.name ?? "").trim() || (member.email ?? "").split("@")[0] || "관리자";
    return { ...member, role: data.role === "owner" ? "owner" : "editor", name: name.slice(0, 40) };
  } catch {
    return null;
  }
});
