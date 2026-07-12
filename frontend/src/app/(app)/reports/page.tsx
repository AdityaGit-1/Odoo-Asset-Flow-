"use client";

import { isApiError } from "@/api/client";
import { reports, type ExportableReport } from "@/api/reports";
import type { AssetUsage } from "@/api/types";
import { DownloadIcon } from "@/components/icons";
import { BookingHeatmapGrid, HBarChart, UtilizationChart } from "@/components/reports/charts";
import { PageHeader } from "@/components/shell/page-header";
import { RoleGate } from "@/components/shell/role-gate";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { fmtNumber } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function ExportButtons({ report }: { report: ExportableReport }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const run = async (fmt: "csv" | "xlsx") => {
    setBusy(fmt);
    try {
      await reports.export(report, fmt);
    } catch (e) {
      toast.error("Export failed", isApiError(e) ? e.direction : "Try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <span className="flex gap-1.5">
      <Button size="sm" variant="secondary" loading={busy === "csv"} onClick={() => run("csv")}>
        <DownloadIcon size={13} /> CSV
      </Button>
      <Button size="sm" variant="secondary" loading={busy === "xlsx"} onClick={() => run("xlsx")}>
        <DownloadIcon size={13} /> XLSX
      </Button>
    </span>
  );
}

function ReportCard({ title, sub, report, children }: { title: string; sub?: string; report: ExportableReport; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="text-[13px] text-muted">{sub}</p>}
        </div>
        <ExportButtons report={report} />
      </div>
      {children}
    </section>
  );
}

function UsageList({ title, rows, metric }: { title: string; rows: AssetUsage[]; metric: (u: AssetUsage) => string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-faint">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((u) => (
            <li key={u.assetId} className="flex items-center gap-2 py-1.5">
              <AssetTag tag={u.assetTag} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{u.name}</span>
              <span className="font-mono text-[11px] text-muted tabular-nums">{metric(u)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const utilization = useQuery({ queryKey: ["report-utilization"], queryFn: reports.utilization });
  const maintenance = useQuery({ queryKey: ["report-maintenance"], queryFn: reports.maintenanceFrequency });
  const summary = useQuery({ queryKey: ["report-allocation"], queryFn: reports.allocationSummary });
  const heatmap = useQuery({ queryKey: ["report-heatmap"], queryFn: reports.bookingHeatmap });

  return (
    <RoleGate roles={MANAGERS}>
      <PageHeader title="Reports" sub="Utilization, maintenance load, department footprint and booking pressure" />

      <div className="space-y-5">
        <ReportCard title="Asset utilization" sub="Share of the fleet on active allocation, weekly" report="utilization">
          {utilization.isLoading ? (
            <Skeleton className="h-48" />
          ) : utilization.data ? (
            <>
              <UtilizationChart points={utilization.data.trend} />
              <div className="mt-5 grid grid-cols-1 gap-6 border-t border-hairline pt-4 sm:grid-cols-2">
                <UsageList title="Most used" rows={utilization.data.mostUsed} metric={(u) => `${u.allocations}× · ${u.daysHeld}d held`} />
                <UsageList title="Idle 60+ days" rows={utilization.data.idle} metric={(u) => (u.allocations === 0 ? "never allocated" : `${u.allocations}× lifetime`)} />
              </div>
            </>
          ) : (
            <EmptyState title="No utilization data" body="Allocations feed this — none recorded yet." />
          )}
        </ReportCard>

        <ReportCard title="Maintenance frequency" sub="Requests by category, all time" report="maintenance-frequency">
          {maintenance.isLoading ? (
            <Skeleton className="h-40" />
          ) : maintenance.data && maintenance.data.length > 0 ? (
            <HBarChart rows={maintenance.data} unit="requests" />
          ) : (
            <EmptyState title="No maintenance recorded" body="Raised requests will aggregate here by category." />
          )}
        </ReportCard>

        <ReportCard title="Department allocation summary" sub="Active holdings per department" report="allocation-summary">
          {summary.isLoading ? (
            <Skeleton className="h-40" />
          ) : summary.data && summary.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    <th className="py-2 pr-3">Department</th>
                    <th className="px-3 py-2 text-right">Active allocations</th>
                    <th className="px-3 py-2 text-right">Assets held</th>
                    <th className="px-3 py-2 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.map((r) => (
                    <tr key={r.departmentId} className="border-b border-hairline last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.departmentName}</td>
                      <td className="px-3 py-2 text-right font-mono text-[13px] tabular-nums">{fmtNumber(r.activeAllocations)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[13px] tabular-nums">{fmtNumber(r.assetsHeld)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[13px] tabular-nums">
                        {r.overdue > 0 ? <span className="font-semibold text-danger-700">{r.overdue}</span> : <span className="text-faint">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No departments" body="Set up departments in Org setup first." />
          )}
        </ReportCard>

        <ReportCard title="Booking heatmap" sub="When shared resources actually get used — weekday × hour" report="booking-heatmap">
          {heatmap.isLoading ? (
            <Skeleton className="h-64" />
          ) : heatmap.data ? (
            <BookingHeatmapGrid hours={heatmap.data.hours} hourRange={heatmap.data.hourRange} max={heatmap.data.max} />
          ) : (
            <EmptyState title="No bookings yet" body="Booking activity will paint this grid." />
          )}
        </ReportCard>
      </div>
    </RoleGate>
  );
}
