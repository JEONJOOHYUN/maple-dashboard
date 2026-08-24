"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ActivityCalendar } from "@/components/activity-calendar";
import { IconValue } from "@/components/icon-value";
import { AUCTION_HOUSE_FEE_RATE } from "@/lib/constants";
import { formatNumber, formatKrw } from "@/lib/format";
import type { HuntingLog } from "@/lib/supabase";
import { deleteLog, upsertLog, type UpsertLogState } from "./actions";

const initialState: UpsertLogState = {};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function SettlementClient({ logs }: { logs: HuntingLog[] }) {
  const [state, formAction, isPending] = useActionState(upsertLog, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.successAt) {
      formRef.current?.reset();
    }
  }, [state.successAt]);

  const [fragmentPrice, setFragmentPrice] = useState(0);
  const [cashRate, setCashRate] = useState(1400);

  useEffect(() => {
    // 최초 렌더는 SSR과 동일한 기본값을 유지해야 하므로, localStorage에 저장된
    // 시세 값은 마운트 이후 한 번만 불러와 반영합니다(하이드레이션 불일치 방지).
    const savedPrice = localStorage.getItem("maple:fragmentPrice");
    const savedRate = localStorage.getItem("maple:cashRate");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedPrice) setFragmentPrice(Number(savedPrice));
    if (savedRate) setCashRate(Number(savedRate));
  }, []);

  useEffect(() => {
    localStorage.setItem("maple:fragmentPrice", String(fragmentPrice));
  }, [fragmentPrice]);

  useEffect(() => {
    localStorage.setItem("maple:cashRate", String(cashRate));
  }, [cashRate]);

  const totalPureMeso = logs.reduce((sum, log) => sum + log.pure_meso, 0);
  const totalFragments = logs.reduce((sum, log) => sum + log.fragment_count, 0);
  const activeDates = useMemo(
    () => new Set(logs.map((log) => log.log_date)),
    [logs]
  );

  const fragmentGrossMeso = fragmentPrice * totalFragments;
  const auctionFeeMeso = fragmentGrossMeso * AUCTION_HOUSE_FEE_RATE;
  const fragmentNetMeso = fragmentGrossMeso - auctionFeeMeso;
  const totalMeso = fragmentNetMeso + totalPureMeso;
  const krwValue = (totalMeso / 1_000_000_000) * cashRate;

  return (
    <div className="flex flex-col gap-8">
      {/* 누적 현황 대시보드 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">누적 현황</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="누적 솔 에르다 조각">
            <IconValue icon="/fragment.png" alt="조각" size={22}>
              <span className="text-2xl font-bold text-slate-900">
                {formatNumber(totalFragments)}개
              </span>
            </IconValue>
          </SummaryCard>
          <SummaryCard label="누적 순수 메소">
            <IconValue icon="/meso.png" alt="메소" size={22}>
              <span className="text-2xl font-bold text-slate-900">
                {formatNumber(totalPureMeso)}
              </span>
            </IconValue>
          </SummaryCard>
          <SummaryCard label="현재 시세 기준 누적 가치">
            <span className="text-2xl font-bold text-orange-600">
              {formatKrw(krwValue)}
            </span>
          </SummaryCard>
        </div>
      </section>

      {/* 실시간 시세 연동 정산 계산기 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-500">
          실시간 시세 연동 정산 계산기
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            현재 조각 가격 (메소 / 1개)
            <input
              type="number"
              min={0}
              value={fragmentPrice}
              onChange={(e) => setFragmentPrice(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            현금화 비율 (원 / 10억 메소)
            <input
              type="number"
              min={0}
              value={cashRate}
              onChange={(e) => setCashRate(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <IconValue icon="/fragment.png" alt="조각" size={16}>
              {formatNumber(totalFragments)}개 × {formatNumber(fragmentPrice)}
            </IconValue>
            <span>=</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(fragmentGrossMeso)}
            </IconValue>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400">
            <span>경매장 수수료 ({AUCTION_HOUSE_FEE_RATE * 100}%)</span>
            <span>−{formatNumber(auctionFeeMeso)}</span>
          </div>
          <div className="my-2 border-t border-slate-200" />
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>조각 판매 실수령</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(fragmentNetMeso)}
            </IconValue>
            <span>+</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(totalPureMeso)}
            </IconValue>
            <span>=</span>
            <span className="font-semibold text-slate-900">
              총 {formatNumber(totalMeso)} 메소
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-slate-500">총 메소 기준 현금 환산액</span>
            <span className="text-xl font-bold text-orange-600">
              {formatKrw(krwValue)}
            </span>
          </div>
        </div>
      </section>

      {/* 부주 활동 달력 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-500">
          부주 활동 달력
        </h2>
        <ActivityCalendar activeDates={activeDates} />
      </section>

      {/* 일일 사냥 데이터 기록 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-500">
          일일 사냥 기록 추가
        </h2>
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
        >
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            날짜
            <input
              type="date"
              name="log_date"
              defaultValue={todayString()}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            순수 메소
            <input
              type="number"
              name="pure_meso"
              min={0}
              step={1}
              required
              placeholder="0"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            솔 에르다 조각 (개)
            <input
              type="number"
              name="fragment_count"
              min={0}
              step={1}
              required
              placeholder="0"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="h-fit rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "기록 저장"}
          </button>
        </form>
        {state.error && (
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          같은 날짜로 다시 저장하면 해당 날짜의 기록이 수정됩니다.
        </p>
      </section>

      {/* 기록 테이블 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500">
          일일 기록 ({logs.length}일)
        </h2>
        {logs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            아직 기록이 없습니다. 위에서 첫 기록을 추가해보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-5 py-3 font-medium">날짜</th>
                  <th className="px-5 py-3 font-medium">순수 메소</th>
                  <th className="px-5 py-3 font-medium">솔 에르다 조각</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 text-slate-700">{log.log_date}</td>
                    <td className="px-5 py-3">
                      <IconValue icon="/meso.png" alt="메소">
                        {formatNumber(log.pure_meso)}
                      </IconValue>
                    </td>
                    <td className="px-5 py-3">
                      <IconValue icon="/fragment.png" alt="조각">
                        {formatNumber(log.fragment_count)}개
                      </IconValue>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteLog.bind(null, log.id)}>
                        <button
                          type="submit"
                          className="text-xs text-slate-400 hover:text-red-500"
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

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      {children}
    </div>
  );
}
