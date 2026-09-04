"use client";

import { useId, useMemo, useState } from "react";
import { IconValue } from "@/components/icon-value";
import { computeBossSplit } from "@/lib/boss-split-math";
import { formatKoreanMeso, formatNumber } from "@/lib/format";
import { handleMesoInput } from "@/lib/meso-input";

type Member = {
  id: string;
  name: string;
  percent: number;
};

function createMember(name: string, percent: number): Member {
  return { id: crypto.randomUUID(), name, percent };
}

type Item = {
  id: string;
  name: string;
  grossMeso: number;
};

function createItem(name: string): Item {
  return { id: crypto.randomUUID(), name, grossMeso: 0 };
}

export default function BossSplitPage() {
  const [feePercent, setFeePercent] = useState(3);
  const [items, setItems] = useState<Item[]>(() => [createItem("아이템 1")]);
  const totalGrossMeso = items.reduce((sum, item) => sum + item.grossMeso, 0);
  const netMeso = totalGrossMeso * (1 - feePercent / 100);

  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [members, setMembers] = useState<Member[]>(() => [
    createMember("파티장", 50),
    createMember("파티원 2", 50),
  ]);

  const [copied, setCopied] = useState(false);
  const copyFeedbackId = useId();

  const equalPercent = members.length > 0 ? 100 / members.length : 0;
  const percentSum = members.reduce(
    (sum, m) => sum + (mode === "equal" ? equalPercent : m.percent),
    0
  );
  const isValidSplit = Math.abs(percentSum - 100) < 0.01;

  const results = useMemo(() => {
    if (!isValidSplit || netMeso <= 0) return null;
    const ratios = members.map((m) =>
      (mode === "equal" ? equalPercent : m.percent) / 100
    );
    return computeBossSplit(netMeso, ratios, feePercent / 100);
  }, [members, mode, equalPercent, netMeso, feePercent, isValidSplit]);

  function addItem() {
    setItems((prev) => [...prev, createItem(`아이템 ${prev.length + 1}`)]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  function updateItemName(id: string, name: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name } : item)));
  }

  function updateItemGross(id: string, grossMeso: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, grossMeso } : item)));
  }

  function addMember() {
    setMembers((prev) => [...prev, createMember(`파티원 ${prev.length + 1}`, 0)]);
  }

  function removeMember(id: string) {
    setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
  }

  function updateMemberName(id: string, name: string) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  }

  function updateMemberPercent(id: string, percent: number) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, percent } : m)));
  }

  async function copyResult() {
    if (!results) return;
    const lines = members.map((m, i) => `${m.name} : ${Math.round(results[i].beforeMeso)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경에서는 조용히 무시합니다.
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          아이템 판매액
        </h2>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
            >
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItemName(item.id, e.target.value)}
                className="w-24 shrink-0 sm:w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                inputMode="numeric"
                value={item.grossMeso === 0 ? "" : formatNumber(item.grossMeso)}
                placeholder="0"
                onChange={(e) => handleMesoInput(e, (value) => updateItemGross(item.id, value))}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                className="shrink-0 text-xs text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-red-400"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-orange-400 hover:text-orange-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-orange-400 dark:hover:text-orange-400"
        >
          + 아이템 추가
        </button>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            합계 판매액 (경매장 수수료 적용 전)
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(totalGrossMeso)}
            </p>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatKoreanMeso(totalGrossMeso)}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            실수령액 (경매장 수수료 적용 후)
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatNumber(netMeso)}
            </p>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatKoreanMeso(netMeso)}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            경매장 수수료 (%)
            <input
              type="number"
              min={0}
              max={99}
              step={0.5}
              value={feePercent}
              onChange={(e) => setFeePercent(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          여러 아이템을 등록하면 합계 판매액을 기준으로 분배금이 계산됩니다.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            분배 방식
          </h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode("equal")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                mode === "equal"
                  ? "bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              균등 분배
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                mode === "custom"
                  ? "bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              자율 분배
            </button>
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          {mode === "equal"
            ? "모든 파티원이 동일한 비율로 분배받습니다."
            : "각 파티원별로 원하는 분배 비율을 직접 설정합니다. 총 합은 100%가 되어야 합니다."}
        </p>

        <div className="flex flex-col gap-2">
          {members.map((member, index) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800"
            >
              <input
                type="text"
                value={member.name}
                onChange={(e) => updateMemberName(member.id, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {index === 0 && (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  파티장
                </span>
              )}
              {mode === "equal" ? (
                <span className="w-14 shrink-0 text-right text-sm sm:w-24 text-slate-500 dark:text-slate-400">
                  {equalPercent.toFixed(1)}%
                </span>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={member.percent === 0 ? "" : member.percent}
                  placeholder="0"
                  onChange={(e) => updateMemberPercent(member.id, Number(e.target.value))}
                  className="w-16 shrink-0 sm:w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm text-slate-900 focus:border-orange-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              )}
              <button
                type="button"
                onClick={() => removeMember(member.id)}
                disabled={members.length <= 1}
                className="shrink-0 text-xs text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-red-400"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addMember}
          className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-orange-400 hover:text-orange-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-orange-400 dark:hover:text-orange-400"
        >
          + 인원 추가
        </button>

        {mode === "custom" && !isValidSplit && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            비율의 합이 100%가 되어야 합니다. (현재 {percentSum.toFixed(1)}%)
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            분배 결과
          </h2>
          <button
            type="button"
            onClick={copyResult}
            disabled={!results}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-orange-500 dark:hover:bg-orange-600"
            aria-describedby={copied ? copyFeedbackId : undefined}
          >
            {copied ? "복사됨" : "결과 복사"}
          </button>
        </div>
        {!results ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            설정이 정상적으로 완료되면 분배 결과가 표시됩니다.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member, index) => {
              const r = results[index];
              return (
                <div key={member.id} className="flex flex-col gap-1 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {member.name}
                    </span>
                    <span>
                      ({(mode === "equal" ? equalPercent : member.percent).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>수수료 적용 전</span>
                    <IconValue icon="/meso.png" alt="메소" size={14}>
                      {formatNumber(r.beforeMeso)}
                    </IconValue>
                    <span>→</span>
                    <span className="text-slate-700 dark:text-slate-300">최종 분배금</span>
                    <IconValue icon="/meso.png" alt="메소" size={16}>
                      <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {formatNumber(r.finalMeso)}
                      </span>
                    </IconValue>
                    {r.deduction > 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        (− {formatNumber(r.deduction)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
