"use client";

import { dashboard } from "@/api/dashboard";
import type { AttentionItem } from "@/api/types";
import {
  AlertTriangleIcon,
  AuditIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  PackageIcon,
  PlusIcon,
  TransferIcon,
  WrenchIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { fmtRelative } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const KIND_ICON: Record<AttentionItem["kind"], React.ReactNode> = {
  OVERDUE: <AlertTriangleIcon size={15} className="text-danger-500" />,
  TRANSFER_PENDING: <TransferIcon size={15} className="text-[#F79009]" />,
  MAINT_PENDING: <WrenchIcon size={15} className="text-[#F79009]" />,
  BOOKING_SOON: <CalendarIcon size={15} className="text-cobalt-500" />,
  AUDIT_OPEN: <AuditIcon size={15} className="text-cobalt-500" />,
};

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboard.get,
    refetchInterval: 30_000, // backend caches at 30s — cheap to poll
  });

  const k = data?.kpis;
  const scopeNote =
    data?.scope === "SELF" ? "Showing your assets and bookings" : data?.scope === "DEPARTMENT" ? "Showing your department" : "Organization-wide";

  const firstName = user?.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Morning check, ${firstName}` : "Dashboard"}
        sub={scopeNote}
        actions={
          <>
            {hasRole(...MANAGERS) && (
              <Link href="/assets?register=1">
                <Button variant="secondary">
                  <PlusIcon size={15} /> Register asset
                </Button>
              </Link>
            )}
            <Link href="/bookings?book=1">
              <Button variant="secondary">
                <CalendarIcon size={15} /> Book resource
              </Button>
            </Link>
            <Link href="/maintenance?raise=1">
              <Button variant="secondary">
                <WrenchIcon size={15} /> Raise maintenance
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI row — Overdue Returns is the one card allowed to shout. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Assets available" value={k?.assetsAvailable} loading={isLoading} href="/assets?status=AVAILABLE" icon={<PackageIcon size={15} />} />
        <StatCard
          label={data?.scope === "SELF" ? "My assets" : "Assets allocated"}
          value={k?.assetsAllocated}
          loading={isLoading}
          href="/allocations"
          icon={<TransferIcon size={15} />}
        />
        <StatCard label="Maintenance in flight" value={k?.maintenanceToday} loading={isLoading} href="/maintenance" icon={<WrenchIcon size={15} />} />
        <StatCard
          label={data?.scope === "SELF" ? "My bookings" : "Active bookings"}
          value={k?.activeBookings}
          loading={isLoading}
          href="/bookings"
          icon={<CalendarIcon size={15} />}
        />
        <StatCard label="Pending transfers" value={k?.pendingTransfers} loading={isLoading} href="/allocations?tab=transfers" icon={<TransferIcon size={15} />} />
        <StatCard label="Upcoming returns" value={k?.upcomingReturns} sub="Next 7 days" loading={isLoading} href="/allocations" icon={<ClockIcon size={15} />} />
        <StatCard
          label="Overdue returns"
          value={k?.overdueReturns}
          sub={k?.overdueReturns ? "Needs chasing today" : "All on time"}
          tone="danger"
          loading={isLoading}
          href="/allocations"
          icon={<AlertTriangleIcon size={15} />}
        />
      </div>

      {/* Needs attention — deep links into the relevant screens. */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Needs attention</h2>
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-hover" />
              ))}
            </div>
          ) : data && data.needsAttention.length > 0 ? (
            <ul>
              {data.needsAttention.map((item) => (
                <li key={item.id} className="border-b border-hairline last:border-0">
                  <Link
                    href={item.href}
                    className={
                      "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover " +
                      (item.kind === "OVERDUE" ? "border-l-[3px] border-l-danger-500" : "border-l-[3px] border-l-transparent")
                    }
                  >
                    <span className="shrink-0">{KIND_ICON[item.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{item.message}</span>
                      {item.detail && <span className="block truncate text-xs text-muted">{item.detail}</span>}
                    </span>
                    {item.at && <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:block">{fmtRelative(item.at)}</span>}
                    <ChevronRightIcon size={14} className="shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing needs attention" body="Overdue returns and pending approvals will surface here." />
          )}
        </div>
      </section>
    </>
  );
}
