"use client";

import { assets } from "@/api/assets";
import { isApiError } from "@/api/client";
import type { AssetHistoryEvent } from "@/api/types";
import { CalendarIcon, ChevronLeftIcon, TransferIcon, WrenchIcon } from "@/components/icons";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { TagQr } from "@/components/ui/qr";
import { useToast } from "@/components/ui/toast";
import { fmtCost, fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const EVENT_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  ALLOCATED: "Allocated",
  RETURNED: "Returned",
  TRANSFERRED: "Transferred",
  MAINT_RAISED: "Maintenance raised",
  MAINT_APPROVED: "Maintenance approved",
  MAINT_RESOLVED: "Maintenance resolved",
  AUDIT_VERIFIED: "Audit — verified",
  AUDIT_MISSING: "Audit — flagged missing",
  AUDIT_DAMAGED: "Audit — flagged damaged",
  AUDIT_LOST: "Marked lost by audit",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
};

const EVENT_DOT: Record<string, string> = {
  ALLOCATED: "#2E90FA",
  RETURNED: "#17B26A",
  TRANSFERRED: "#2E90FA",
  MAINT_RAISED: "#F79009",
  MAINT_APPROVED: "#7A5AF8",
  MAINT_RESOLVED: "#17B26A",
  AUDIT_MISSING: "#F04438",
  AUDIT_LOST: "#F04438",
  AUDIT_DAMAGED: "#F79009",
};

function Timeline({ events }: { events: AssetHistoryEvent[] }) {
  // Grouped by date; each event carries actor + timestamp in mono.
  const groups = new Map<string, AssetHistoryEvent[]>();
  for (const e of events) {
    const day = fmtDate(e.occurredAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([day, dayEvents]) => (
        <div key={day}>
          <p className="mb-2 font-mono text-[11px] font-medium tracking-wider text-faint">{day.toUpperCase()}</p>
          <ul className="space-y-0">
            {dayEvents.map((e) => (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="relative flex w-3 shrink-0 justify-center">
                  <span className="absolute top-4 bottom-0 w-px bg-hairline" aria-hidden />
                  <span aria-hidden className="relative mt-1.5 h-2 w-2 rounded-full ring-2 ring-surface" style={{ backgroundColor: EVENT_DOT[e.eventType] ?? "#98A2B3" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{EVENT_LABEL[e.eventType] ?? e.eventType}</p>
                  {e.detail && <p className="text-[13px] text-muted">{e.detail}</p>}
                  <p className="mt-0.5 font-mono text-[11px] text-faint">
                    {fmtTime(e.occurredAt)}
                    {e.actorName ? ` · ${e.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"retire" | "dispose" | null>(null);

  const assetQuery = useQuery({ queryKey: ["asset", id], queryFn: () => assets.get(id), enabled: Number.isFinite(id) });
  const historyQuery = useQuery({ queryKey: ["asset-history", id], queryFn: () => assets.history(id), enabled: Number.isFinite(id) });
  const asset = assetQuery.data;

  const lifecycle = useMutation({
    mutationFn: (action: "retire" | "dispose") => (action === "retire" ? assets.retire(id) : assets.dispose(id)),
    onSuccess: (updated, action) => {
      qc.invalidateQueries({ queryKey: ["asset", id] });
      qc.invalidateQueries({ queryKey: ["asset-history", id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success(action === "retire" ? `${updated.assetTag} retired` : `${updated.assetTag} disposed`);
    },
    onError: (e) => toast.error("Couldn't update lifecycle", isApiError(e) ? e.direction : "Try again."),
  });

  if (assetQuery.isError) {
    return (
      <div className="rounded-lg border border-hairline bg-surface shadow-card">
        <EmptyState
          title="Asset not found"
          body="It may have been removed, or the link is stale."
          action={
            <Link href="/assets">
              <Button variant="secondary">Back to directory</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const meta: Array<[string, React.ReactNode]> = asset
    ? [
        ["Category", asset.categoryName ?? "—"],
        ["Serial", <span key="s" className="font-mono text-[13px]">{asset.serialNumber ?? "—"}</span>],
        ["Condition", asset.condition.charAt(0) + asset.condition.slice(1).toLowerCase()],
        ["Location", asset.location ?? "—"],
        ["Acquired", fmtDate(asset.acquisitionDate)],
        ["Cost", <span key="c" className="font-mono text-[13px] tabular-nums">{fmtCost(asset.acquisitionCost)}</span>],
        ["Bookable", asset.isBookable ? "Yes — shared resource" : "No"],
        ...Object.entries(asset.customValues ?? {}).map(
          ([field, value]): [string, React.ReactNode] => [
            field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
            typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
          ],
        ),
      ]
    : [];

  return (
    <>
      <Link href="/assets" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronLeftIcon size={14} /> All assets
      </Link>

      {/* Header: the tag as a physical label + QR */}
      <div className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
        {asset ? (
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <AssetTag tag={asset.assetTag} size="md" />
                <StatusChip domain="asset" status={asset.status} />
              </div>
              <h1 className="mt-2.5 text-2xl font-semibold tracking-tight">{asset.name}</h1>
              {asset.currentHolder && (
                <p className="mt-1 text-sm text-muted">
                  Held by <span className="font-medium text-ink">{asset.currentHolder.name}</span>
                  {asset.currentHolder.since && <> since {fmtDate(asset.currentHolder.since)}</>}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {hasRole(...MANAGERS) && asset.status === "AVAILABLE" && (
                  <Link href={`/allocations?allocate=${asset.id}`}>
                    <Button size="sm">
                      <TransferIcon size={14} /> Allocate
                    </Button>
                  </Link>
                )}
                {asset.isBookable && (
                  <Link href={`/bookings?resource=${asset.id}`}>
                    <Button size="sm" variant="secondary">
                      <CalendarIcon size={14} /> Book a slot
                    </Button>
                  </Link>
                )}
                <Link href={`/maintenance?raise=1&asset=${asset.id}`}>
                  <Button size="sm" variant="secondary">
                    <WrenchIcon size={14} /> Raise maintenance
                  </Button>
                </Link>
                {hasRole(...MANAGERS) && asset.status === "AVAILABLE" && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm("retire")}>
                    Retire
                  </Button>
                )}
                {hasRole(...MANAGERS) && asset.status === "RETIRED" && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm("dispose")}>
                    Dispose
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TagQr value={asset.assetTag} size={96} />
              <p className="font-mono text-[10px] tracking-widest text-faint">SCAN → TAG</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Metadata */}
        <section className="lg:col-span-2 rounded-lg border border-hairline bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold">Details</h2>
          {asset ? (
            <dl className="divide-y divide-hairline">
              {meta.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="text-right text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5" />
              ))}
            </div>
          )}
        </section>

        {/* History timeline */}
        <section className="lg:col-span-3 rounded-lg border border-hairline bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold">History</h2>
          {historyQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            <Timeline events={historyQuery.data} />
          ) : (
            <EmptyState title="No history yet" body="Allocations, maintenance and audit events will build this asset's paper trail." />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirm === "retire"}
        onClose={() => setConfirm(null)}
        onConfirm={() => lifecycle.mutateAsync("retire")}
        title={`Retire ${asset?.assetTag}?`}
        body="Retired assets leave circulation and can no longer be allocated or booked. You can dispose of them later."
        confirmLabel="Retire asset"
        tone="danger"
      />
      <ConfirmDialog
        open={confirm === "dispose"}
        onClose={() => setConfirm(null)}
        onConfirm={() => lifecycle.mutateAsync("dispose")}
        title={`Dispose of ${asset?.assetTag}?`}
        body={`This is the end of the line — disposal is permanent and the record stays for audit history. Last known: ${asset ? fmtDateTime(asset.updatedAt ?? asset.createdAt ?? null) : ""}`}
        confirmLabel="Dispose"
        tone="danger"
      />
    </>
  );
}
