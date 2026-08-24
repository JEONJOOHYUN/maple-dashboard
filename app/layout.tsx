import type { Metadata } from "next";
import "./globals.css";
import { NavTabs } from "@/components/nav-tabs";

export const metadata: Metadata = {
  title: "메이플 대시보드",
  description: "메이플스토리 부주 사냥 수익 정산 및 누적 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <header className="bg-white">
          <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8">
            <h1 className="text-lg font-bold text-slate-900">
              메이플 대시보드
            </h1>
          </div>
          <NavTabs />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
