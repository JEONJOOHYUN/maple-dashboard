import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NavTabs } from "@/components/nav-tabs";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const paperlogy = localFont({
  variable: "--font-paperlogy",
  src: [
    { path: "../fonts/Paperlogy/Paperlogy-1Thin.ttf", weight: "100", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-2ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-3Light.ttf", weight: "300", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-4Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-5Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-6SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-7Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-8ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../fonts/Paperlogy/Paperlogy-9Black.ttf", weight: "900", style: "normal" },
  ],
  display: "swap",
});

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
    <html lang="ko" suppressHydrationWarning className={paperlogy.variable}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="bg-white dark:bg-slate-900">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 sm:px-8">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                메이플 대시보드
              </h1>
              <ThemeToggle />
            </div>
            <NavTabs />
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
