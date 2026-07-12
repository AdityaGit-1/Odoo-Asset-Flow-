"use client";

import { notifications as notifApi } from "@/api/notifications";
import type { NotificationItem } from "@/api/types";
import { BellIcon } from "@/components/icons";
import { notificationHref, useNotifications } from "@/components/shell/use-notifications";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const { data, isLoading, unread } = useNotifications();
  const qc = useQueryClient();
  const router = useRouter();

  const markRead = useMutation({
    mutationFn: (id: number) => notifApi.markRead(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const pending = (data ?? []).filter((n) => !n.isRead);
      await Promise.all(pending.map((n) => notifApi.markRead(n.id)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const open = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate(n.id);
    router.push(notificationHref(n.refType, n.refId));
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        sub={unread > 0 ? `${unread} unread` : "You're caught up"}
        actions={
          unread > 0 && (
            <Button variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <ul>
            {data.map((n) => (
              <li key={n.id} className="border-b border-hairline last:border-0">
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover", !n.isRead && "bg-cobalt-050/50")}
                >
                  <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-hairline" : "bg-cobalt-500")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", n.isRead ? "text-muted" : "font-medium text-ink")}>{n.message}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">{fmtDateTime(n.createdAt)}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {n.refType ?? "system"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<BellIcon size={18} />}
            title="Nothing yet"
            body="Assignments, approvals, booking reminders and overdue alerts land here as they happen."
          />
        )}
      </div>
    </>
  );
}
