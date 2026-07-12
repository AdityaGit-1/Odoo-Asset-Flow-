"use client";

import { assets as assetsApi } from "@/api/assets";
import { bookings as bookingsApi } from "@/api/bookings";
import { isApiError } from "@/api/client";
import type { Booking } from "@/api/types";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { BookModal, type BookModalState } from "@/components/bookings/book-modal";
import { addDays, BookingCalendar, startOfWeek } from "@/components/bookings/calendar";
import { PageHeader } from "@/components/shell/page-header";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { fmtSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export default function BookingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [resourceId, setResourceId] = useState<number | null>(null);
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [modal, setModal] = useState<BookModalState | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  // Bookable resources drive the whole screen.
  const resourcesQuery = useQuery({
    queryKey: ["assets", "bookable"],
    queryFn: () => assetsApi.list({ bookable: true, size: 100, sort: "assetTag,asc" }),
  });
  const resources = useMemo(() => resourcesQuery.data?.content ?? [], [resourcesQuery.data]);

  // Default to the first resource; honor ?resource= and ?book=1 deep links.
  useEffect(() => {
    if (resources.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    const wanted = Number(sp.get("resource"));
    setResourceId((cur) => cur ?? (resources.some((r) => r.id === wanted) ? wanted : resources[0]!.id));
    if (sp.get("book") === "1") {
      setModal((m) => m ?? { resourceId: resources.some((r) => r.id === wanted) ? wanted : resources[0]!.id });
      sp.delete("book");
    }
  }, [resources]);

  const days = useMemo(() => {
    if (view === "day") {
      const d = new Date(anchor);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
    const ws = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [anchor, view]);

  const from = days[0]!.toISOString();
  const to = addDays(days[days.length - 1]!, 1).toISOString();

  const bookingsQuery = useQuery({
    queryKey: ["bookings", resourceId, from, to],
    queryFn: () => bookingsApi.list({ resourceId: resourceId!, from, to }),
    enabled: resourceId !== null,
    refetchInterval: 30_000,
  });

  const myBookingsQuery = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => bookingsApi.list({ mine: true }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.cancel(id),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Booking cancelled", `${fmtSlot(b.start, b.end)} on ${b.resource?.name ?? "the resource"} is free again.`);
    },
    onError: (e) => toast.error("Couldn't cancel", isApiError(e) ? e.direction : "Try again."),
  });

  const selected = resources.find((r) => r.id === resourceId);
  const rangeLabel =
    view === "day"
      ? days[0]!.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
      : `${days[0]!.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6]!.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const myColumns: Column<Booking>[] = [
    {
      key: "resource",
      header: "Resource",
      render: (b) => (
        <span className="flex items-center gap-2">
          <AssetTag tag={b.resource?.assetTag ?? `#${b.resourceId}`} />
          <span className="hidden truncate sm:inline">{b.resource?.name}</span>
        </span>
      ),
    },
    { key: "slot", header: "Slot", mono: true, render: (b) => fmtSlot(b.start, b.end) },
    { key: "status", header: "Status", render: (b) => <StatusChip domain="booking" status={b.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (b) =>
        b.status === "UPCOMING" ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setModal({ reschedule: b })}>
              Reschedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>
              Cancel
            </Button>
          </span>
        ) : b.status === "ONGOING" ? (
          <Button size="sm" variant="ghost" onClick={() => setCancelling(b)}>
            End early
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        sub="Shared resources — rooms, kit, pool vehicles. Slots are [start, end): back-to-back never clashes."
        actions={
          <Button onClick={() => setModal({ resourceId: resourceId ?? undefined })} disabled={resources.length === 0}>
            <PlusIcon size={15} /> Book slot
          </Button>
        }
      />

      {resources.length === 0 && !resourcesQuery.isLoading ? (
        <div className="rounded-lg border border-hairline bg-surface p-10 text-center shadow-card">
          <p className="text-sm font-medium">No bookable resources yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
            Mark an asset as a shared bookable resource when registering it, and it will show up here with a calendar.
          </p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Resource"
              className="w-auto min-w-52 font-medium"
              value={resourceId ?? ""}
              onChange={(e) => setResourceId(Number(e.target.value))}
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.assetTag} · {r.name}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface p-0.5">
              {(["day", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium capitalize", view === v ? "bg-cobalt-050 text-cobalt-700" : "text-muted hover:text-ink")}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" aria-label="Previous" onClick={() => setAnchor((a) => addDays(a, view === "day" ? -1 : -7))}>
                <ChevronLeftIcon size={14} />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
              <Button variant="secondary" size="sm" aria-label="Next" onClick={() => setAnchor((a) => addDays(a, view === "day" ? 1 : 7))}>
                <ChevronRightIcon size={14} />
              </Button>
            </div>
            <p className="ml-1 text-sm font-medium text-muted">{rangeLabel}</p>
          </div>

          {/* The calendar — overlap-free by construction, click a slot to book it. */}
          <BookingCalendar
            days={days}
            bookings={bookingsQuery.data ?? []}
            onSlotClick={(start) => setModal({ resourceId: resourceId ?? undefined, start })}
            onBookingClick={(b) => {
              if (b.status === "UPCOMING" && (b.bookedBy === user?.employeeId || user?.role === "ADMIN" || user?.role === "ASSET_MANAGER")) {
                setModal({ reschedule: b });
              }
            }}
          />
          {selected && (
            <p className="mt-2 text-xs text-faint">
              Click an empty slot on {selected.name} to book it. Your own upcoming blocks open for rescheduling.
            </p>
          )}

          {/* My bookings — cancelled shows struck-through, per the status system. */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">My bookings</h2>
            <DataTable
              columns={myColumns}
              rows={myBookingsQuery.data?.slice(0, 12)}
              rowKey={(b) => b.id}
              loading={myBookingsQuery.isLoading}
              empty={{
                title: "No bookings yet",
                body: "Pick a resource above and click a free slot — it's yours.",
                action: (
                  <Button onClick={() => setModal({ resourceId: resourceId ?? undefined })}>
                    <PlusIcon size={15} /> Book a slot
                  </Button>
                ),
              }}
            />
          </section>
        </>
      )}

      <BookModal state={modal} onClose={() => setModal(null)} resources={resources} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelMutation.mutateAsync(cancelling!.id)}
        title="Cancel this booking?"
        body={
          cancelling
            ? `${cancelling.resource?.name ?? "The resource"} · ${fmtSlot(cancelling.start, cancelling.end)} — the slot frees up immediately for anyone else.`
            : ""
        }
        confirmLabel="Cancel booking"
        tone="danger"
      />
    </>
  );
}
