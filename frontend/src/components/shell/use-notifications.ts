"use client";

import { notifications, subscribeToNotifications } from "@/api/notifications";
import { useAuth } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Notification list + live push (SSE / mock bus) with a polling fallback. */
export function useNotifications() {
  const { status } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: notifications.list,
    enabled: status === "authed",
    refetchInterval: 20_000, // fallback carries it when the stream drops
  });

  useEffect(() => {
    if (status !== "authed") return;
    return subscribeToNotifications(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [status, qc]);

  const unread = query.data?.filter((n) => !n.isRead).length ?? 0;
  return { ...query, unread };
}

/** Where a notification's subject lives. */
export function notificationHref(refType: string | null, refId: number | null): string {
  switch (refType) {
    case "asset": return refId ? `/assets/${refId}` : "/assets";
    case "booking": return "/bookings";
    case "maintenance": return "/maintenance";
    case "transfer": return "/allocations?tab=transfers";
    case "audit": return refId ? `/audits/${refId}` : "/audits";
    default: return "/notifications";
  }
}
