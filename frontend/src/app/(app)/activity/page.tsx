"use client";

import { activity as activityApi } from "@/api/activity";
import type { ActivityEntry } from "@/api/types";
import { PageHeader } from "@/components/shell/page-header";
import { RoleGate } from "@/components/shell/role-gate";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useEmployees } from "@/lib/lookups";
import { stableKey } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const ENTITIES = ["asset", "booking", "maintenance", "transfer", "audit", "department", "category", "employee"];

export default function ActivityPage() {
  const [filters, setFilters] = useState<{ actor?: number; entity?: string; from?: string; to?: string }>({});
  const { data: employees } = useEmployees();

  const { data, isLoading } = useQuery({
    queryKey: ["activity", stableKey(filters)],
    queryFn: () => activityApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const columns: Column<ActivityEntry>[] = [
    { key: "when", header: "When", mono: true, className: "text-muted whitespace-nowrap", render: (r) => fmtDateTime(r.createdAt) },
    { key: "actor", header: "Who", render: (r) => <span className="font-medium">{r.actorName ?? "System"}</span> },
    {
      key: "action",
      header: "Action",
      render: (r) => <span className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-muted">{r.action}</span>,
    },
    { key: "detail", header: "Detail", render: (r) => <span className="block max-w-md truncate text-muted">{r.detail ?? "—"}</span> },
    { key: "entity", header: "Entity", hideBelow: "md", render: (r) => <span className="text-faint">{r.entityType ? `${r.entityType} #${r.entityId}` : "—"}</span> },
  ];

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <RoleGate roles={MANAGERS}>
      <PageHeader title="Activity log" sub="Who did what, when — the audit trail across every workflow" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Actor"
          className="w-auto"
          value={filters.actor ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value ? Number(e.target.value) : undefined }))}
        >
          <option value="">Anyone</option>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Entity type"
          className="w-auto"
          value={filters.entity ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value || undefined }))}
        >
          <option value="">All entities</option>
          {ENTITIES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          From
          <Input type="date" className="w-auto" value={filters.from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          To
          <Input type="date" className="w-auto" value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))} />
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={
          hasFilters
            ? { title: "Nothing in this slice", body: "Widen the date range or clear a filter." }
            : { title: "No activity yet", body: "Every allocation, approval and role change writes a line here." }
        }
      />
    </RoleGate>
  );
}
