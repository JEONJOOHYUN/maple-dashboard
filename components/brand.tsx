import Link from "next/link";
import { cn } from "@/lib/utils";

/** Orange square logo mark + site name (redesign A). */
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center rounded-lg font-heading font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "gap-2 text-[15px]" : "gap-2.5 text-[17px]",
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
          compact ? "size-7 rounded-[7px]" : "size-8 rounded-lg"
        )}
      >
        <svg
          width={compact ? 15 : 18}
          height={compact ? 15 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={compact ? 2.4 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2l2.2 4.6 4.8-1.4-1.6 4.6 4.6 2.2-4.6 2.2 1.6 4.6-4.8-1.4L12 22l-2.2-4.6-4.8 1.4 1.6-4.6L2 12l4.6-2.2L5 5.2l4.8 1.4z" />
        </svg>
      </span>
      메이플 대시보드
    </Link>
  );
}
