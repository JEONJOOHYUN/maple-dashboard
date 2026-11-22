"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { SwapIcon } from "@/components/ui/swap-icon";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // The frame that lets transitions back in after a switch; a second press restarts the wait.
  const settle = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버-클라이언트 하이드레이션 불일치를 피하기 위해 마운트 이후에만 실제 테마를 반영합니다.
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-10" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";
  // Every colour on the page changes in the same frame (globals.css `theme-switching`) instead of each button fading at
  // its own pace. Two frames later hover and press ease again.
  const switchTheme = () => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    setTheme(isDark ? "light" : "dark");
    cancelAnimationFrame(settle.current);
    settle.current = requestAnimationFrame(() => {
      settle.current = requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });
  };

  return (
    <button
      type="button"
      data-theme-toggle=""
      onClick={switchTheme}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="flex size-10 items-center justify-center rounded-xl bg-card text-foreground transition-[background-color,scale] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
    >
      <SwapIcon on={!isDark} from={<Sun className="size-[17px]" aria-hidden="true" />} to={<Moon className="size-[17px]" aria-hidden="true" />} />
    </button>
  );
}
