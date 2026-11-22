import { MoreLink } from "@/components/home/more-link";
import type { NewsLine } from "@/lib/home/news-parse";

/** One of NEXON's notice lists on the home page: titles with their dates, each opening the notice on NEXON's site. */
export function NewsList({ title, more, lines }: { title: string; more: string; lines: NewsLine[] }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col tile px-4 pt-4 pb-2 sm:px-5 sm:pt-5 sm:pb-3">
      <div className="flex min-h-7 items-center justify-between gap-2 pb-1">
        <h2 className="text-[15px] font-bold whitespace-nowrap">{title}</h2>
        <MoreLink href={more} />
      </div>
      {lines.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">새 글 없음</p>}
      <ul>
        {lines.map((line) => (
          <li key={line.id}>
            {/* The row's hover fill reaches 8px past the text on both sides, so the text itself stays on the card's edge.
                A title cut short shows whole in the browser's own tooltip. */}
            <a
              href={line.url}
              target="_blank"
              rel="noreferrer"
              title={line.title}
              className="-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 py-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 truncate">{line.title}</span>
              <span className="min-w-[3.75rem] shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground">{line.date}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
