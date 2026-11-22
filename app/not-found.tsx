import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "없는 페이지" };

/** An address with no page behind it: the look of the "조회 실패" block, with the way home. */
export default function NotFound() {
  return (
    <section className="flex flex-col items-center gap-1.5 rounded-[1rem] border border-dashed border-border bg-card px-5 py-10 text-center">
      <h1 className="text-[15px] font-bold">없는 페이지</h1>
      <p className="text-[13px] text-muted-foreground">주소가 바뀌었거나 잘못 들어옴</p>
      <Link
        href="/"
        className="mt-2.5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition-[background-color,scale] active:scale-[0.96]"
      >
        홈으로
      </Link>
    </section>
  );
}
