"use client";

import { isApiError } from "@/api/client";
import { categories as catApi } from "@/api/org";
import type { Category, CustomFieldType } from "@/api/types";
import { PencilIcon, PlusIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { useCategories } from "@/lib/lookups";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

type FieldRow = { key: string; type: CustomFieldType };
const FIELD_TYPES: CustomFieldType[] = ["string", "number", "date", "boolean"];

export function CategoriesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cats, isLoading } = useCategories();

  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const open = (target: Category | "new") => {
    setEditing(target);
    setError(null);
    setName(target === "new" ? "" : target.name);
    setFields(target === "new" ? [] : Object.entries(target.customFields).map(([key, type]) => ({ key, type })));
  };

  const save = useMutation({
    mutationFn: () => {
      const customFields = Object.fromEntries(fields.filter((f) => f.key.trim()).map((f) => [f.key.trim(), f.type]));
      return editing === "new" ? catApi.create({ name: name.trim(), customFields }) : catApi.update((editing as Category).id, { name: name.trim(), customFields });
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editing === "new" ? "Category created" : "Category updated", c.name);
      setEditing(null);
    },
    onError: (e) => setError(isApiError(e) ? e.message : "Couldn't save — try again."),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => catApi.setStatus(id, isActive),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(c.isActive ? "Reactivated" : "Deactivated", `${c.name} ${c.isActive ? "is available for new assets." : "won't appear in the register form."}`);
    },
    onError: (e) => toast.error("Couldn't update", isApiError(e) ? e.direction : "Try again."),
  });

  const columns: Column<Category>[] = [
    { key: "name", header: "Category", render: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: "fields",
      header: "Custom fields",
      render: (c) => {
        const entries = Object.entries(c.customFields);
        return entries.length === 0 ? (
          <span className="text-faint">None</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {entries.map(([key, type]) => (
              <span key={key} className="rounded-md border border-hairline bg-paper px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {key}:{type}
              </span>
            ))}
          </span>
        );
      },
    },
    { key: "status", header: "Status", render: (c) => <StatusChip domain="entity" status={c.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      render: (c) => (
        <span className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => open(c)} aria-label={`Edit ${c.name}`}>
            <PencilIcon size={14} />
          </Button>
          <Button size="sm" variant="secondary" loading={setStatus.isPending && setStatus.variables?.id === c.id} onClick={() => setStatus.mutate({ id: c.id, isActive: !c.isActive })}>
            {c.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => open("new")}>
          <PlusIcon size={15} /> New category
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={cats}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={{ title: "No categories yet", body: "Categories drive the register form — their custom fields become inputs." }}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New category" : `Edit ${name || "category"}`} size="sm">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Name" required>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptops" autoFocus />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Custom fields</p>
            <p className="mb-2 text-xs text-faint">Each key becomes an input on the register form for assets in this category.</p>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={f.key}
                    onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                    placeholder="fieldKey"
                    aria-label={`Field ${i + 1} key`}
                    className="font-mono text-[13px]"
                  />
                  <Select
                    value={f.type}
                    onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, type: e.target.value as CustomFieldType } : x)))}
                    aria-label={`Field ${i + 1} type`}
                    className="w-32 shrink-0"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Button variant="ghost" size="sm" aria-label="Remove field" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
                    <XIcon size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setFields([...fields, { key: "", type: "string" }])}>
              <PlusIcon size={14} /> Add field
            </Button>
          </div>

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
