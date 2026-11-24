import { cn } from "@/lib/utils";

/**
 * Short facts on one line with " · " between them ("스카니아 · 2026-11-24 등록"). Each fact stays in one piece, and
 * where the line has to break the next one starts without the dot: every fact carries its dot in front, and the
 * row is pulled left by the dot's width so the first dot of each line falls outside the clipped box.
 */
export function DotLine({ parts, className }: { parts: (string | false | null | undefined)[]; className?: string }) {
  return (
    <span className={cn("block overflow-hidden", className)}>
      <span className="-ml-3 flex flex-wrap">
        {parts.filter((part): part is string => !!part).map((part) => (
          <span key={part} className="whitespace-nowrap before:inline-block before:w-3 before:text-center before:content-['·']">
            {part}
          </span>
        ))}
      </span>
    </span>
  );
}
