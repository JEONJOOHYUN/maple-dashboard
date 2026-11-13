import type { NewsLine } from "@/lib/home/news-parse";

/** One of NEXON's notice lists on the home page: titles with their dates, each opening the notice on NEXON's site. */
export function NewsList({ title, more, lines }: { title: string; more: string; lines: NewsLine[] }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col rounded-lg border border-border bg-card px-4 pt-2.5 pb-1.5 lg:px-[18px]">
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <a href={more} target="_blank" rel="noreferrer" className="rounded-sm py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          더 보기 →
        </a>
      </div>
      {lines.length === 0 && <p className="border-t border-border py-6 text-center text-[13px] text-muted-foreground">새 글 없음</p>}
      <ul>
        {lines.map((line) => (
          <li key={line.id} className="border-t border-border">
            <a href={line.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-sm py-2.5 text-[13.5px] outline-none hover:text-primary-text focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 truncate">{line.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{line.date}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
