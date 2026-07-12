"use client";

import { assets, type AssetFilters } from "@/api/assets";
import type { Asset, AssetStatus } from "@/api/types";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { RegisterAssetModal } from "@/components/assets/register-modal";
import { PageHeader } from "@/components/shell/page-header";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { fmtCost } from "@/lib/format";
import { ASSET_STATUS } from "@/lib/statusSystem";
import { MANAGERS } from "@/lib/rbac";
import { useCategories, useDepartments } from "@/lib/lookups";
import { stableKey } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AssetsPage() {
  const router = useRouter();
  const { hasRole } = useAuth();
  const canRegister = hasRole(...MANAGERS);

  const [filters, setFilters] = useState<AssetFilters>({ page: 0, size: 20, sort: "assetTag,asc" });
  const [q, setQ] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  // Deep links: /assets?status=AVAILABLE (dashboard cards), /assets?register=1 (quick action)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get("status") as AssetStatus | null;
    if (status && status in ASSET_STATUS) setFilters((f) => ({ ...f, status }));
    if (sp.get("register") === "1" && canRegister) setRegisterOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce free-text into the filter set.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: q.trim() || undefined, page: 0 })), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["assets", stableKey(filters as Record<string, unknown>)],
    queryFn: () => assets.list(filters),
    placeholderData: (prev) => prev,
  });

  const { data: cats } = useCategories();
  const { data: depts } = useDepartments();

  const set = (patch: Partial<AssetFilters>) => setFilters((f) => ({ ...f, ...patch, page: 0 }));
  const [sortKey = "assetTag", sortDir = "asc"] = (filters.sort ?? "assetTag,asc").split(",");

  const columns: Column<Asset>[] = [
    { key: "assetTag", header: "Tag", sortable: true, render: (a) => <AssetTag tag={a.assetTag} /> },
    { key: "name", header: "Name", sortable: true, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "category", header: "Category", hideBelow: "md", render: (a) => <span className="text-muted">{a.categoryName ?? cats?.find((c) => c.id === a.categoryId)?.name ?? "—"}</span> },
    { key: "status", header: "Status", render: (a) => <StatusChip domain="asset" status={a.status} /> },
    { key: "holder", header: "Held by", hideBelow: "lg", render: (a) => <span className="text-muted">{a.currentHolder?.name ?? "—"}</span> },
    { key: "location", header: "Location", sortable: true, hideBelow: "lg", render: (a) => <span className="text-muted">{a.location ?? "—"}</span> },
    { key: "serial", header: "Serial", mono: true, hideBelow: "lg", className: "text-muted", render: (a) => a.serialNumber ?? "—" },
    { key: "acquisitionCost", header: "Cost", align: "right", sortable: true, render: (a) => fmtCost(a.acquisitionCost) },
  ];

  const hasFilters = !!(filters.q || filters.status || filters.category || filters.department || filters.location || filters.bookable !== undefined);

  return (
    <>
      <PageHeader
        title="Assets"
        sub={data ? `${data.totalElements} tracked assets` : "The organization's tracked assets"}
        actions={
          canRegister && (
            <Button onClick={() => setRegisterOpen(true)}>
              <PlusIcon size={15} /> Register asset
            </Button>
          )
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, name, serial…" className="pl-8" aria-label="Search assets" />
        </div>
        <Select aria-label="Status" className="w-auto" value={filters.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as AssetStatus | undefined })}>
          <option value="">All statuses</option>
          {Object.entries(ASSET_STATUS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Category" className="w-auto" value={filters.category ?? ""} onChange={(e) => set({ category: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All categories</option>
          {cats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Department" className="w-auto" value={filters.department ?? ""} onChange={(e) => set({ department: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All departments</option>
          {depts?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Bookable"
          className="w-auto"
          value={filters.bookable === undefined ? "" : String(filters.bookable)}
          onChange={(e) => set({ bookable: e.target.value === "" ? undefined : e.target.value === "true" })}
        >
          <option value="">Bookable or not</option>
          <option value="true">Bookable only</option>
          <option value="false">Not bookable</option>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setFilters({ page: 0, size: 20, sort: "assetTag,asc" });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.content}
        rowKey={(a) => a.id}
        loading={isLoading}
        onRowClick={(a) => router.push(`/assets/${a.id}`)}
        empty={
          hasFilters
            ? { title: "No assets match these filters", body: "Loosen a filter or clear them to see the full directory." }
            : {
                title: "No assets yet",
                body: canRegister ? "Register your first asset to start tracking." : "Once assets are registered they'll appear here.",
                action: canRegister ? (
                  <Button onClick={() => setRegisterOpen(true)}>
                    <PlusIcon size={15} /> Register your first asset
                  </Button>
                ) : undefined,
              }
        }
        pagination={
          data && {
            page: data.number,
            totalPages: data.totalPages,
            totalElements: data.totalElements,
            onPage: (page) => setFilters((f) => ({ ...f, page })),
          }
        }
        sort={{
          key: sortKey,
          dir: sortDir as "asc" | "desc",
          onSort: (key) =>
            setFilters((f) => ({
              ...f,
              page: 0,
              sort: `${key},${sortKey === key && sortDir === "asc" ? "desc" : "asc"}`,
            })),
        }}
      />

      <RegisterAssetModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </>
  );
}
