"use client";

import { cn } from "@/lib/utils";
import { XIcon } from "@/components/icons";
import { Button } from "./button";
import { useOverlay } from "./modal";
import type { ReactNode } from "react";

/** Right-side detail/edit surface. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="fixed inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 right-0 flex w-full flex-col bg-surface shadow-overlay animate-slide-in-right",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
