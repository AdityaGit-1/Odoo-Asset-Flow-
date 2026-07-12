"use client";

import { isApiError } from "@/api/client";
import { employees as empApi } from "@/api/org";
import type { Employee, Role } from "@/api/types";
import { ROLE_LABEL } from "@/api/types";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { useDepartments, useEmployees } from "@/lib/lookups";
import { useAuth } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

const ROLES: Role[] = ["EMPLOYEE", "DEPARTMENT_HEAD", "ASSET_MANAGER", "ADMIN"];

export function EmployeesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: employees, isLoading } = useEmployees();
  const { data: depts } = useDepartments();

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roleChange, setRoleChange] = useState<{ employee: Employee; newRole: Role } | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const changeRole = useMutation({
    mutationFn: ({ id, newRole }: { id: number; newRole: Role }) => empApi.setRole(id, newRole),
    onSuccess: (_, { newRole }) => {
      invalidate();
      toast.success("Role updated", `${roleChange?.employee.name} is now ${ROLE_LABEL[newRole]}. Applies on their next sign-in.`);
      setRoleChange(null);
      setRoleError(null);
    },
    // "Can't demote the last admin" lands here — keep the dialog open with the reason.
    onError: (e) => setRoleError(isApiError(e) ? e.message : "Couldn't change the role — try again."),
  });

  const changeDept = useMutation({
    mutationFn: ({ id, departmentId }: { id: number; departmentId: number | null }) => empApi.setDepartment(id, departmentId),
    onSuccess: (emp) => {
      invalidate();
      toast.success("Department updated", emp.name);
    },
    onError: (e) => toast.error("Couldn't move them", isApiError(e) ? e.direction : "Try again."),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "INACTIVE" }) => empApi.setStatus(id, status),
    onSuccess: (emp) => {
      invalidate();
      toast.success(emp.status === "ACTIVE" ? "Reactivated" : "Deactivated", `${emp.name}${emp.status === "INACTIVE" ? " can no longer sign in." : ""}`);
    },
    onError: (e) => toast.error("Couldn't update", isApiError(e) ? e.direction : "Try again."),
  });

  const rows = useMemo(
    () =>
      employees?.filter((e) => {
        if (q && !e.name.toLowerCase().includes(q.toLowerCase()) && !e.email.toLowerCase().includes(q.toLowerCase())) return false;
        if (deptFilter && e.departmentId !== Number(deptFilter)) return false;
        if (roleFilter && e.role !== roleFilter) return false;
        return true;
      }),
    [employees, q, deptFilter, roleFilter],
  );

  const adminCount = employees?.filter((e) => e.role === "ADMIN" && e.status === "ACTIVE").length ?? 0;

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      render: (e) => (
        <span>
          <span className="block font-medium">{e.name}</span>
          <span className="block font-mono text-[11px] text-faint">{e.email}</span>
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      render: (e) => (
        <Select
          aria-label={`Department for ${e.name}`}
          className="h-8 w-40 text-[13px]"
          value={e.departmentId ?? ""}
          disabled={changeDept.isPending && changeDept.variables?.id === e.id}
          onChange={(ev) => changeDept.mutate({ id: e.id, departmentId: ev.target.value ? Number(ev.target.value) : null })}
        >
          <option value="">Unassigned</option>
          {depts?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (e) => (
        // The ONE place in the app where roles change.
        <Select
          aria-label={`Role for ${e.name}`}
          className="h-8 w-40 text-[13px]"
          value={e.role}
          disabled={e.userId === user?.id}
          onChange={(ev) => {
            setRoleError(null);
            setRoleChange({ employee: e, newRole: ev.target.value as Role });
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      ),
    },
    { key: "status", header: "Status", hideBelow: "sm", render: (e) => <StatusChip domain="entity" status={e.status} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (e) =>
        e.userId === user?.id ? (
          <span className="text-xs text-faint">you</span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={setStatus.isPending && setStatus.variables?.id === e.id}
            onClick={() => setStatus.mutate({ id: e.id, status: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
          >
            {e.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
          </Button>
        ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-8" aria-label="Search employees" />
        </div>
        <Select aria-label="Department filter" className="w-auto" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {depts?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Role filter" className="w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-xs text-muted">
          <span className="font-mono tabular-nums">{adminCount}</span> active admin{adminCount === 1 ? "" : "s"} — the last one can&apos;t be demoted
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        loading={isLoading}
        empty={{ title: "Nobody matches", body: "Adjust the search or filters — new signups appear here automatically." }}
      />

      {/* Role changes are consequential — confirm, and note when they land. */}
      <Modal
        open={!!roleChange}
        onClose={() => { setRoleChange(null); setRoleError(null); }}
        title="Change role?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRoleChange(null); setRoleError(null); }}>
              Cancel
            </Button>
            <Button
              loading={changeRole.isPending}
              onClick={() => roleChange && changeRole.mutate({ id: roleChange.employee.id, newRole: roleChange.newRole })}
            >
              Change to {roleChange ? ROLE_LABEL[roleChange.newRole] : ""}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{roleChange?.employee.name}</span>: {roleChange ? ROLE_LABEL[roleChange.employee.role] : ""} →{" "}
          <span className="font-medium text-ink">{roleChange ? ROLE_LABEL[roleChange.newRole] : ""}</span>
        </p>
        <p className="mt-2 text-[13px] text-muted">Role changes apply on their next sign-in (the current session keeps its token until refresh).</p>
        {roleError && <p className="mt-3 rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{roleError}</p>}
      </Modal>
    </>
  );
}
