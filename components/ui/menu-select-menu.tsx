"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BELOW, FieldFace, fieldProps, NONE, type MenuSelectProps } from "@/components/ui/menu-select";
import { cn } from "@/lib/utils";

// The working half of MenuSelect, loaded on its own (see menu-select.tsx).
export default function MenuSelectMenu(props: MenuSelectProps) {
  const { value, onChange, options, menuClassName } = props;
  const key = (v: string) => v || NONE;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...fieldProps(props)}>
        <FieldFace {...props} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionAvoidance={BELOW} className={cn("max-h-[min(20rem,var(--available-height))] w-auto min-w-(--anchor-width)", menuClassName)}>
        <DropdownMenuRadioGroup value={key(value)} onValueChange={(next) => onChange(next === NONE ? "" : String(next))}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={key(o.value)} closeOnClick>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
