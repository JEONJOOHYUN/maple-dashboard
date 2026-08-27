import { deleteWorker, renameWorker } from "@/app/actions/workers";
import { deleteLog, deleteSettlement } from "@/app/settlement/actions";
import { formatKrw } from "@/lib/format";
import type { HuntingLog, Settlement, Worker } from "@/lib/supabase";
import { adminLogout, updateLog, updateSettlement } from "./actions";
import { AdminAddWorkerForm } from "./admin-add-worker-form";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export function AdminDashboard({
  workers,
  logs,
  settlements,
}: {
  workers: Worker[];
  logs: HuntingLog[];
  settlements: Settlement[];
}) {
  const workerName = (id: number) =>
    workers.find((w) => w.id === id)?.name ?? `#${id}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          관리자 페이지
        </h1>
        <form action={adminLogout}>
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
          >
            로그아웃
          </button>
        </form>
      </div>

      {/* 부주 관리 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          부주 관리
        </h2>
        {workers.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">이름</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-3 py-2">
                      <form
                        id={`worker-${w.id}`}
                        action={renameWorker.bind(null, w.id)}
                        className="contents"
                      >
                        <input name="name" defaultValue={w.name} className={inputClass} />
                      </form>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="submit"
                        form={`worker-${w.id}`}
                        className="mr-3 text-xs text-orange-600 hover:underline dark:text-orange-400"
                      >
                        저장
                      </button>
                      <form action={deleteWorker.bind(null, w.id)} className="inline">
                        <button
                          type="submit"
                          className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                        >
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminAddWorkerForm />
      </section>

      {/* 일일 기록 관리 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          일일 기록 관리 ({logs.length}건)
        </h2>
        {logs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            기록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-2 font-medium">부주</th>
                  <th className="px-4 py-2 font-medium">날짜</th>
                  <th className="px-4 py-2 font-medium">순수 메소</th>
                  <th className="px-4 py-2 font-medium">조각</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {workerName(log.worker_id)}
                    </td>
                    <td className="px-4 py-2">
                      <form
                        id={`log-${log.id}`}
                        action={updateLog.bind(null, log.id, log.worker_id)}
                        className="contents"
                      >
                        <input
                          type="date"
                          name="log_date"
                          defaultValue={log.log_date}
                          className={inputClass}
                        />
                      </form>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="pure_meso"
                        defaultValue={log.pure_meso}
                        form={`log-${log.id}`}
                        className={`w-32 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="fragment_count"
                        defaultValue={log.fragment_count}
                        form={`log-${log.id}`}
                        className={`w-20 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="submit"
                        form={`log-${log.id}`}
                        className="mr-3 text-xs text-orange-600 hover:underline dark:text-orange-400"
                      >
                        저장
                      </button>
                      <form
                        action={deleteLog.bind(null, log.id, log.worker_id)}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                        >
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 정산 내역 관리 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          정산 내역 관리 ({settlements.length}건)
        </h2>
        {settlements.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            정산 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-2 font-medium">부주</th>
                  <th className="px-4 py-2 font-medium">정산 일시</th>
                  <th className="px-4 py-2 font-medium">조각 가격</th>
                  <th className="px-4 py-2 font-medium">현금화 비율</th>
                  <th className="px-4 py-2 font-medium">조각 수</th>
                  <th className="px-4 py-2 font-medium">순수 메소</th>
                  <th className="px-4 py-2 font-medium">인센티브</th>
                  <th className="px-4 py-2 font-medium">KRW</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {workerName(s.worker_id)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {new Date(s.settled_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-2">
                      <form
                        id={`settlement-${s.id}`}
                        action={updateSettlement.bind(null, s.id, s.worker_id)}
                        className="contents"
                      >
                        <input
                          type="number"
                          name="fragment_price"
                          defaultValue={s.fragment_price}
                          className={`w-28 ${inputClass}`}
                        />
                      </form>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="cash_rate"
                        defaultValue={s.cash_rate}
                        form={`settlement-${s.id}`}
                        className={`w-20 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="fragment_count"
                        defaultValue={s.fragment_count}
                        form={`settlement-${s.id}`}
                        className={`w-20 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="pure_meso"
                        defaultValue={s.pure_meso}
                        form={`settlement-${s.id}`}
                        className={`w-32 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        name="incentive_meso"
                        defaultValue={s.incentive_meso}
                        form={`settlement-${s.id}`}
                        className={`w-28 ${inputClass}`}
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {formatKrw(s.krw_value)}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="submit"
                        form={`settlement-${s.id}`}
                        className="mr-3 text-xs text-orange-600 hover:underline dark:text-orange-400"
                      >
                        저장
                      </button>
                      <form
                        action={deleteSettlement.bind(null, s.id, s.worker_id)}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                        >
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
