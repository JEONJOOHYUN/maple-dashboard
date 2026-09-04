"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ActivityCalendar, type DayActivity } from "@/components/activity-calendar";
import { IconValue } from "@/components/icon-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUCTION_HOUSE_FEE_RATE } from "@/lib/constants";
import { formatKoreanMeso, formatNumber, formatKrw } from "@/lib/format";
import { handleMesoInput } from "@/lib/meso-input";
import { computeSettlement } from "@/lib/settlement-math";
import type { FragmentSale, HuntingLog, Settlement } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  deleteFragmentSale,
  deleteLog,
  deleteSettlement,
  sellFragments,
  settleUp,
  upsertLog,
  type SellFragmentsState,
  type SettleState,
  type UpsertLogState,
} from "./actions";

const initialLogState: UpsertLogState = {};
const initialSellState: SellFragmentsState = {};
const initialSettleState: SettleState = {};

const LOGS_PER_PAGE = 5;

// 기존 디자인(slate 팔레트)을 유지하면서 shadcn Input을 쓰기 위한 공통 클래스입니다.
const fieldClass =
  "h-10 rounded-lg border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-orange-400 focus-visible:ring-orange-400/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/** number | "" 상태를 쓰는 숫자 입력의 onChange 핸들러 (빈 칸을 0으로 되돌리지 않습니다) */
function numberInputHandler(setter: (value: number | "") => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value === "" ? "" : Number(e.target.value));
}

export function SettlementClient({
  workerId,
  logs,
  fragmentSales,
  settlements,
}: {
  workerId: number;
  logs: HuntingLog[];
  fragmentSales: FragmentSale[];
  settlements: Settlement[];
}) {
  const [logState, logFormAction, isLogPending] = useActionState(upsertLog, initialLogState);
  const logFormRef = useRef<HTMLFormElement>(null);

  const [logDateInput, setLogDateInput] = useState(() => todayString());
  const [logPureMesoInput, setLogPureMesoInput] = useState<number | "">("");
  const [logFragmentInput, setLogFragmentInput] = useState<number | "">("");
  const [isEditingLog, setIsEditingLog] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);

  function resetLogForm() {
    setLogDateInput(todayString());
    setLogPureMesoInput("");
    setLogFragmentInput("");
    setIsEditingLog(false);
    setEditNotice(null);
  }

  function handleEditClick() {
    const existing = logs.find((log) => log.log_date === logDateInput);
    if (!existing) {
      setEditNotice("해당 날짜에 저장된 기록이 없습니다.");
      setLogPureMesoInput("");
      setLogFragmentInput("");
      setIsEditingLog(true);
      return;
    }
    setLogPureMesoInput(existing.pure_meso);
    setLogFragmentInput(existing.fragment_count);
    setIsEditingLog(true);
    setEditNotice(null);
  }

  useEffect(() => {
    if (logState.successAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetLogForm();
    }
  }, [logState.successAt]);

  const [sellState, sellFormAction, isSellPending] = useActionState(
    sellFragments,
    initialSellState
  );
  const sellFormRef = useRef<HTMLFormElement>(null);

  const [settleState, settleFormAction, isSettlePending] = useActionState(
    settleUp,
    initialSettleState
  );
  const settleFormRef = useRef<HTMLFormElement>(null);

  // 시세/수량 입력은 일일 기록 폼과 동일하게 "빈 칸"을 그대로 유지합니다.
  // (0으로 되돌아가 지워지지 않는 문제를 막기 위함)
  const [fragmentPriceMan, setFragmentPriceMan] = useState<number | "">("");
  const [cashRateInput, setCashRateInput] = useState<number | "">(140);
  // ""이면 "보유한 조각 전부"를 판매 수량으로 사용합니다.
  const [sellFragmentInput, setSellFragmentInput] = useState<number | "">("");
  const [incentiveMeso, setIncentiveMeso] = useState(0);
  const [logPage, setLogPage] = useState(0);

  const fragmentPrice = (fragmentPriceMan === "" ? 0 : fragmentPriceMan) * 10_000;
  const cashRate = cashRateInput === "" ? 0 : cashRateInput;

  useEffect(() => {
    if (sellState.successAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSellFragmentInput("");
    }
  }, [sellState.successAt]);

  useEffect(() => {
    // 정산이 성공하면 인센티브 입력을 초기화해 다음 정산에 영향이 없게 합니다.
    if (settleState.successAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIncentiveMeso(0);
    }
  }, [settleState.successAt]);

  useEffect(() => {
    // 최초 렌더는 SSR과 동일한 기본값을 유지해야 하므로, localStorage에 저장된
    // 시세 값은 마운트 이후 한 번만 불러와 반영합니다(하이드레이션 불일치 방지).
    const savedPrice = Number(localStorage.getItem("maple:fragmentPrice"));
    const savedRate = Number(localStorage.getItem("maple:cashRate"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedPrice > 0) setFragmentPriceMan(savedPrice / 10_000);
    if (savedRate > 0) setCashRateInput(savedRate);
  }, []);

  useEffect(() => {
    localStorage.setItem("maple:fragmentPrice", String(fragmentPrice));
  }, [fragmentPrice]);

  useEffect(() => {
    localStorage.setItem("maple:cashRate", String(cashRate));
  }, [cashRate]);

  const rawTotalPureMeso = logs.reduce((sum, log) => sum + log.pure_meso, 0);
  const rawTotalFragments = logs.reduce((sum, log) => sum + log.fragment_count, 0);
  const soldFragments = fragmentSales.reduce((sum, s) => sum + s.fragment_count, 0);
  const soldNetMeso = fragmentSales.reduce((sum, s) => sum + s.net_meso, 0);
  const settledPureMeso = settlements.reduce((sum, s) => sum + s.pure_meso, 0);
  // 조각 판매가 분리되기 전에 기록된 정산 행은 조각도 함께 소모했습니다.
  const settledFragments = settlements.reduce((sum, s) => sum + s.fragment_count, 0);

  // 조각: 사냥으로 모은 만큼에서 판매(+과거 정산)한 만큼이 빠집니다.
  const totalFragments = Math.max(0, rawTotalFragments - soldFragments - settledFragments);
  // 메소: 순수 메소 + 조각을 팔아 받은 메소에서 현금 정산한 만큼이 빠집니다.
  const totalPureMeso = Math.max(0, rawTotalPureMeso + soldNetMeso - settledPureMeso);

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
  const fragmentsToSell =
    sellFragmentInput === ""
      ? totalFragments
      : Math.min(Math.max(0, sellFragmentInput), totalFragments);
  // 이번 판매로 받게 될 메소 (수수료 3% 차감)
  const sale = computeSettlement(fragmentsToSell, 0, fragmentPrice, cashRate);
  const canSell = fragmentsToSell > 0 && fragmentPrice > 0;

  // 현금 정산 대상: 보유 메소 + 인센티브
  const pending = computeSettlement(0, totalPureMeso, fragmentPrice, cashRate, incentiveMeso);
  const canSettle = pending.totalMeso > 0;

  // 일일 기록은 5개씩 페이지로 나눠 보여줍니다.
  const logPageCount = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));
  const currentLogPage = Math.min(logPage, logPageCount - 1);
  const pagedLogs = logs.slice(
    currentLogPage * LOGS_PER_PAGE,
    currentLogPage * LOGS_PER_PAGE + LOGS_PER_PAGE
  );

  function handleSellClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const confirmed = window.confirm(
      `조각 ${formatNumber(fragmentsToSell)}개를 개당 ${formatNumber(
        fragmentPrice
      )} 메소에 판매할까요?\n수수료 ${
        AUCTION_HOUSE_FEE_RATE * 100
      }%를 뗀 ${formatNumber(sale.netMeso)} 메소가 누적 순수 메소에 더해집니다.`
    );
    if (confirmed) {
      sellFormRef.current?.requestSubmit();
    }
  }

  function handleSettleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const incentiveNote =
      incentiveMeso > 0 ? ` (인센티브 ${formatNumber(incentiveMeso)}메소 포함)` : "";
    const confirmed = window.confirm(
      `보유 메소 ${formatNumber(pending.totalMeso)}메소를 ${formatKrw(
        pending.krwValue
      )}으로 정산 처리할까요?${incentiveNote}\n정산 후에는 누적 메소에서 이 금액이 빠지고, 정산 내역에 기록됩니다.`
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
          id="log-form"
          ref={logFormRef}
          action={logFormAction}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_1fr_auto_auto] sm:items-end"
        >
          <input type="hidden" name="worker_id" value={workerId} />
          <input type="hidden" name="mode" value={isEditingLog ? "overwrite" : "add"} />
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            날짜
            <Input
              type="date"
              name="log_date"
              value={logDateInput}
              onChange={(e) => setLogDateInput(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            순수 메소
            <Input
              type="number"
              name="pure_meso"
              min={0}
              step={1}
              required
              placeholder="0"
              value={logPureMesoInput}
              onChange={numberInputHandler(setLogPureMesoInput)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            솔 에르다 조각 (개)
            <Input
              type="number"
              name="fragment_count"
              min={0}
              step={1}
              required
              placeholder="0"
              value={logFragmentInput}
              onChange={numberInputHandler(setLogFragmentInput)}
              className={fieldClass}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={isEditingLog ? resetLogForm : handleEditClick}
            className="h-10 border-slate-300 px-4 text-sm font-medium text-slate-600 hover:border-orange-400 hover:text-orange-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-orange-400 dark:hover:text-orange-400"
          >
            {isEditingLog ? "취소" : "수정하기"}
          </Button>
          <Button
            type="submit"
            disabled={isLogPending}
            className={cn(
              "h-10 px-4 text-sm font-semibold",
              isEditingLog &&
                "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            )}
          >
            {isLogPending ? "저장 중..." : isEditingLog ? "수정 저장" : "기록 추가"}
          </Button>
        </form>
        {logState.error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{logState.error}</p>
        )}
        {editNotice && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{editNotice}</p>
        )}
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {isEditingLog
            ? "이 날짜에 저장된 값을 불러왔습니다. 수정 후 저장하면 값을 그대로 덮어씁니다."
            : "같은 날짜에 다시 저장하면 끊어서 사냥한 만큼 기존 기록에 더해집니다. 값을 고치려면 \"수정하기\"를 눌러주세요."}
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
            <Input
              type="number"
              min={0}
              step={10}
              placeholder="0"
              value={fragmentPriceMan}
              onChange={numberInputHandler(setFragmentPriceMan)}
              className={fieldClass}
            />
            {fragmentPrice > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                개당 {formatKoreanMeso(fragmentPrice)}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            현금화 비율 (원 / 1억 메소)
            <Input
              type="number"
              min={0}
              step={50}
              placeholder="0"
              value={cashRateInput}
              onChange={numberInputHandler(setCashRateInput)}
              className={fieldClass}
            />
          </label>
        </div>

        {/* 1단계: 조각 → 메소 */}
        <div className="mt-5 rounded-xl border-2 border-orange-200 bg-orange-50/60 p-4 dark:border-orange-500/30 dark:bg-orange-500/5">
          <p className="mb-3 text-sm font-semibold text-orange-700 dark:text-orange-300">
            조각 판매
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
              판매할 조각 개수
              <Input
                type="number"
                min={0}
                max={totalFragments}
                step={1}
                placeholder={String(totalFragments)}
                value={sellFragmentInput}
                onChange={numberInputHandler(setSellFragmentInput)}
                className={cn(fieldClass, "w-32")}
              />
            </label>
            <span className="pb-3 text-xs text-slate-400 dark:text-slate-500">
              보유 {formatNumber(totalFragments)}개 (비우면 전량)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSellFragmentInput(totalFragments)}
              className="mb-2 text-xs font-medium text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:text-orange-400 dark:hover:bg-orange-500/10"
            >
              전량 입력
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <IconValue icon="/fragment.png" alt="조각" size={16}>
              {formatNumber(fragmentsToSell)}개 × {formatNumber(fragmentPrice)}
            </IconValue>
            <span>=</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(sale.grossMeso)}
            </IconValue>
            <span className="text-slate-400 dark:text-slate-500">
              − 수수료 {AUCTION_HOUSE_FEE_RATE * 100}% ({formatNumber(sale.feeMeso)})
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                판매 후 받는 메소
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(sale.netMeso)}
              </span>
              {sale.netMeso > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({formatKoreanMeso(sale.netMeso)})
                </span>
              )}
            </div>
            <form ref={sellFormRef} action={sellFormAction}>
              <input type="hidden" name="worker_id" value={workerId} />
              <input type="hidden" name="fragment_count" value={fragmentsToSell} />
              <input type="hidden" name="fragment_price" value={fragmentPrice} />
              <Button
                type="submit"
                size="lg"
                disabled={!canSell || isSellPending}
                onClick={handleSellClick}
                className="h-12 animate-none px-7 text-base font-bold shadow-md shadow-orange-500/25 ring-2 ring-orange-400/0 transition-all hover:-translate-y-0.5 hover:bg-primary hover:shadow-lg hover:shadow-orange-500/40 hover:ring-orange-400/60 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSellPending ? "판매 중..." : "조각 판매하기 →"}
              </Button>
            </form>
          </div>
          {!canSell && !isSellPending && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {totalFragments === 0
                ? "판매할 조각이 없습니다."
                : "조각 가격을 입력하면 판매할 수 있습니다."}
            </p>
          )}
          {sellState.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{sellState.error}</p>
          )}
        </div>

        {/* 2단계: 메소 → 현금 */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            현금 정산
          </p>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            인센티브 메소 (부주에게 추가로 지급)
            <Input
              type="text"
              inputMode="numeric"
              value={incentiveMeso === 0 ? "" : formatNumber(incentiveMeso)}
              placeholder="0"
              onChange={(e) => handleMesoInput(e, setIncentiveMeso)}
              className={cn(fieldClass, "w-48")}
            />
          </label>
          {incentiveMeso > 0 && (
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
              {formatKoreanMeso(incentiveMeso)}
            </span>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>보유 메소</span>
            <IconValue icon="/meso.png" alt="메소" size={16}>
              {formatNumber(totalPureMeso)}
            </IconValue>
            {incentiveMeso > 0 && (
              <>
                <span>+ 인센티브</span>
                <IconValue icon="/meso.png" alt="메소" size={16}>
                  {formatNumber(incentiveMeso)}
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
              {/* 조각은 1단계에서 이미 메소로 전환되므로 정산에는 포함하지 않습니다. */}
              <input type="hidden" name="fragment_count" value={0} />
              <input type="hidden" name="pure_meso" value={totalPureMeso} />
              <input type="hidden" name="fee_meso" value={0} />
              <input type="hidden" name="incentive_meso" value={pending.incentiveMeso} />
              <input type="hidden" name="total_meso" value={pending.totalMeso} />
              <input type="hidden" name="krw_value" value={pending.krwValue} />
              <Button
                type="submit"
                disabled={!canSettle || isSettlePending}
                onClick={handleSettleClick}
                className="h-11 bg-slate-900 px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {isSettlePending ? "정산 중..." : "이 금액으로 정산하기"}
              </Button>
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
          <>
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
                  {pagedLogs.map((log) => (
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
            {logPageCount > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={currentLogPage === 0}
                  onClick={() => setLogPage(currentLogPage - 1)}
                  className="text-slate-500 disabled:opacity-30 dark:text-slate-400"
                >
                  이전
                </Button>
                {Array.from({ length: logPageCount }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={i === currentLogPage ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => setLogPage(i)}
                    className={cn(
                      "text-xs",
                      i !== currentLogPage && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={currentLogPage === logPageCount - 1}
                  onClick={() => setLogPage(currentLogPage + 1)}
                  className="text-slate-500 disabled:opacity-30 dark:text-slate-400"
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 조각 판매 내역 */}
      {fragmentSales.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            조각 판매 내역 ({fragmentSales.length}건)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">판매 일시</th>
                  <th className="px-5 py-3 font-medium">판매 수량</th>
                  <th className="px-5 py-3 font-medium">개당 가격</th>
                  <th className="px-5 py-3 font-medium">받은 메소</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fragmentSales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {new Date(s.sold_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-5 py-3">
                      <IconValue icon="/fragment.png" alt="조각" size={14}>
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatNumber(s.fragment_count)}개
                        </span>
                      </IconValue>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {formatNumber(s.fragment_price)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      +{formatNumber(s.net_meso)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteFragmentSale.bind(null, s.id, workerId)}>
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
        </section>
      )}

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
                        {s.fragment_count > 0 && (
                          <IconValue icon="/fragment.png" alt="조각" size={14}>
                            <span className="text-slate-700 dark:text-slate-300">
                              {formatNumber(s.fragment_count)}개
                            </span>
                          </IconValue>
                        )}
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
