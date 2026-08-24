import Link from "next/link";
import { tools } from "@/lib/tools";

export default function Home() {
  return (
    <div>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        메이플스토리 관련 도구 모음입니다. 아래에서 원하는 도구를 선택하세요.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={tool.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{tool.label}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
