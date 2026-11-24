"use client";

import { Fragment, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Digits } from "@/components/ui/digits";
import { SwapLabel } from "@/components/ui/swap-icon";

// The order of NEXON's own registration page (마이 페이지 → 애플리케이션 등록, seen 2026-11-12).
const STEPS = [
  <>
    <b>애플리케이션 등록</b> 열기 → 넥슨 계정 로그인
  </>,
  <>
    약관 동의 → 게임 <b>메이플스토리</b> → <b>서비스 단계</b> 선택
  </>,
  <>
    아래 내용 입력 → <b>등록</b>
  </>,
  <>
    애플리케이션 목록 → <b>API Key 복사</b> → 왼쪽 칸에 붙여 넣기
  </>,
];
/** Signed out, NEXON sends this to its sign-in page and back (checked 2026-11-12). */
const REGISTER_URL = "https://openapi.nexon.com/ko/my-application/create-app/";
/** The application list, where an existing key is copied (same sign-in round trip, checked 2026-11-17). */
const LIST_URL = "https://openapi.nexon.com/ko/my-application/";

// What the service-stage form asks for (user, 2026-11-12: visitors register a service-stage application, as other
// record sites have them do — 500 calls a second and 20,000,000 a day instead of 5 and 1,000).
const SITE_URL = "https://maple-dashboard-eta.vercel.app";
const FILL: { label: string; value: string; copy: boolean }[] = [
  // Not preselected on NEXON's form (user, 2026-11-12).
  { label: "대표 언어", value: "한국어(ko)", copy: false },
  // The same name as the URL and the description point to (user, 2026-11-12: with the service stage it is our service).
  { label: "서비스명", value: "메이플 대시보드", copy: true },
  { label: "서비스 설명", value: "메이플 대시보드에서 내 계정의 스타포스 · 잠재능력 강화 기록과 주간 보스 현황을 조회하는 용도입니다.", copy: true },
  { label: "개발 환경", value: "Web", copy: false },
  { label: "URL", value: SITE_URL, copy: true },
  // Tags, the image and the screenshots are optional (user registered without them, 2026-11-12): not listed.
];
/** The step the values above belong under (0-based). */
const FILL_STEP = 2;

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${label} 복사`}
      onClick={() => {
        // Blocked clipboards (some in-app browsers) just leave the text to be selected by hand.
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {}
        );
      }}
      // The `after` box widens the 28px button to the finger without touching the copy button of the next row.
      className="relative inline-flex h-7 items-center rounded-md tile-edge bg-background pr-2 pl-1.5 text-[11px] font-semibold whitespace-nowrap text-foreground outline-none after:absolute after:-inset-x-2 after:-inset-y-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {/* Both states sit on top of each other: the button, and the grid column it is in, keep one width. */}
      <SwapLabel
        on={done}
        className="[&>span]:gap-1"
        from={
          <>
            <Copy className="size-3" aria-hidden="true" />
            복사
          </>
        }
        to={
          <>
            <Check className="size-3 text-primary-text" aria-hidden="true" />
            복사됨
          </>
        }
      />
    </button>
  );
}

/**
 * "API 키 받는 법": the box next to every form that takes a NEXON API key (강화 기록 · 보스 수익 · 내 정보).
 * `have` = what a visitor who already has a key is told (after "이미 키가 있으면 →").
 */
export function KeyGuide({ have = "새로 안 받아도 됨 · 다른 메이플 서비스 키도 가능" }: { have?: string }) {
  return (
    // The corners and the edge of the form next to it; the fill stays the quieter one.
    <section className="flex flex-col gap-3 rounded-[1rem] tile-edge bg-muted p-5 lg:p-7">
      <h2 className="font-heading text-base font-bold">API 키 받는 법</h2>
      {STEPS.map((step, i) => (
        <Fragment key={i}>
          <p className="flex gap-2.5 text-[13px] leading-relaxed">
            {/* 20px wide whatever the digits: with the 10px gap the words start 30px in, where the link under step 01 starts. */}
            <b className="w-5 shrink-0 font-num text-primary-text">
              <Digits>{`0${i + 1}`}</Digits>
            </b>
            <span>{step}</span>
          </p>
          {i === 0 && (
            <a
              href={REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-[30px] inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              애플리케이션 등록 열기 (openapi.nexon.com)
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {/* Up here, not in small print at the bottom (user, 2026-11-17: hard to see). A key made for another
              MapleStory service works too (user, 2026-11-15; other games' keys do not). */}
          {i === 0 && (
            // Same left edge and width as step 03's box (user, 2026-11-17: the boxes of one list line up).
            <div className="flex flex-col gap-1 tile-sm px-3 py-2.5 text-[13px] leading-relaxed">
              <span>
                <b>이미 키가 있으면</b> → {have}
              </span>
              <a
                href={LIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 self-start font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                애플리케이션 목록 열기 → API Key 복사
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
          {i === FILL_STEP && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 tile-sm px-3 py-2.5 text-xs">
              {FILL.map((f) => (
                <Fragment key={f.label}>
                  <dt className="whitespace-nowrap text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 leading-relaxed [overflow-wrap:anywhere]">{f.value}</dd>
                  {f.copy ? <CopyButton label={f.label} text={f.value} /> : <span />}
                </Fragment>
              ))}
            </dl>
          )}
        </Fragment>
      ))}
      <p className="text-xs leading-relaxed text-muted-foreground">개발 단계로 받은 키도 가능 → 하루 1,000건 · 느리게 받음</p>
    </section>
  );
}
