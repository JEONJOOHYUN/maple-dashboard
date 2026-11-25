// Who may change the site values (public.site_admins, migration 014): a signed-in member with a row there.
// The table has no policy, so it is read with the service role key and the query names the member.
import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MEMBER_APP } from "./rules";
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

export type AdminChange = "ok" | "denied" | "invalid" | "notMember" | "already" | "last" | "failed";

const USERS_PAGE = 1000;
const USERS_PAGES = 20;

/** The member of this site who signs in with `email`, or null. undefined = the accounts could not be read. */
async function memberByEmail(email: string): Promise<string | null | undefined> {
  const auth = supabaseAdmin().auth.admin;
  for (let page = 1; page <= USERS_PAGES; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: USERS_PAGE });
    if (error) return undefined;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email && u.app_metadata?.app === MEMBER_APP);
    if (hit) return hit.id;
    if (data.users.length < USERS_PAGE) return null;
  }
  return null;
}

/**
 * An owner makes a member an admin (an editor: they change values, they do not manage admins). The member is named
 * by the address they sign in with; `name` is what the change history will show for them.
 */
export async function addAdmin(by: Admin, email: unknown, name: unknown): Promise<AdminChange> {
  if (by.role !== "owner") return "denied";
  if (typeof email !== "string" || typeof name !== "string") return "invalid";
  const address = email.trim().toLowerCase();
  const shown = name.trim();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(address) || shown.length < 1 || shown.length > 40) return "invalid";
  const id = await memberByEmail(address);
  if (id === undefined) return "failed";
  if (id === null) return "notMember";
  const made = await supabaseAdmin().from("site_admins").insert({ user_id: id, role: "editor", name: shown, added_by: by.id });
  if (!made.error) return "ok";
  // 23505 = that member has a row already.
  return made.error.code === "23505" ? "already" : "failed";
}

/** An owner takes an editor out. An owner's own row (or another owner's) is not removed here. */
export async function removeAdmin(by: Admin, id: unknown): Promise<AdminChange> {
  if (by.role !== "owner") return "denied";
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return "invalid";
  const gone = await supabaseAdmin().from("site_admins").delete().eq("user_id", id).eq("role", "editor").select("user_id");
  if (gone.error) return "failed";
  return gone.data.length > 0 ? "ok" : "last";
}
