import type { Metadata } from "next";
import localFont from "next/font/local";
// Body and titles: Pretendard, official dynamic subset (92 unicode-range slices;
// the browser fetches only the slices a page uses). License: fonts/Pretendard/LICENSE.txt
import "../fonts/Pretendard/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { Clarity } from "@/components/clarity";
import { SideNav } from "@/components/side-nav";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

// Big numbers only (font-num). Official NEXON files, unmodified (license: fonts/Maplestory/LICENSE.md).
// unicode-range keeps it to ASCII so units like 억 or 명 fall through to Pretendard
// (Maplestory Korean read too heavy, user decision 2026-11-08).
// Not preloaded: ~690KB per weight, and Light is not used yet.
const maple = localFont({
  variable: "--font-maple",
  src: [
    { path: "../fonts/Maplestory/Maplestory OTF Light.otf", weight: "300", style: "normal" },
    { path: "../fonts/Maplestory/Maplestory OTF Bold.otf", weight: "700", style: "normal" },
  ],
  declarations: [{ prop: "unicode-range", value: "U+0020-007E" }],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "메이플 대시보드",
    template: "%s · 메이플 대시보드",
  },
  description: "메이플스토리 내 수익 기록, 보스 분배금 · 강화 기댓값 계산기 모음",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning className={maple.variable}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-dvh">
            <SideNav />
            <div className="flex min-w-0 flex-1 flex-col">
              <SiteHeader />
              <main className="flex-1 px-4 pt-[18px] pb-7 lg:px-8 lg:pt-7 lg:pb-9">
                <div className="mx-auto w-full max-w-6xl">{children}</div>
                {/* Nexon IP guide · Open API terms ask for these notices (brain wiki/research/nexon-ip-guide.md). */}
                <p className="mx-auto mt-10 w-full max-w-6xl text-[11px] text-muted-foreground lg:hidden">
                  MapleStory © NEXON Korea · Data based on NEXON Open API · 넥슨과 관계없는 비공식 팬 사이트예요
                </p>
              </main>
            </div>
          </div>
        </ThemeProvider>
        <Clarity />
      </body>
    </html>
  );
}
