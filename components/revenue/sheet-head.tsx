"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Face } from "@/components/revenue/face";
import { sheetIcon } from "@/components/revenue/styles";
import { SheetClose, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * The head of a character's side sheet: face, name, one line under it (`children`), previous / next when there is more
 * than one character, close. Shared by boss revenue and homework.
 */
export function SheetHead({ face, name, children, index, count, onStep }: { face?: string; name: string; children: ReactNode; index: number; count: number; onStep: (step: number) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 pr-2.5 pl-4 lg:pl-5">
      <Face src={face} name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SheetTitle className="truncate text-[17px] font-bold">{name}</SheetTitle>
        <SheetDescription className="truncate text-[13px]">{children}</SheetDescription>
      </div>
      {count > 1 && (
        <div className="flex shrink-0 items-center">
          <button type="button" aria-label="이전 캐릭터" onClick={() => onStep(-1)} className={sheetIcon}>
            <ChevronLeft className="size-[18px]" aria-hidden="true" />
          </button>
          <span className="min-w-9 text-center font-num text-[13px] text-muted-foreground">
            {index + 1} / {count}
          </span>
          <button type="button" aria-label="다음 캐릭터" onClick={() => onStep(1)} className={sheetIcon}>
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      )}
      <SheetClose className={sheetIcon} aria-label="닫기">
        <X className="size-[18px]" aria-hidden="true" />
      </SheetClose>
    </div>
  );
}
