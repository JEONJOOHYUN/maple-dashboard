"use client";

import { useEffect } from "react";

/** A page that threw while rendering: the look of the "조회 실패" block, with one way to try again. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex flex-col items-center gap-1.5 rounded-[1rem] border border-dashed border-border bg-card px-5 py-10 text-center">
      <h1 className="text-[15px] font-bold">화면 불러오기 실패</h1>
      <p className="text-[13px] text-muted-foreground">일시적인 오류일 수 있음</p>
      <button type="button" onClick={() => retry()} className="mt-2.5 h-10 rounded-lg bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground">
        다시 시도
      </button>
    </section>
  );
}
