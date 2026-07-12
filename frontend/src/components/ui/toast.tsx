"use client";

import { cn, nextUid } from "@/lib/utils";
import { AlertTriangleIcon, CheckIcon, InfoIcon, XIcon } from "@/components/icons";
import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: string;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
}

interface ToastApi {
  success: (title: string, body?: string, link?: { href: string; label: string }) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

const toneIcon = {
  success: <CheckIcon size={14} className="text-[#17B26A]" />,
  error: <AlertTriangleIcon size={14} className="text-danger-500" />,
  info: <InfoIcon size={14} className="text-cobalt-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = nextUid("toast");
      setItems((xs) => [...xs.slice(-3), { ...item, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), item.kind === "error" ? 8000 : 5000));
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (title, body, link) => push({ kind: "success", title, body, href: link?.href, hrefLabel: link?.label }),
    error: (title, body) => push({ kind: "error", title, body }),
    info: (title, body) => push({ kind: "info", title, body }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-3 shadow-pop animate-slide-up",
              t.kind === "error" ? "border-danger-500/40" : "border-hairline",
            )}
          >
            <span className="mt-0.5 shrink-0">{toneIcon[t.kind]}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-muted">{t.body}</p>}
              {t.href && (
                <Link href={t.href} onClick={() => dismiss(t.id)} className="mt-1 inline-block text-[13px] font-medium text-cobalt-600 hover:text-cobalt-500">
                  {t.hrefLabel ?? "View"}
                </Link>
              )}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-faint hover:text-ink">
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
