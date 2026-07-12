"use client";

import { assets as assetsApi } from "@/api/assets";
import { isApiError } from "@/api/client";
import { maintenance } from "@/api/maintenance";
import type { MaintPriority } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

const PRIORITIES: MaintPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function RaiseMaintenanceModal({ open, onClose, presetAssetId }: { open: boolean; onClose: () => void; presetAssetId?: number | null }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [assetId, setAssetId] = useState("");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState<MaintPriority>("MEDIUM");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && presetAssetId) setAssetId(String(presetAssetId));
  }, [open, presetAssetId]);

  const { data: assetPage } = useQuery({
    queryKey: ["assets", "maintainable"],
    queryFn: () => assetsApi.list({ size: 200, sort: "assetTag,asc" }),
    enabled: open,
  });
  const candidates = assetPage?.content.filter((a) => !["RETIRED", "DISPOSED", "LOST"].includes(a.status)) ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      maintenance.raise({ assetId: Number(assetId), issue: issue.trim(), priority, photoUrl: photoUrl.trim() || null }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Request raised", `${r.asset?.assetTag ?? "Asset"} is queued for approval — the asset stays in service until then.`);
      setIssue("");
      setPhotoUrl("");
      setPriority("MEDIUM");
      setAssetId("");
      onClose();
    },
    onError: (e) => setError(isApiError(e) ? e.direction : "Couldn't raise the request — try again."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Raise maintenance request" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Asset" required>
          <Select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="" disabled>
              Which asset is faulty?
            </option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetTag} · {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What's wrong?" required>
          <Textarea required value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Symptoms, when it started, anything you tried…" autoFocus={!!presetAssetId} />
        </Field>
        <Field label="Priority" required>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as MaintPriority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Photo URL" hint="Optional — a picture of the fault helps triage.">
          <Input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        </Field>
        {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Raise request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
