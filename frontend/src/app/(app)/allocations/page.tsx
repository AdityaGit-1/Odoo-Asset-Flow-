"use client";

import { allocations as allocationsApi, transfers as transfersApi } from "@/api/allocations";
import { isApiError } from "@/api/client";
import type { Allocation, TransferRequest } from "@/api/types";
import { PlusIcon } from "@/components/icons";
import { AllocateModal } from "@/components/allocations/allocate-modal";
import { ReturnModal } from "@/components/allocations/return-modal";
import { PageHeader } from "@/components/shell/page-header";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/field";
import { OverduePill, StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { daysOverdue, fmtDate, fmtRelative } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const isOverdue = (a: Allocation) => a.status === "ACTIVE" && !!a.expectedReturnAt && new Date(a.expectedReturnAt).getTime() < Date.now();

export default function AllocationsPage() {
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const isManager = hasRole(...MANAGERS);

  const [tab, setTab] = useState<"allocations" | "transfers">("allocations");
  const [view, setView] = useState<"ALL" | "ACTIVE" | "OVERDUE" | "RETURNED">("ACTIVE");
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [presetAssetId, setPresetAssetId] = useState<number | null>(null);
  const [returning, setReturning] = useState<Allocation | null>(null);

  // Deep links: ?tab=transfers (bell/dashboard), ?allocate={assetId} (asset detail)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("tab") === "transfers") setTab("transfers");
    const allocate = sp.get("allocate");
    if (allocate && !Number.isNaN(Number(allocate))) {
      setPresetAssetId(Number(allocate));
      setAllocateOpen(true);
    }
  }, []);

  const allocationsQuery = useQuery({ queryKey: ["allocations"], queryFn: () => allocationsApi.list() });
  const transfersQuery = useQuery({ queryKey: ["transfers"], queryFn: () => transfersApi.list() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["allocations"] });
    qc.invalidateQueries({ queryKey: ["transfers"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      action === "approve" ? transfersApi.approve(id) : transfersApi.reject(id),
    onSuccess: (tr, { action }) => {
      invalidate();
      if (action === "approve") toast.success("Transfer approved", `${tr.asset?.assetTag ?? "Asset"} is now held by ${tr.toName ?? "the new holder"}.`);
      else toast.info("Transfer rejected", `${tr.asset?.assetTag ?? "The asset"} stays with ${tr.fromHolderName ?? "its holder"}.`);
    },
    onError: (e) => toast.error("Couldn't decide this transfer", isApiError(e) ? e.direction : "Try again."),
  });

  // Client-side gate mirrors the server's scope rule (manager, or head of the holding dept).
  const canDecide = (tr: TransferRequest) =>
    isManager || (user?.role === "DEPARTMENT_HEAD" && tr.departmentId != null && tr.departmentId === user.departmentId);

  const canReturn = (a: Allocation) =>
    isManager ||
    a.holderEmployeeId === user?.employeeId ||
    (user?.role === "DEPARTMENT_HEAD" && a.holderDepartmentId === user.departmentId);

  const rows = allocationsQuery.data?.filter((a) => {
    if (view === "ACTIVE") return a.status === "ACTIVE";
    if (view === "RETURNED") return a.status === "RETURNED";
    if (view === "OVERDUE") return isOverdue(a);
    return true;
  });

  const allocationColumns: Column<Allocation>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (a) => (
        <span className="flex items-center gap-2">
          <AssetTag tag={a.asset?.assetTag ?? `#${a.assetId}`} />
          <span className="hidden truncate font-medium sm:inline">{a.asset?.name}</span>
        </span>
      ),
    },
    { key: "holder", header: "Held by", render: (a) => a.holderName ?? "—" },
    { key: "allocatedAt", header: "Allocated", hideBelow: "md", mono: true, className: "text-muted", render: (a) => fmtDate(a.allocatedAt) },
    {
      key: "expected",
      header: "Expected return",
      render: (a) =>
        a.status === "RETURNED" ? (
          <span className="text-muted">Returned {fmtDate(a.returnedAt)}</span>
        ) : a.expectedReturnAt ? (
          <span className="flex items-center gap-2">
            <span className={isOverdue(a) ? "font-medium text-danger-700" : undefined}>{fmtDate(a.expectedReturnAt)}</span>
            {isOverdue(a) && <OverduePill>{daysOverdue(a.expectedReturnAt)}d overdue</OverduePill>}
          </span>
        ) : (
          <span className="text-faint">Open-ended</span>
        ),
    },
    { key: "status", header: "Status", hideBelow: "sm", render: (a) => <StatusChip domain="allocation" status={a.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (a) =>
        a.status === "ACTIVE" && canReturn(a) ? (
          <Button size="sm" variant="secondary" onClick={() => setReturning(a)}>
            Return
          </Button>
        ) : null,
    },
  ];

  const transferColumns: Column<TransferRequest>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (tr) => (
        <span className="flex items-center gap-2">
          <AssetTag tag={tr.asset?.assetTag ?? `#${tr.assetId}`} />
          <span className="hidden truncate font-medium md:inline">{tr.asset?.name}</span>
        </span>
      ),
    },
    {
      key: "move",
      header: "From → to",
      render: (tr) => (
        <span className="text-[13px]">
          <span className="text-muted">{tr.fromHolderName ?? "—"}</span>
          <span aria-hidden className="px-1.5 text-faint">→</span>
          <span className="font-medium">{tr.toName ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "requestedBy",
      header: "Requested",
      hideBelow: "md",
      render: (tr) => (
        <span className="block max-w-56">
          <span className="block truncate text-[13px]">{tr.requestedByName}</span>
          {tr.reason && <span className="block truncate text-xs text-faint">&ldquo;{tr.reason}&rdquo;</span>}
        </span>
      ),
    },
    { key: "created", header: "When", hideBelow: "lg", mono: true, className: "text-muted", render: (tr) => fmtRelative(tr.createdAt) },
    { key: "status", header: "Status", render: (tr) => <StatusChip domain="transfer" status={tr.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (tr) =>
        tr.status === "REQUESTED" && canDecide(tr) ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" loading={decide.isPending && decide.variables?.id === tr.id && decide.variables.action === "approve"} onClick={() => decide.mutate({ id: tr.id, action: "approve" })}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: tr.id, action: "reject" })}>
              Reject
            </Button>
          </span>
        ) : tr.status !== "REQUESTED" ? (
          <span className="text-xs text-faint">{tr.decidedByName ? `by ${tr.decidedByName}` : ""}</span>
        ) : null,
    },
  ];

  const pendingCount = transfersQuery.data?.filter((t) => t.status === "REQUESTED").length ?? 0;

  return (
    <>
      <PageHeader
        title="Allocation & transfer"
        sub="Who holds what, and the queue for moving it"
        actions={
          isManager && (
            <Button onClick={() => { setPresetAssetId(null); setAllocateOpen(true); }}>
              <PlusIcon size={15} /> Allocate asset
            </Button>
          )
        }
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: "allocations", label: "Allocations", count: allocationsQuery.data?.filter((a) => a.status === "ACTIVE").length },
          { key: "transfers", label: "Transfer requests", count: pendingCount },
        ]}
      />

      {tab === "allocations" ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Select aria-label="Filter allocations" className="w-auto" value={view} onChange={(e) => setView(e.target.value as typeof view)}>
              <option value="ACTIVE">Active</option>
              <option value="OVERDUE">Overdue only</option>
              <option value="RETURNED">Returned</option>
              <option value="ALL">All</option>
            </Select>
          </div>
          <DataTable
            columns={allocationColumns}
            rows={rows}
            rowKey={(a) => a.id}
            loading={allocationsQuery.isLoading}
            rowClassName={(a) => (isOverdue(a) ? "border-l-[3px] border-l-danger-500 bg-danger-050/30" : "border-l-[3px] border-l-transparent")}
            empty={
              view === "OVERDUE"
                ? { title: "Nothing overdue", body: "Every active allocation is inside its expected return date." }
                : {
                    title: "No allocations here",
                    body: isManager ? "Allocate an asset to an employee or department to get started." : "Assets allocated to you will appear here.",
                    action: isManager ? (
                      <Button onClick={() => setAllocateOpen(true)}>
                        <PlusIcon size={15} /> Allocate asset
                      </Button>
                    ) : undefined,
                  }
            }
          />
        </>
      ) : (
        <DataTable
          columns={transferColumns}
          rows={transfersQuery.data}
          rowKey={(tr) => tr.id}
          loading={transfersQuery.isLoading}
          empty={{
            title: "No transfer requests",
            body: "When someone needs an asset that's already held, the request lands here for approval.",
          }}
        />
      )}

      <AllocateModal open={allocateOpen} onClose={() => setAllocateOpen(false)} presetAssetId={presetAssetId} />
      <ReturnModal allocation={returning} onClose={() => setReturning(null)} />
    </>
  );
}
