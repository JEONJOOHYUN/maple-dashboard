"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버-클라이언트 하이드레이션 불일치를 피하기 위해 마운트 이후에만 실제 테마를 반영합니다.
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-10" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {isDark ? (
        <Sun className="size-[17px]" aria-hidden="true" />
      ) : (
        <Moon className="size-[17px]" aria-hidden="true" />
      )}
    </button>
  );
}
