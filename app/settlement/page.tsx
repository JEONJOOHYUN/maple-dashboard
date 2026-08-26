import { WorkerTabs } from "@/components/worker-tabs";
import { getWorkerData, getWorkers } from "@/lib/queries";
import { SettlementClient } from "./settlement-client";

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string }>;
}) {
  const { worker } = await searchParams;

  const { data: workers, error: workersError } = await getWorkers();

  if (workersError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        데이터를 불러오지 못했습니다: {workersError}
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <WorkerTabs workers={[]} selectedWorkerId={undefined} />
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          아직 등록된 부주가 없습니다. 위에서 부주를 먼저 추가해주세요.
        </p>
      </div>
    );
  }

  const requestedId = worker ? Number(worker) : NaN;
  const selectedWorker =
    workers.find((w) => w.id === requestedId) ?? workers[0];

  const { logs, settlements, error } = await getWorkerData(selectedWorker.id);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        데이터를 불러오지 못했습니다: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkerTabs workers={workers} selectedWorkerId={selectedWorker.id} />
      <SettlementClient
        key={selectedWorker.id}
        workerId={selectedWorker.id}
        logs={logs}
        settlements={settlements}
      />
    </div>
  );
}
