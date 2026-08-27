"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ActivityCalendar, type DayActivity } from "@/components/activity-calendar";
import { IconValue } from "@/components/icon-value";
import { AUCTION_HOUSE_FEE_RATE } from "@/lib/constants";
import { formatKoreanMeso, formatNumber, formatKrw } from "@/lib/format";
import { handleMesoInput } from "@/lib/meso-input";
import { computeSettlement } from "@/lib/settlement-math";
import type { HuntingLog, Settlement } from "@/lib/supabase";
import {
  deleteLog,
  deleteSettlement,
  settleUp,
  upsertLog,
  type SettleState,
  type UpsertLogState,
} from "./actions";

const initialLogState: UpsertLogState = {};
const initialSettleState: SettleState = {};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function SettlementClient({
  workerId,
  logs,
  settlements,
}: {
  workerId: number;
  logs: HuntingLog[];
  settlements: Settlement[];
}) {
  const [logState, logFormAction, isLogPending] = useActionState(upsertLog, initialLogState);
  const logFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (logState.successAt) {
      logFormRef.current?.reset();
    }
  }, [logState.successAt]);

  const [settleState, settleFormAction, isSettlePending] = useActionState(
    settleUp,
    initialSettleState
  );
  const settleFormRef = useRef<HTMLFormElement>(null);

  const [fragmentPrice, setFragmentPrice] = useState(0);
  const [cashRate, setCashRate] = useState(140);
  // null이면 "보유한 조각 전부"를 판매 수량 기본값으로 사용합니다.
  const [sellFragmentInput, setSellFragmentInput] = useState<number | null>(null);
  const [incentiveMeso, setIncentiveMeso] = useState(0);

  useEffect(() => {
    // 정산이 성공하면 판매 수량/인센티브 입력을 초기화해 다음 정산에 영향이 없게 합니다.
    if (settleState.successAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSellFragmentInput(null);
      setIncentiveMeso(0);
    }
  }, [settleState.successAt]);

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

  const rawTotalPureMeso = logs.reduce((sum, log) => sum + log.pure_meso, 0);
  const rawTotalFragments = logs.reduce((sum, log) => sum + log.fragment_count, 0);
  const settledPureMeso = settlements.reduce((sum, s) => sum + s.pure_meso, 0);
  const settledFragments = settlements.reduce((sum, s) => sum + s.fragment_count, 0);

  // 정산(경매장 판매)한 만큼은 누적에서 자동으로 빠집니다.
  const totalPureMeso = Math.max(0, rawTotalPureMeso - settledPureMeso);
  const totalFragments = Math.max(0, rawTotalFragments - settledFragments);

  const logsByDate = useMemo(() => {
    const map = new Map<string, DayActivity>();
    for (const log of logs) {
      map.set(log.log_date, {
        pureMeso: log.pure_meso,
        fragmentCount: log.fragment_count,
      });
    }
    return map;
  }, [logs]);

  // 보유한 조각 전체를 지금 시세로 팔았을 때의 전체 자산 가치 (누적 현황 카드용)
  const portfolio = computeSettlement(totalFragments, totalPureMeso, fragmentPrice, cashRate);

  // 조각은 한 번에 전부 팔지 않고 일부만 팔 수도 있습니다.
  const fragmentsToSell = Math.min(
    Math.max(0, sellFragmentInput ?? totalFragments),
    totalFragments
  );
  // 실제로 이번에 정산할 내역 (계산기 하단 breakdown + 정산하기 버튼용)
  const pending = computeSettlement(
    fragmentsToSell,
    totalPureMeso,
    fragmentPrice,
    cashRate,
    incentiveMeso
  );

  const canSettle = fragmentsToSell > 0 || totalPureMeso > 0 || incentiveMeso > 0;

  function handleSettleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const incentiveNote =
      incentiveMeso > 0 ? ` (인센티브 ${formatNumber(incentiveMeso)}메소 포함)` : "";
    const confirmed = window.confirm(
      `${formatNumber(fragmentsToSell)}개 / ${formatNumber(
        totalPureMeso
      )}메소를 정산 처리할까요?${incentiveNote}\n정산 후에는 누적 현황에서 이 수량이 빠지고, 정산 내역에 기록됩니다.`
    );
    if (confirmed) {
      settleFormRef.current?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 누적 현황 대시보드 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          누적 현황 (미정산)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="누적 솔 에르다 조각">
            <IconValue icon="/fragment.png" alt="조각" size={22}>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(totalFragments)}개
              </span>
            </IconValue>
          </SummaryCard>
          <SummaryCard label="누적 순수 메소">
            <IconValue icon="/meso.png" alt="메소" size={22}>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(totalPureMeso)}
              </span>
            </IconValue>
          </SummaryCard>
          <SummaryCard label="현재 시세 기준 누적 가치">
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatKrw(portfolio.krwValue)}
            </span>
          </SummaryCard>
        </div>
      </section>

      {/* 일일 사냥 데이터 기록 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          일일 사냥 기록 추가
        </h2>
        <form
          ref={logFormRef}
          action={logFormAction}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="worker_id" value={workerId} />
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            날짜
            <input
              type="date"
              name="log_date"
              defaultValue={todayString()}
              required
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            순수 메소
            <input
              type="number"
              name="pure_meso"
              min={0}
              step={1}
              required
              placeholder="0"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            솔 에르다 조각 (개)
            <input
              type="number"
              name="fragment_count"
              min={0}
              step={1}
              required
              placeholder="0"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={isLogPending}
            className="h-fit rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {isLogPending ? "저장 중..." : "기록 저장"}
          </button>
        </form>
        {logState.error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{logState.error}</p>
        )}
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          같은 날짜로 다시 저장하면 해당 날짜의 기록이 수정됩니다.
        </p>
      </section>

      {/* 실시간 시세 연동 정산 계산기 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          실시간 시세 연동 정산 계산기
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            현재 조각 가격 (만 메소 / 1개)
            <input
              type="number"
              min={0}
              step={10}
              value={fragmentPrice / 10_000}
              onChange={(e) => setFragmentPrice(Number(e.target.value) * 10_000)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            현금화 비율 (원 / 1억 메소)
            <input
              type="number"
              min={0}
              step={50}
              value={cashRate}
              onChange={(e) => setCashRate(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            판매할 조각 개수
            <input
              type="number"
              min={0}
              max={totalFragments}
              step={1}
              value={fragmentsToSell}
              onChange={(e) => setSellFragmentInput(Number(e.target.value))}
              className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <span className="pb-2 text-xs text-slate-400 dark:text-slate-500">
            보유 {formatNumber(totalFragments)}개
          </span>
          <button
            type="button"
            onClick={() => setSellFragmentInput(totalFragments)}
            className="pb-2 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
          >
            판매
          </button>
        </div>

        <div className="mt-3">
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            인센티브 메소 (부주에게 추가로 지급)
            <input
              type="text"
              inputMode="numeric"
              value={incentiveMeso === 0 ? "" : formatNumber(incentiveMeso)}
              placeholder="0"
              onChange={(e) => handleMesoInput(e, setIncentiveMeso)}
              className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          {incentiveMeso > 0 && (
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
              {formatKoreanMeso(incentiveMeso)}
            </span>
          )}
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
            <IconValue icon="/fragment.png" alt="조각" size={16}>
              {formatNumber(fragmentsToSell)}개 × {formatNumber(fragmentPrice)}
            </IconValue>
            <span>=</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(pending.grossMeso)}
            </IconValue>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400 dark:text-slate-500">
            <span>경매장 수수료 ({AUCTION_HOUSE_FEE_RATE * 100}%)</span>
            <span>− {formatNumber(pending.feeMeso)}</span>
          </div>
          <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
            <span>조각 판매 실수령</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(pending.netMeso)}
            </IconValue>
            <span>+</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(totalPureMeso)}
            </IconValue>
            {pending.incentiveMeso > 0 && (
              <>
                <span>+</span>
                <span>인센티브</span>
                <IconValue icon="/meso.png" alt="메소" size={16}>
                  {formatNumber(pending.incentiveMeso)}
                </IconValue>
              </>
            )}
            <span>=</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              총 {formatNumber(pending.totalMeso)} 메소
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 dark:text-slate-400">총 메소 기준 현금 환산액</span>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatKrw(pending.krwValue)}
              </span>
            </div>
            <form ref={settleFormRef} action={settleFormAction}>
              <input type="hidden" name="worker_id" value={workerId} />
              <input type="hidden" name="fragment_price" value={fragmentPrice} />
              <input type="hidden" name="cash_rate" value={cashRate} />
              <input type="hidden" name="fragment_count" value={fragmentsToSell} />
              <input type="hidden" name="pure_meso" value={totalPureMeso} />
              <input type="hidden" name="fee_meso" value={pending.feeMeso} />
              <input type="hidden" name="incentive_meso" value={pending.incentiveMeso} />
              <input type="hidden" name="total_meso" value={pending.totalMeso} />
              <input type="hidden" name="krw_value" value={pending.krwValue} />
              <button
                type="submit"
                disabled={!canSettle || isSettlePending}
                onClick={handleSettleClick}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {isSettlePending ? "정산 중..." : "이 금액으로 정산하기"}
              </button>
            </form>
          </div>
          {settleState.error && (
            <p className="mt-2 text-right text-sm text-red-600 dark:text-red-400">
              {settleState.error}
            </p>
          )}
        </div>
      </section>

      {/* 부주 활동 달력 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          부주 활동 달력
        </h2>
        <ActivityCalendar logsByDate={logsByDate} />
      </section>

      {/* 기록 테이블 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          일일 기록 ({logs.length}일)
        </h2>
        {logs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            아직 기록이 없습니다. 위에서 첫 기록을 추가해보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">날짜</th>
                  <th className="px-5 py-3 font-medium">순수 메소</th>
                  <th className="px-5 py-3 font-medium">솔 에르다 조각</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {log.log_date}
                    </td>
                    <td className="px-5 py-3">
                      <IconValue icon="/meso.png" alt="메소">
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatNumber(log.pure_meso)}
                        </span>
                      </IconValue>
                    </td>
                    <td className="px-5 py-3">
                      <IconValue icon="/fragment.png" alt="조각">
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatNumber(log.fragment_count)}개
                        </span>
                      </IconValue>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteLog.bind(null, log.id, workerId)}>
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

      {/* 정산 내역 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          정산 내역 ({settlements.length}건)
        </h2>
        {settlements.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            아직 정산한 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">정산 일시</th>
                  <th className="px-5 py-3 font-medium">정산 수량</th>
                  <th className="px-5 py-3 font-medium">총 메소</th>
                  <th className="px-5 py-3 font-medium">현금 환산액</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {new Date(s.settled_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <IconValue icon="/fragment.png" alt="조각" size={14}>
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatNumber(s.fragment_count)}개
                          </span>
                        </IconValue>
                        <IconValue icon="/meso.png" alt="메소" size={14}>
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatNumber(s.pure_meso)}
                          </span>
                        </IconValue>
                        {s.incentive_meso > 0 && (
                          <span className="text-xs text-orange-500 dark:text-orange-400">
                            인센티브 +{formatNumber(s.incentive_meso)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {formatNumber(s.total_meso)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-orange-600 dark:text-orange-400">
                      {formatKrw(s.krw_value)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteSettlement.bind(null, s.id, workerId)}>
                        <button
                          type="submit"
                          className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                        >
                          되돌리기
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      {children}
    </div>
  );
}
