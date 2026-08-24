import { supabase } from "@/lib/supabase";
import { SettlementClient } from "./settlement-client";

export default async function SettlementPage() {
  const { data, error } = await supabase
    .from("hunting_logs")
    .select("*")
    .order("log_date", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        데이터를 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  return <SettlementClient logs={data ?? []} />;
}
