"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "원본 그림": the picture of NEXON's Sunday notice itself, in a window (user, 2026-11-13). It has what the list of
 * benefits leaves out — the conditions under each one. The picture is long (876 × 2,379 on 2026-11-15, 800 KB), so
 * it is neither a thumbnail nor a hover preview: it opens on a press, at a width it can be read at, and scrolls.
 * It is NEXON's own address, asked for only when the window opens (never stored or resized by us).
 */
export function NoticeImage({ images, label, className }: { images: string[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (images.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1 rounded-sm font-semibold text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50", className)}
      >
        <ImageIcon className="size-3.5" aria-hidden="true" />
        원본 그림
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3 pr-12">
            <DialogTitle className="text-base leading-tight font-bold">썬데이 메이플 원본 그림</DialogTitle>
            <DialogDescription className="text-xs">{label} · 넥슨 공지</DialogDescription>
          </div>
          <div className="overflow-y-auto bg-muted">
            {images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element -- NEXON's notice picture, shown as is (never stored or resized by us)
              <img key={src} src={src} alt={`${label} 썬데이 메이플 공지 그림`} className="block w-full" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
