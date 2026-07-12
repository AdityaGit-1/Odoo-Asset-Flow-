"use client";

import { assets } from "@/api/assets";
import { MOCKS_ENABLED } from "@/api/client";
import { notifications } from "@/api/notifications";
import type { NotificationItem } from "@/api/types";
import { ROLE_LABEL } from "@/api/types";
import { BellIcon, ChevronDownIcon, LogOutIcon, MenuIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { AssetTag } from "@/components/ui/asset-tag";
import { StatusChip } from "@/components/ui/status-chip";
import { fmtRelative } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { notificationHref, useNotifications } from "./use-notifications";

/** Close-on-outside-click for the topbar popovers. */
function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useDismiss(open, () => setOpen(false));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["asset-search", debounced],
    queryFn: () => assets.list({ q: debounced, size: 8 }),
    enabled: debounced.length >= 2,
  });

  const results = debounced.length >= 2 ? data?.content : undefined;

  const go = (id: number) => {
    setOpen(false);
    setTerm("");
    router.push(`/assets/${id}`);
  };

  return (
    <div ref={ref} className="relative hidden w-full max-w-sm md:block">
      <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && !!results}
        aria-label="Search assets"
        placeholder="Search assets by tag, name, serial…"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results?.[0]) go(results[0].id);
        }}
        className="h-9 w-full rounded-lg border border-hairline bg-paper pl-9 pr-3 text-sm placeholder:text-faint focus:bg-surface"
      />
      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-hairline bg-surface shadow-pop animate-scale-in">
          {results && results.length > 0 ? (
            <ul>
              {results.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => go(a.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-hover"
                  >
                    <AssetTag tag={a.assetTag} />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <StatusChip domain="asset" status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted">{isFetching ? "Searching…" : `No assets match "${debounced}"`}</p>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { data, unread } = useNotifications();
  const qc = useQueryClient();
  const router = useRouter();

  const markRead = useMutation({
    mutationFn: (id: number) => notifications.markRead(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openItem = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    router.push(notificationHref(n.refType, n.refId));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications — ${unread} unread` : "Notifications"}
        className="relative rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 font-mono text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-hairline bg-surface shadow-pop animate-scale-in">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <span className="text-xs text-muted">{unread} unread</span>}
          </div>
          <ul className="max-h-96 overflow-y-auto scrollbar-thin">
            {(data ?? []).slice(0, 8).map((n) => (
              <li key={n.id} className="border-b border-hairline last:border-0">
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn("flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-hover", !n.isRead && "bg-cobalt-050/50")}
                >
                  <span aria-hidden className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.isRead ? "bg-hairline" : "bg-cobalt-500")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-ink">{n.message}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">{fmtRelative(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {(data ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing yet — actions that concern you land here.</li>}
          </ul>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-hairline px-4 py-2.5 text-center text-[13px] font-medium text-cobalt-600 hover:bg-hover"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const router = useRouter();
  if (!user) return null;

  const resetDemo = async () => {
    const { resetMockDb } = await import("@/api/mock/db");
    resetMockDb();
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-hover"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cobalt-050 text-xs font-semibold text-cobalt-700">
          {initials(user.name ?? user.email)}
        </span>
        <ChevronDownIcon size={14} className="hidden text-faint sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-hairline bg-surface shadow-pop animate-scale-in">
          <div className="border-b border-hairline px-4 py-3">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-md bg-cobalt-050 px-1.5 py-0.5 text-[11px] font-medium text-cobalt-700">
              {ROLE_LABEL[user.role]}
            </span>
          </div>
          {MOCKS_ENABLED && (
            <button type="button" onClick={resetDemo} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-muted hover:bg-hover">
              <RefreshIcon size={15} /> Reset demo data
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2.5 border-t border-hairline px-4 py-2.5 text-left text-sm text-muted hover:bg-hover"
          >
            <LogOutIcon size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-muted hover:bg-hover lg:hidden">
        <MenuIcon size={18} />
      </button>
      <GlobalSearch />
      <div className="flex-1" />
      <NotificationBell />
      <UserMenu />
    </header>
  );
}
