import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";

/**
 * A page whose content is on the way: its title and one line. For the `loading.tsx` of the pages rendered per
 * request, so a press on their link shows this at once instead of the old page.
 */
export function PageWaiting({ title, note = "불러오는 중…" }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={title} />
      <div className="flex items-center justify-center gap-2 tile px-5 py-10 text-[13px] text-muted-foreground" aria-live="polite">
        <Spinner /> {note}
      </div>
    </div>
  );
}
