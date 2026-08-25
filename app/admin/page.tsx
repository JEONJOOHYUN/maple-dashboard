import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { AdminDashboard } from "./admin-dashboard";
import { AdminLoginForm } from "./admin-login-form";

async function isAuthed() {
  const store = await cookies();
  const value = store.get("admin_session")?.value;
  return Boolean(value) && value === process.env.ADMIN_PASSWORD;
}

export default async function AdminPage() {
  const authed = await isAuthed();

  if (!authed) {
    return <AdminLoginForm />;
  }

  const [workersResult, logsResult, settlementsResult] = await Promise.all([
    supabase.from("workers").select("*").order("sort_order").order("id"),
    supabase.from("hunting_logs").select("*").order("log_date", { ascending: false }),
    supabase.from("settlements").select("*").order("settled_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      workers={workersResult.data ?? []}
      logs={logsResult.data ?? []}
      settlements={settlementsResult.data ?? []}
    />
  );
}
