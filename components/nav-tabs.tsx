"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/tools";

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-8">
        <Link
          href="/"
          className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
            pathname === "/"
              ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          홈
        </Link>
        {tools.map((tool) => {
          const active = pathname.startsWith(tool.href);
          return (
            <Link
              key={tool.slug}
              href={tool.href}
              className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {tool.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
