import { supabase } from "@/lib/supabase";
import { SettlementClient } from "./settlement-client";

export default async function SettlementPage() {
  const [logsResult, settlementsResult] = await Promise.all([
    supabase.from("hunting_logs").select("*").order("log_date", { ascending: false }),
    supabase.from("settlements").select("*").order("settled_at", { ascending: false }),
  ]);

  if (logsResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        데이터를 불러오지 못했습니다: {logsResult.error.message}
      </div>
    );
  }
  if (settlementsResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        데이터를 불러오지 못했습니다: {settlementsResult.error.message}
      </div>
    );
  }

  return (
    <SettlementClient
      logs={logsResult.data ?? []}
      settlements={settlementsResult.data ?? []}
    />
  );
}
