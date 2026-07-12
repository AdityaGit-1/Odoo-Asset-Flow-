"use client";

import { allocations } from "@/api/allocations";
import { isApiError } from "@/api/client";
import type { Allocation, AssetCondition } from "@/api/types";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

const CONDITIONS: AssetCondition[] = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];

/** Return with condition check-in — the asset flips back to Available. */
export function ReturnModal({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => allocations.return(allocation!.id, { condition, notes: notes.trim() || undefined }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["allocations"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (a.assetId) qc.invalidateQueries({ queryKey: ["asset", a.assetId] });
      toast.success("Returned", `${a.asset?.assetTag ?? "Asset"} is Available again.`);
      setNotes("");
      setCondition("GOOD");
      onClose();
    },
    onError: (e) => setError(isApiError(e) ? e.direction : "Couldn't record the return — try again."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={!!allocation}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Return {allocation && <AssetTag tag={allocation.asset?.assetTag ?? `#${allocation.assetId}`} />}
        </span>
      }
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Checking in from <span className="font-medium text-ink">{allocation?.holderName}</span>. Record the condition as received.
        </p>
        <Field label="Condition check-in" required>
          <Select value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" hint="Scratches, missing accessories, anything the next holder should know.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
        {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Mark returned
          </Button>
        </div>
      </form>
    </Modal>
  );
}
