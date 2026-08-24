"use client";

import { useMemo, useState } from "react";
import { IconValue } from "@/components/icon-value";
import { formatCompactMeso, formatNumber } from "@/lib/format";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type DayActivity = {
  pureMeso: number;
  fragmentCount: number;
};

function toDateKey(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function ActivityCalendar({
  logsByDate,
}: {
  logsByDate: Map<string, DayActivity>;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const { weeks, activeCount, monthPureMeso, monthFragmentCount } = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    let activeCount = 0;
    let monthPureMeso = 0;
    let monthFragmentCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const activity = logsByDate.get(toDateKey(year, month, day));
      if (activity) {
        activeCount++;
        monthPureMeso += activity.pureMeso;
        monthFragmentCount += activity.fragmentCount;
      }
    }

    return { weeks, activeCount, monthPureMeso, monthFragmentCount };
  }, [year, month, logsByDate]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="이전 달"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {year}년 {month + 1}월
          <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
            {activeCount}일 사냥
          </span>
        </p>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <IconValue icon="/fragment.png" alt="조각" size={14}>
          이번 달 {formatNumber(monthFragmentCount)}개
        </IconValue>
        <IconValue icon="/meso.png" alt="메소" size={14}>
          이번 달 {formatNumber(monthPureMeso)}
        </IconValue>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 dark:text-slate-500">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            if (day === null) {
              return <div key={`${weekIndex}-${dayIndex}`} />;
            }
            const key = toDateKey(year, month, day);
            const activity = logsByDate.get(key);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                title={key}
                className={`flex min-h-16 flex-col items-center gap-0.5 rounded-lg pt-1 pb-1.5 text-xs sm:min-h-20 ${
                  activity
                    ? "bg-orange-50 dark:bg-orange-500/10"
                    : "bg-slate-50 dark:bg-slate-800/60"
                } ${isToday ? "ring-2 ring-orange-300 ring-offset-1 ring-offset-white dark:ring-offset-slate-900" : ""}`}
              >
                <span
                  className={`font-semibold ${
                    activity
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {day}
                </span>
                {activity && (
                  <>
                    <IconValue icon="/fragment.png" alt="조각" size={10}>
                      <span className="text-[10px] leading-none text-slate-600 dark:text-slate-300">
                        {activity.fragmentCount}개
                      </span>
                    </IconValue>
                    <IconValue icon="/meso.png" alt="메소" size={10}>
                      <span className="text-[10px] leading-none text-slate-600 dark:text-slate-300">
                        {formatCompactMeso(activity.pureMeso)}
                      </span>
                    </IconValue>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
