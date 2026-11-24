import { PageWaiting } from "@/components/page-waiting";

/** Shown the moment the link is pressed, while the login is checked and NEXON is asked (./page.tsx). */
export default function Loading() {
  return <PageWaiting title="숙제 현황" note="숙제를 불러오는 중…" />;
}
