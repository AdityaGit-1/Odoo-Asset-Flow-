"use client";

import { isApiError } from "@/api/client";
import { departments as deptApi } from "@/api/org";
import type { Department } from "@/api/types";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { useDepartments, useEmployees } from "@/lib/lookups";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

/** All ids in `id`'s subtree (self included) — these can't be its parent. */
function subtreeIds(depts: Department[], id: number): Set<number> {
  const out = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of depts) {
      if (d.parentDepartmentId !== null && out.has(d.parentDepartmentId) && !out.has(d.id)) {
        out.add(d.id);
        grew = true;
      }
    }
  }
  return out;
}

export function DepartmentsTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: depts, isLoading } = useDepartments();
  const { data: employees } = useEmployees();

  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [form, setForm] = useState({ name: "", parentDepartmentId: "", headEmployeeId: "" });
  const [error, setError] = useState<string | null>(null);

  const open = (target: Department | "new") => {
    setEditing(target);
    setError(null);
    setForm(
      target === "new"
        ? { name: "", parentDepartmentId: "", headEmployeeId: "" }
        : {
            name: target.name,
            parentDepartmentId: target.parentDepartmentId ? String(target.parentDepartmentId) : "",
            headEmployeeId: target.headEmployeeId ? String(target.headEmployeeId) : "",
          },
    );
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        parentDepartmentId: form.parentDepartmentId ? Number(form.parentDepartmentId) : null,
        headEmployeeId: form.headEmployeeId ? Number(form.headEmployeeId) : null,
      };
      return editing === "new" ? deptApi.create(body) : deptApi.update((editing as Department).id, body);
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast.success(editing === "new" ? "Department created" : "Department updated", d.name);
      setEditing(null);
    },
    // The server's cycle guard message surfaces here verbatim.
    onError: (e) => setError(isApiError(e) ? e.message : "Couldn't save — try again."),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "INACTIVE" }) => deptApi.setStatus(id, status),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast.success(d.status === "ACTIVE" ? "Reactivated" : "Deactivated", d.name);
    },
    onError: (e) => toast.error("Can't deactivate yet", isApiError(e) ? e.message : "Try again."),
  });

  const name = (id: number | null) => depts?.find((d) => d.id === id)?.name ?? "—";
  const empName = (id: number | null) => employees?.find((e) => e.id === id)?.name ?? "—";

  // Editing an existing dept: its own subtree is off-limits as a parent.
  const blocked = editing && editing !== "new" && depts ? subtreeIds(depts, editing.id) : new Set<number>();

  const columns: Column<Department>[] = [
    { key: "name", header: "Department", render: (d) => <span className="font-medium">{d.name}</span> },
    { key: "parent", header: "Parent", render: (d) => <span className="text-muted">{d.parentDepartmentId ? name(d.parentDepartmentId) : "—"}</span> },
    { key: "head", header: "Head", hideBelow: "md", render: (d) => <span className="text-muted">{d.headEmployeeId ? empName(d.headEmployeeId) : "Unassigned"}</span> },
    { key: "status", header: "Status", render: (d) => <StatusChip domain="entity" status={d.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (d) => (
        <span className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => open(d)} aria-label={`Edit ${d.name}`}>
            <PencilIcon size={14} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={setStatus.isPending && setStatus.variables?.id === d.id}
            onClick={() => setStatus.mutate({ id: d.id, status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
          >
            {d.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => open("new")}>
          <PlusIcon size={15} /> New department
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={depts}
        rowKey={(d) => d.id}
        loading={isLoading}
        empty={{ title: "No departments yet", body: "Create the first department — signup and allocations hang off them." }}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New department" : `Edit ${form.name || "department"}`} size="sm">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Name" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Parent department" hint="Its own subtree is excluded — a department can't sit under itself.">
            <Select value={form.parentDepartmentId} onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })}>
              <option value="">None — top level</option>
              {depts
                ?.filter((d) => !blocked.has(d.id) && d.status === "ACTIVE")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Department head" hint="Heads approve transfers within their department.">
            <Select value={form.headEmployeeId} onChange={(e) => setForm({ ...form, headEmployeeId: e.target.value })}>
              <option value="">Unassigned</option>
              {employees?.filter((e) => e.status === "ACTIVE").map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing === "new" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
