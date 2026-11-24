import { SteadyText } from "@/components/ui/steady-text";
import { cn } from "@/lib/utils";

/**
 * Underlined tabs that switch what a page shows under them: the views of 강화 기록, the accounts of 숙제 현황.
 * Kept in a file of its own, so a page that uses it does not load the rest of another page's parts.
 */
export function ViewTabs<T extends string>({ views, value, onChange, label }: { views: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            // The ring is drawn inside: the scrolling row would cut one drawn outside.
            "h-10 shrink-0 px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
            value === v.id ? "font-bold text-primary-text shadow-[inset_0_-2px_0_var(--primary)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SteadyText>{v.label}</SteadyText>
        </button>
      ))}
    </div>
  );
}
