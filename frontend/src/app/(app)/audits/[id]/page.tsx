"use client";

import { audits } from "@/api/audits";
import { isApiError } from "@/api/client";
import type { AuditItem, AuditResult } from "@/api/types";
import { AlertTriangleIcon, ChevronLeftIcon } from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Textarea } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useEmployees } from "@/lib/lookups";
import { AUDIT_RESULT } from "@/lib/statusSystem";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AuditCyclePage() {
  const params = useParams<{ id: string }>();
  const cycleId = Number(params.id);
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const toast = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"checklist" | "discrepancies">("checklist");
  const [auditorsOpen, setAuditorsOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [noting, setNoting] = useState<{ item: AuditItem; result: AuditResult } | null>(null);

  const cycleQuery = useQuery({ queryKey: ["audit", cycleId], queryFn: () => audits.get(cycleId), enabled: Number.isFinite(cycleId) });
  const itemsQuery = useQuery({ queryKey: ["audit-items", cycleId], queryFn: () => audits.items(cycleId), enabled: Number.isFinite(cycleId) });
  const cycle = cycleQuery.data;

  const isAuditor = !!user?.employeeId && !!cycle?.auditorIds?.includes(user.employeeId);
  const canMark = isAuditor && cycle?.status === "OPEN";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["audit", cycleId] });
    qc.invalidateQueries({ queryKey: ["audit-items", cycleId] });
    qc.invalidateQueries({ queryKey: ["audits"] });
  };

  const mark = useMutation({
    mutationFn: ({ assetId, result, notes }: { assetId: number; result: AuditResult; notes?: string }) =>
      audits.mark(cycleId, assetId, { result, notes }),
    onSuccess: (item) => {
      invalidate();
      setNoting(null);
      if (item.result !== "VERIFIED") toast.info(`Flagged ${AUDIT_RESULT[item.result!].label.toLowerCase()}`, "It's on the discrepancy report until the cycle closes.");
    },
    onError: (e) => toast.error("Couldn't record that", isApiError(e) ? e.direction : "Try again."),
  });

  const close = useMutation({
    mutationFn: () => audits.close(cycleId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Cycle closed", "Confirmed-missing assets are now marked Lost; the checklist is locked.");
    },
  });

  const assignAuditors = useMutation({
    mutationFn: (ids: number[]) => audits.assignAuditors(cycleId, ids),
    onSuccess: (c) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Auditors updated", c.auditorNames?.join(", ") || "Nobody assigned.");
      setAuditorsOpen(false);
    },
    onError: (e) => toast.error("Couldn't update auditors", isApiError(e) ? e.direction : "Try again."),
  });

  const markButtons = (item: AuditItem) => {
    if (!canMark) return null;
    const busy = mark.isPending && mark.variables?.assetId === item.assetId;
    return (
      <span className="flex justify-end gap-1">
        <Button size="sm" variant={item.result === "VERIFIED" ? "primary" : "secondary"} loading={busy} onClick={() => mark.mutate({ assetId: item.assetId, result: "VERIFIED" })}>
          ✓ Verified
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setNoting({ item, result: "MISSING" })}>
          Missing
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setNoting({ item, result: "DAMAGED" })}>
          Damaged
        </Button>
      </span>
    );
  };

  const baseColumns: Column<AuditItem>[] = [
    { key: "tag", header: "Asset", render: (i) => <AssetTag tag={i.asset?.assetTag ?? `#${i.assetId}`} /> },
    { key: "name", header: "Name", render: (i) => <span className="font-medium">{i.asset?.name}</span> },
    { key: "location", header: "Expected location", hideBelow: "md", render: (i) => <span className="text-muted">{i.asset?.location ?? "—"}</span> },
    {
      key: "result",
      header: "Result",
      render: (i) =>
        i.result ? (
          <span className="flex items-center gap-2">
            <StatusChip domain="audit" status={i.result} />
            <span className="hidden font-mono text-[11px] text-faint lg:inline">
              {i.auditorName} · {fmtDate(i.checkedAt)}
            </span>
          </span>
        ) : (
          <span className="text-faint">Unchecked</span>
        ),
    },
  ];

  const checklistColumns: Column<AuditItem>[] = [
    ...baseColumns,
    { key: "actions", header: <span className="sr-only">Mark</span>, align: "right", render: markButtons },
  ];

  const discrepancyColumns: Column<AuditItem>[] = [
    ...baseColumns,
    { key: "notes", header: "Notes", render: (i) => <span className="block max-w-72 truncate text-muted">{i.notes ?? "—"}</span> },
  ];

  const items = itemsQuery.data;
  const discrepancies = items?.filter((i) => i.result === "MISSING" || i.result === "DAMAGED");
  const unchecked = items?.filter((i) => i.result === null).length ?? 0;
  const missingCount = items?.filter((i) => i.result === "MISSING").length ?? 0;

  if (cycleQuery.isError) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-10 text-center shadow-card">
        <p className="text-sm font-medium">Can&apos;t open this cycle</p>
        <p className="mt-1 text-[13px] text-muted">{isApiError(cycleQuery.error) ? cycleQuery.error.direction : "It may not exist."}</p>
        <Link href="/audits" className="mt-4 inline-block">
          <Button variant="secondary">All cycles</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/audits" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronLeftIcon size={14} /> All cycles
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {cycle?.name ?? "…"}
            {cycle && <StatusChip domain="cycle" status={cycle.status} />}
          </span>
        }
        sub={
          cycle
            ? `${[cycle.scopeDepartmentName, cycle.scopeLocation].filter(Boolean).join(" · ") || "Whole organization"} · ${fmtDate(cycle.startDate)} – ${fmtDate(cycle.endDate)} · auditors: ${cycle.auditorNames?.join(", ") || "unassigned"}`
            : undefined
        }
        actions={
          isAdmin && cycle?.status === "OPEN" ? (
            <>
              <Button variant="secondary" onClick={() => setAuditorsOpen(true)}>
                Assign auditors
              </Button>
              <Button variant="danger" onClick={() => setCloseOpen(true)}>
                Close cycle
              </Button>
            </>
          ) : cycle?.status === "CLOSED" ? (
            <p className="font-mono text-xs text-faint">CLOSED {fmtDateTime(cycle.closedAt)}</p>
          ) : undefined
        }
      />

      {cycle?.status === "OPEN" && isAuditor && (
        <p className="mb-4 rounded-lg border border-cobalt-500/30 bg-cobalt-050 px-3.5 py-2.5 text-sm text-cobalt-700">
          You&apos;re an auditor on this cycle — mark each asset as you verify it physically. {unchecked > 0 ? `${unchecked} left.` : "All checked ✓"}
        </p>
      )}
      {cycle?.status === "OPEN" && !isAuditor && !isAdmin && (
        <p className="mb-4 text-sm text-muted">Read-only — only assigned auditors can record results.</p>
      )}

      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: "checklist", label: "Checklist", count: items?.length },
          { key: "discrepancies", label: "Discrepancy report", count: discrepancies?.length },
        ]}
      />

      {tab === "checklist" ? (
        <DataTable
          columns={checklistColumns}
          rows={items}
          rowKey={(i) => i.id}
          loading={itemsQuery.isLoading}
          rowClassName={(i) => (i.result === "MISSING" ? "border-l-[3px] border-l-danger-500" : "border-l-[3px] border-l-transparent")}
          empty={{ title: "No assets in scope", body: "The snapshot came back empty — recreate the cycle with a wider scope." }}
        />
      ) : (
        <DataTable
          columns={discrepancyColumns}
          rows={discrepancies}
          rowKey={(i) => i.id}
          loading={itemsQuery.isLoading}
          rowClassName={(i) => (i.result === "MISSING" ? "border-l-[3px] border-l-danger-500" : "border-l-[3px] border-l-transparent")}
          empty={{ title: "No discrepancies", body: "Everything checked so far is verified and in place." }}
        />
      )}

      {/* Notes prompt when flagging missing/damaged */}
      <NotesPrompt
        state={noting}
        busy={mark.isPending}
        onClose={() => setNoting(null)}
        onSubmit={(notes) => noting && mark.mutate({ assetId: noting.item.assetId, result: noting.result, notes })}
      />

      {/* Assign auditors */}
      <AuditorsModal
        open={auditorsOpen}
        current={cycle?.auditorIds ?? []}
        busy={assignAuditors.isPending}
        onClose={() => setAuditorsOpen(false)}
        onSave={(ids) => assignAuditors.mutate(ids)}
      />

      {/* Close cycle — spell out the consequence. */}
      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={() => close.mutateAsync()}
        title="Close this cycle?"
        body={
          <span>
            Closing locks the checklist for good and applies the results:{" "}
            <strong className="text-ink">
              {missingCount} missing asset{missingCount === 1 ? "" : "s"} will be marked Lost
            </strong>
            , damaged ones get their condition downgraded{unchecked > 0 ? `, and ${unchecked} unchecked item${unchecked === 1 ? " stays" : "s stay"} unresolved` : ""}. This can&apos;t be reopened.
          </span>
        }
        confirmLabel="Close cycle"
        tone="danger"
      />
    </>
  );
}

function NotesPrompt({
  state,
  busy,
  onClose,
  onSubmit,
}: {
  state: { item: AuditItem; result: AuditResult } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(notes.trim());
    setNotes("");
  };
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AlertTriangleIcon size={16} className="text-[#F79009]" />
          Mark {state?.item.asset?.assetTag} as {state ? AUDIT_RESULT[state.result].label.toLowerCase() : ""}
        </span>
      }
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What did you find?" hint="Goes on the discrepancy report.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={state?.result === "MISSING" ? "Not at its location; last seen…" : "Describe the damage…"} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Record {state ? AUDIT_RESULT[state.result].label.toLowerCase() : ""}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AuditorsModal({
  open,
  current,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  current: number[];
  busy: boolean;
  onClose: () => void;
  onSave: (ids: number[]) => void;
}) {
  const { data: employees } = useEmployees();
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const effective = selected ?? new Set(current);

  const toggle = (id: number) => {
    const next = new Set(effective);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <Modal open={open} onClose={() => { setSelected(null); onClose(); }} title="Assign auditors" size="sm">
      <p className="mb-3 text-sm text-muted">Only assigned auditors can mark items, and only while the cycle is open.</p>
      <ul className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline scrollbar-thin">
        {employees?.filter((e) => e.status === "ACTIVE").map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-hover">
              <input type="checkbox" checked={effective.has(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-[#2B36D9]" />
              <span className="flex-1 text-sm">{e.name}</span>
              <span className="text-xs text-faint">{e.email}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setSelected(null); onClose(); }}>
          Cancel
        </Button>
        <Button loading={busy} onClick={() => onSave([...effective])}>
          Save auditors
        </Button>
      </div>
    </Modal>
  );
}
