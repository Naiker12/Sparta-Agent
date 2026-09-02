"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";

export function CodeViewerModal({
  open,
  onOpenChange,
  title,
  language,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  language: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(84dvh,960px)] max-w-[min(92vw,1100px)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-5 py-3 pr-14">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">{title}</DialogTitle>
            <div className="mt-1 text-xs text-muted-foreground">{language}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </DialogHeader>
        <div className="min-h-0 bg-muted/15">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
