"use client";

import { useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function ActivityCalendar({ activeDates }: { activeDates: Set<string> }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const { weeks, activeCount } = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    let activeCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (activeDates.has(toDateKey(year, month, day))) activeCount++;
    }

    return { weeks, activeCount };
  }, [year, month, activeDates]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="이전 달"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-700">
          {year}년 {month + 1}월
          <span className="ml-2 text-xs font-normal text-slate-400">
            {activeCount}일 사냥
          </span>
        </p>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
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
            const active = activeDates.has(key);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                title={key}
                className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
                  active
                    ? "bg-orange-500 font-semibold text-white"
                    : "bg-slate-50 text-slate-400"
                } ${isToday ? "ring-2 ring-orange-300 ring-offset-1" : ""}`}
              >
                {day}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
