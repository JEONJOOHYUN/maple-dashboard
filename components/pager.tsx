"use client";

import { useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { pageRange, pageSlots } from "@/lib/pager";

/**
 * Which page of a long list is shown. `key` = what is listed (the sort and the filters): a new list opens on its
 * first page, and coming back to a sort or a filter used before does too.
 */
export function usePage(key: string, total: number, size: number) {
  const [state, setState] = useState({ key, page: 1 });
  // A state reset during render, as React allows for a value that follows a prop.
  if (state.key !== key) setState({ key, page: 1 });
  return { ...pageRange(state.key === key ? state.page : 1, total, size), go: (page: number) => setState({ key, page }) };
}

/**
 * Page numbers under a list; nothing when it fits one page. `anchor` = something at the head of the list: the
 * numbers sit under the list, so a new page would otherwise open scrolled to its end.
 */
export function Pager({
  page,
  pages,
  onPage,
  anchor,
  className,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  anchor?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  if (pages <= 1) return null;
  const go = (next: number) => {
    onPage(next);
    // Only moves when the head of the list has scrolled out of sight.
    anchor?.current?.scrollIntoView({ block: "nearest" });
  };
  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink aria-label="이전 페이지" disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeft />
          </PaginationLink>
        </PaginationItem>
        {pageSlots(page, pages).map((p, i) => (
          <PaginationItem key={p || `gap${i}`}>
            {p ? (
              <PaginationLink aria-label={`${p}페이지`} isActive={p === page} onClick={() => go(p)} className="tabular-nums">
                {p}
              </PaginationLink>
            ) : (
              <PaginationEllipsis />
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink aria-label="다음 페이지" disabled={page >= pages} onClick={() => go(page + 1)}>
            <ChevronRight />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
