"use client";

import { isApiError } from "@/api/client";
import { maintenance as maintApi } from "@/api/maintenance";
import type { MaintPriority, MaintStatus, MaintenanceRequest } from "@/api/types";
import { PlusIcon } from "@/components/icons";
import { RaiseMaintenanceModal } from "@/components/maintenance/raise-modal";
import { PageHeader } from "@/components/shell/page-header";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { fmtRelative } from "@/lib/format";
import { MANAGERS } from "@/lib/rbac";
import { useEmployees } from "@/lib/lookups";
import { MAINT_STATUS } from "@/lib/statusSystem";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

// Priority pills reuse the status-system hues — no new colors.
const PRIORITY: Record<MaintPriority, { label: string; fg: string; bg: string }> = {
  LOW: { label: "Low", fg: "#475467", bg: "#F2F4F7" },
  MEDIUM: { label: "Medium", fg: "#1570EF", bg: "#EFF8FF" },
  HIGH: { label: "High", fg: "#B54708", bg: "#FFFAEB" },
  CRITICAL: { label: "Critical", fg: "#B42318", bg: "#FEF3F2" },
};

const COLUMNS: MaintStatus[] = ["PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"];

type Dialog =
  | { kind: "assign"; request: MaintenanceRequest }
  | { kind: "resolve"; request: MaintenanceRequest }
  | { kind: "reject"; request: MaintenanceRequest }
  | null;

export default function MaintenancePage() {
  const { user, hasRole } = useAuth();
  const isManager = hasRole(...MANAGERS);
  const toast = useToast();
  const qc = useQueryClient();

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [presetAssetId, setPresetAssetId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("raise") === "1") {
      const asset = Number(sp.get("asset"));
      if (Number.isFinite(asset) && asset > 0) setPresetAssetId(asset);
      setRaiseOpen(true);
    }
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["maintenance"], queryFn: () => maintApi.list() });
  const { data: employees } = useEmployees();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["maintenance"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const act = useMutation({
    mutationFn: ({ id, action, payload }: { id: number; action: "approve" | "reject" | "assign" | "start" | "resolve"; payload?: string }) => {
      switch (action) {
        case "approve": return maintApi.approve(id);
        case "reject": return maintApi.reject(id);
        case "assign": return maintApi.assign(id, Number(payload));
        case "start": return maintApi.start(id);
        case "resolve": return maintApi.resolve(id, payload ?? "");
      }
    },
    onSuccess: (r, { action }) => {
      invalidate();
      const tag = r?.asset?.assetTag ?? "Asset";
      const messages: Record<string, [string, string]> = {
        approve: ["Approved", `${tag} is now Under maintenance.`],
        reject: ["Rejected", `${tag} stays in service.`],
        assign: ["Technician assigned", `${r?.technicianName ?? "They"} will pick it up.`],
        start: ["Work started", `${tag} is being worked on.`],
        resolve: ["Resolved", `${tag} is Available again.`],
      };
      const [title, body] = messages[action]!;
      toast.success(title, body);
      setDialog(null);
    },
    onError: (e) => toast.error("Couldn't update the request", isApiError(e) ? e.direction : "Try again."),
  });

  const cardActions = (r: MaintenanceRequest) => {
    const busy = act.isPending && act.variables?.id === r.id;
    if (r.status === "PENDING" && isManager)
      return (
        <div className="flex gap-1.5">
          <Button size="sm" loading={busy} onClick={() => act.mutate({ id: r.id, action: "approve" })}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "reject", request: r })}>
            Reject
          </Button>
        </div>
      );
    if (r.status === "APPROVED" && isManager)
      return (
        <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "assign", request: r })}>
          Assign technician
        </Button>
      );
    if (r.status === "TECHNICIAN_ASSIGNED" && (isManager || r.technicianId === user?.employeeId))
      return (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act.mutate({ id: r.id, action: "start" })}>
          Start work
        </Button>
      );
    if (r.status === "IN_PROGRESS" && isManager)
      return (
        <Button size="sm" onClick={() => setDialog({ kind: "resolve", request: r })}>
          Resolve
        </Button>
      );
    return null;
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        sub="Approval gates the fix: assets only flip to Under maintenance once a manager signs off"
        actions={
          <Button onClick={() => { setPresetAssetId(null); setRaiseOpen(true); }}>
            <PlusIcon size={15} /> Raise request
          </Button>
        }
      />

      {/* The workflow board */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((status) => {
          const items = data?.filter((r) => r.status === status) ?? [];
          const style = MAINT_STATUS[status];
          return (
            <section key={status} className={cn("w-72 shrink-0 rounded-lg border border-hairline bg-paper", status === "REJECTED" && "opacity-75")}>
              <header className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: style.dot }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{style.label}</h2>
                <span className="ml-auto font-mono text-xs text-faint tabular-nums">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2 p-2" style={{ minHeight: 120 }}>
                {isLoading ? (
                  <>
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </>
                ) : items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-faint">
                    {status === "PENDING" ? "Nothing waiting — raise a request if something's broken." : "Empty"}
                  </p>
                ) : (
                  items.map((r) => (
                    <article key={r.id} className="rounded-lg border border-hairline bg-surface p-3 shadow-card">
                      <div className="flex items-center justify-between gap-2">
                        <AssetTag tag={r.asset?.assetTag ?? `#${r.assetId}`} />
                        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ color: PRIORITY[r.priority].fg, backgroundColor: PRIORITY[r.priority].bg }}>
                          {PRIORITY[r.priority].label}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-[13px] font-medium">{r.asset?.name}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] text-muted">{r.issue}</p>
                      {r.resolutionNotes && (r.status === "RESOLVED" || r.status === "REJECTED") && (
                        <p className="mt-1.5 line-clamp-2 rounded-md bg-paper px-2 py-1 text-xs text-muted">↳ {r.resolutionNotes}</p>
                      )}
                      <p className="mt-2 font-mono text-[11px] text-faint">
                        {r.raisedByName} · {fmtRelative(r.createdAt)}
                        {r.technicianName && <> · tech: {r.technicianName}</>}
                      </p>
                      <div className="mt-2 empty:hidden">{cardActions(r)}</div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <RaiseMaintenanceModal open={raiseOpen} onClose={() => setRaiseOpen(false)} presetAssetId={presetAssetId} />

      {/* Assign technician */}
      <AssignDialog
        open={dialog?.kind === "assign"}
        request={dialog?.request ?? null}
        employees={employees ?? []}
        busy={act.isPending}
        onClose={() => setDialog(null)}
        onAssign={(techId) => dialog && act.mutate({ id: dialog.request.id, action: "assign", payload: String(techId) })}
      />

      {/* Resolve with notes */}
      <NotesDialog
        open={dialog?.kind === "resolve"}
        title={`Resolve ${dialog?.request.asset?.assetTag ?? ""}`}
        label="What was done?"
        placeholder="Replaced the battery pack, ran a full diagnostic…"
        confirmLabel="Resolve — asset returns to Available"
        busy={act.isPending}
        onClose={() => setDialog(null)}
        onSubmit={(notes) => dialog && act.mutate({ id: dialog.request.id, action: "resolve", payload: notes })}
      />

      {/* Reject with reason */}
      <NotesDialog
        open={dialog?.kind === "reject"}
        title={`Reject request for ${dialog?.request.asset?.assetTag ?? ""}`}
        label="Why is this rejected?"
        placeholder="Within normal wear, duplicate request, replacement ordered instead…"
        confirmLabel="Reject request"
        tone="danger"
        optional
        busy={act.isPending}
        onClose={() => setDialog(null)}
        onSubmit={() => dialog && act.mutate({ id: dialog.request.id, action: "reject" })}
      />
    </>
  );
}

function AssignDialog({
  open,
  request,
  employees,
  busy,
  onClose,
  onAssign,
}: {
  open: boolean;
  request: MaintenanceRequest | null;
  employees: { id: number; name: string; status: string }[];
  busy: boolean;
  onClose: () => void;
  onAssign: (techId: number) => void;
}) {
  const [techId, setTechId] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (techId) onAssign(Number(techId));
  };
  return (
    <Modal open={open} onClose={onClose} title={`Assign technician — ${request?.asset?.assetTag ?? ""}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Technician" required>
          <Select required value={techId} onChange={(e) => setTechId(e.target.value)}>
            <option value="" disabled>
              Who takes this?
            </option>
            {employees.filter((e) => e.status === "ACTIVE").map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NotesDialog({
  open,
  title,
  label,
  placeholder,
  confirmLabel,
  tone = "primary",
  optional,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  optional?: boolean;
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
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={label}>
          <Textarea required={!optional} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={placeholder} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={tone} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
