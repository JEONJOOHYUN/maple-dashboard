import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { FragmentSale, HuntingLog, LogEntry, Settlement, Worker } from "./supabase";

// 입력 이력은 최근 것만 보여주면 충분해서 개수를 제한합니다.
const LOG_ENTRY_LIMIT = 30;

// 부주 목록과 각 부주의 기록/정산 데이터를 태그별로 캐싱합니다.
// 실제 변경은 서버 액션에서만 일어나므로, revalidateTag로 해당 태그만
// 갱신하면 그 외에는 DB를 다시 조회하지 않습니다.

export function getWorkers(): Promise<{ data: Worker[]; error: string | null }> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      return { data: data ?? [], error: error?.message ?? null };
    },
    ["workers-list"],
    { tags: ["workers"], revalidate: 300 }
  )();
}

export function getWorkerData(workerId: number): Promise<{
  logs: HuntingLog[];
  logEntries: LogEntry[];
  fragmentSales: FragmentSale[];
  settlements: Settlement[];
  error: string | null;
}> {
  return unstable_cache(
    async () => {
      const [logsResult, entriesResult, salesResult, settlementsResult] = await Promise.all([
        supabase
          .from("hunting_logs")
          .select("*")
          .eq("worker_id", workerId)
          .order("log_date", { ascending: false }),
        supabase
          .from("log_entries")
          .select("*")
          .eq("worker_id", workerId)
          .order("created_at", { ascending: false })
          .limit(LOG_ENTRY_LIMIT),
        supabase
          .from("fragment_sales")
          .select("*")
          .eq("worker_id", workerId)
          .order("sold_at", { ascending: false }),
        supabase
          .from("settlements")
          .select("*")
          .eq("worker_id", workerId)
          .order("settled_at", { ascending: false }),
      ]);
      // 입력 이력은 부가 정보라, 마이그레이션 전이거나 조회에 실패해도
      // 페이지 전체를 실패시키지 않고 빈 목록으로 넘어갑니다.
      const error =
        logsResult.error?.message ??
        salesResult.error?.message ??
        settlementsResult.error?.message ??
        null;
      return {
        logs: logsResult.data ?? [],
        logEntries: entriesResult.data ?? [],
        fragmentSales: salesResult.data ?? [],
        settlements: settlementsResult.data ?? [],
        error,
      };
    },
    ["worker-data", String(workerId)],
    { tags: [`worker-${workerId}`], revalidate: 300 }
  )();
}

export function workerTag(workerId: number) {
  return `worker-${workerId}`;
}
