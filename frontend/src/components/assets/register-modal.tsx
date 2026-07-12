"use client";

import { assets } from "@/api/assets";
import { isApiError } from "@/api/client";
import type { AssetCondition, Category, CustomFieldType } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCategories } from "@/lib/lookups";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

const CONDITIONS: AssetCondition[] = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];

function CustomFieldInput({
  name,
  type,
  value,
  onChange,
}: {
  name: string;
  type: CustomFieldType;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
}) {
  const label = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  if (type === "boolean") {
    return <Toggle label={label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  return (
    <Field label={label}>
      <Input
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
      />
    </Field>
  );
}

export function RegisterAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cats } = useCategories();
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    serialNumber: "",
    acquisitionDate: "",
    acquisitionCost: "",
    condition: "GOOD" as AssetCondition,
    location: "",
    photoUrl: "",
    isBookable: false,
  });
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const category: Category | undefined = cats?.find((c) => c.id === Number(form.categoryId));
  const customFields = Object.entries(category?.customFields ?? {});

  const mutation = useMutation({
    mutationFn: () =>
      assets.register({
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        serialNumber: form.serialNumber.trim() || null,
        acquisitionDate: form.acquisitionDate || null,
        acquisitionCost: form.acquisitionCost === "" ? null : Number(form.acquisitionCost),
        condition: form.condition,
        location: form.location.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        isBookable: form.isBookable,
        customValues,
      }),
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Tag is server-assigned — surface it.
      toast.success(`${asset.assetTag} registered`, `${asset.name} is Available.`, { href: `/assets/${asset.id}`, label: "View asset" });
      onClose();
      setForm({ name: "", categoryId: "", serialNumber: "", acquisitionDate: "", acquisitionCost: "", condition: "GOOD", location: "", photoUrl: "", isBookable: false });
      setCustomValues({});
      setError(null);
    },
    onError: (e) => setError(isApiError(e) ? e.direction : "Couldn't save — try again."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Register asset" size="lg">
      <form onSubmit={submit} id="register-asset" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='MacBook Pro 14" M3' autoFocus />
        </Field>
        <Field label="Category" required hint={customFields.length ? "This category adds fields below." : undefined}>
          <Select
            required
            value={form.categoryId}
            onChange={(e) => {
              setForm({ ...form, categoryId: e.target.value });
              setCustomValues({});
            }}
          >
            <option value="" disabled>
              Pick a category
            </option>
            {cats?.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Serial number" hint="Must be unique if set.">
          <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-…" className="font-mono" />
        </Field>
        <Field label="Acquisition date">
          <Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
        </Field>
        <Field label="Acquisition cost">
          <Input type="number" min={0} step="0.01" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Condition" required>
          <Select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as AssetCondition })}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Floor 2 · Engineering" />
        </Field>
        <Field label="Photo URL" className="sm:col-span-2">
          <Input type="url" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://…" />
        </Field>

        {customFields.length > 0 && (
          <fieldset className="sm:col-span-2 grid grid-cols-1 gap-4 rounded-lg border border-dashed border-hairline p-3 sm:grid-cols-2">
            <legend className="px-1 font-mono text-[11px] tracking-wider text-faint">{category!.name.toUpperCase()} FIELDS</legend>
            {customFields.map(([name, type]) => (
              <CustomFieldInput key={name} name={name} type={type} value={customValues[name]} onChange={(v) => setCustomValues((cv) => ({ ...cv, [name]: v }))} />
            ))}
          </fieldset>
        )}

        <div className="sm:col-span-2">
          <Toggle
            label="Shared bookable resource"
            hint="Meeting rooms, cameras, pool cars — anyone can book time slots."
            checked={form.isBookable}
            onChange={(e) => setForm({ ...form, isBookable: e.target.checked })}
          />
        </div>

        {error && <p className="sm:col-span-2 rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <p className="sm:col-span-2 text-xs text-faint">The asset tag (AF-####) is assigned by the server on save.</p>

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Register
          </Button>
        </div>
      </form>
    </Modal>
  );
}
