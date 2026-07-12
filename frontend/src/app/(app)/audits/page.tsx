"use client";

import { audits } from "@/api/audits";
import { isApiError } from "@/api/client";
import type { AuditCycle } from "@/api/types";
import { PlusIcon } from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { fmtDate, todayDateInput } from "@/lib/format";
import { useDepartments } from "@/lib/lookups";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function Progress({ checked, total }: { checked: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((100 * checked) / total);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-cobalt-050">
        <span className="block h-full rounded-full bg-cobalt-600" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-xs text-muted tabular-nums">
        {checked}/{total}
      </span>
    </span>
  );
}

export default function AuditsPage() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const isAdmin = hasRole("ADMIN");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", scopeDepartmentId: "", scopeLocation: "", startDate: todayDateInput(), endDate: todayDateInput(14) });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["audits"], queryFn: audits.list });
  const { data: depts } = useDepartments();

  const create = useMutation({
    mutationFn: () =>
      audits.create({
        name: form.name.trim(),
        scopeDepartmentId: form.scopeDepartmentId ? Number(form.scopeDepartmentId) : null,
        scopeLocation: form.scopeLocation.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    onSuccess: (cycle) => {
      qc.invalidateQueries({ queryKey: ["audits"] });
      toast.success("Cycle opened", `${cycle.progress?.total ?? 0} assets snapshotted into the checklist. Assign auditors next.`);
      setCreateOpen(false);
      router.push(`/audits/${cycle.id}`);
    },
    onError: (e) => setError(isApiError(e) ? e.message : "Couldn't create the cycle — try again."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate();
  };

  const columns: Column<AuditCycle>[] = [
    { key: "name", header: "Cycle", render: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: "scope",
      header: "Scope",
      hideBelow: "md",
      render: (c) => (
        <span className="text-muted">
          {[c.scopeDepartmentName, c.scopeLocation].filter(Boolean).join(" · ") || "Whole organization"}
        </span>
      ),
    },
    { key: "window", header: "Window", hideBelow: "sm", mono: true, className: "text-muted", render: (c) => `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` },
    { key: "progress", header: "Checked", render: (c) => <Progress checked={c.progress?.checked ?? 0} total={c.progress?.total ?? 0} /> },
    { key: "auditors", header: "Auditors", hideBelow: "lg", render: (c) => <span className="text-muted">{c.auditorNames?.join(", ") || "Unassigned"}</span> },
    { key: "status", header: "Status", render: (c) => <StatusChip domain="cycle" status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Audit"
        sub="Verification cycles — walk the floor, mark what's there, close with consequences"
        actions={
          isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon size={15} /> Create cycle
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(c) => c.id}
        loading={isLoading}
        onRowClick={(c) => router.push(`/audits/${c.id}`)}
        empty={
          isAdmin
            ? { title: "No audit cycles yet", body: "Create one to snapshot in-scope assets into a checklist.", action: <Button onClick={() => setCreateOpen(true)}><PlusIcon size={15} /> Create cycle</Button> }
            : { title: "No cycles assigned to you", body: "When an admin assigns you as an auditor, the cycle shows up here." }
        }
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create audit cycle" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q3 FY26 — Engineering floor audit" autoFocus />
          </Field>
          <Field label="Scope — department" hint="Assets held by this department (or located on its floor).">
            <Select value={form.scopeDepartmentId} onChange={(e) => setForm({ ...form, scopeDepartmentId: e.target.value })}>
              <option value="">Any department</option>
              {depts?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope — location" hint="Substring match, e.g. “Studio”. Leave both empty to audit everything.">
            <Input value={form.scopeLocation} onChange={(e) => setForm({ ...form, scopeLocation: e.target.value })} placeholder="Optional" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" required>
              <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Ends" required>
              <Input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-faint">Creating the cycle freezes the in-scope asset list — auditors check against that snapshot.</p>
          {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Open cycle
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
