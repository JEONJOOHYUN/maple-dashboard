"use client";

import { useEffect } from "react";
import { Message } from "@/components/message";

/** A page that threw while rendering: the look of the "조회 실패" block, with one way to try again. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Message heading title="화면 불러오기 실패" sub="일시적인 오류일 수 있음">
      <button type="button" onClick={() => retry()} className="mt-2.5 h-10 rounded-lg bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground">
        다시 시도
      </button>
    </Message>
  );
}
