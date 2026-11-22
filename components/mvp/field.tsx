import type { ReactNode } from "react";

/**
 * One setting: name on the left, control on the right, always 40 px high. A <label>, so pressing the name focuses the
 * field. `as="span"` is for a control that is a row of buttons: in a label, pressing the name would press the first
 * button and that button would be read out under the name of the whole row.
 */
export function Field({ label, as: Tag = "label", children }: { label: string; as?: "label" | "span"; children: ReactNode }) {
  return (
    // Corner 14 = the field inside (10) + the 4px between them.
    <Tag className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-background pr-1 pl-3 text-[13px] text-muted-foreground">
      <span className="truncate" title={label}>
        {label}
      </span>
      {children}
    </Tag>
  );
}
