"use client";

import { allocations, transfers } from "@/api/allocations";
import { assets as assetsApi } from "@/api/assets";
import { ApiError } from "@/api/client";
import type { AllocationConflictBody } from "@/api/types";
import { TransferIcon } from "@/components/icons";
import { AssetTag } from "@/components/ui/asset-tag";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";
import { useDepartments, useEmployees } from "@/lib/lookups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

type ConflictState =
  | { phase: "conflict"; body: AllocationConflictBody }
  | { phase: "transfer-form"; body: AllocationConflictBody; reason: string; submitting: boolean; error: string | null }
  | { phase: "transfer-requested"; assetTag: string }
  | null;

/**
 * HERO FLOW #1. A 409 here is not an error page — it's the start of the
 * transfer workflow: "Held by {holder} since {date}" → Request transfer →
 * pending → approver queue.
 */
export function AllocateModal({ open, onClose, presetAssetId }: { open: boolean; onClose: () => void; presetAssetId?: number | null }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: emps } = useEmployees();
  const { data: depts } = useDepartments();

  const [assetId, setAssetId] = useState<string>("");
  const [holderType, setHolderType] = useState<"EMPLOYEE" | "DEPARTMENT">("EMPLOYEE");
  const [holderId, setHolderId] = useState<string>("");
  const [expectedReturn, setExpectedReturn] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState>(null);

  useEffect(() => {
    if (open && presetAssetId) setAssetId(String(presetAssetId));
  }, [open, presetAssetId]);

  // All non-terminal assets — trying an already-held one is exactly the demo.
  const { data: assetPage } = useQuery({
    queryKey: ["assets", "allocatable"],
    queryFn: () => assetsApi.list({ size: 200, sort: "assetTag,asc" }),
    enabled: open,
  });
  const candidates = assetPage?.content.filter((a) => !["RETIRED", "DISPOSED", "LOST"].includes(a.status)) ?? [];
  const groups = {
    Available: candidates.filter((a) => a.status === "AVAILABLE" || a.status === "RESERVED"),
    "Currently held": candidates.filter((a) => a.status === "ALLOCATED"),
    "Under maintenance": candidates.filter((a) => a.status === "UNDER_MAINTENANCE"),
  };
  const selectedAsset = candidates.find((a) => a.id === Number(assetId));

  const reset = () => {
    setAssetId("");
    setHolderId("");
    setExpectedReturn("");
    setError(null);
    setConflict(null);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["allocations"] });
    qc.invalidateQueries({ queryKey: ["transfers"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (assetId) qc.invalidateQueries({ queryKey: ["asset", Number(assetId)] });
  };

  const allocate = useMutation({
    mutationFn: () =>
      allocations.allocate({
        assetId: Number(assetId),
        holderEmployeeId: holderType === "EMPLOYEE" ? Number(holderId) : null,
        holderDepartmentId: holderType === "DEPARTMENT" ? Number(holderId) : null,
        expectedReturnAt: expectedReturn ? new Date(`${expectedReturn}T18:00`).toISOString() : null,
      }),
    onSuccess: (alloc) => {
      invalidate();
      toast.success("Allocated", `${alloc.asset?.assetTag ?? "Asset"} → ${alloc.holderName ?? "holder"}.`);
      reset();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as AllocationConflictBody;
        if (body?.canRequestTransfer) {
          setConflict({ phase: "conflict", body });
          return;
        }
      }
      setError(e instanceof ApiError ? e.direction : "Couldn't allocate — try again.");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflict(null);
    allocate.mutate();
  };

  const requestTransfer = async () => {
    if (conflict?.phase !== "transfer-form") return;
    setConflict({ ...conflict, submitting: true, error: null });
    try {
      await transfers.create({
        assetId: Number(assetId),
        toEmployeeId: holderType === "EMPLOYEE" && holderId ? Number(holderId) : null,
        toDepartmentId: holderType === "DEPARTMENT" && holderId ? Number(holderId) : null,
        reason: conflict.reason.trim() || undefined,
      });
      invalidate();
      setConflict({ phase: "transfer-requested", assetTag: conflict.body.assetTag ?? selectedAsset?.assetTag ?? "" });
    } catch (err) {
      setConflict({
        ...conflict,
        submitting: false,
        error: err instanceof ApiError ? err.message : "Couldn't send the request — try again.",
      });
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  const holderName =
    holderType === "EMPLOYEE" ? emps?.find((x) => x.id === Number(holderId))?.name : depts?.find((x) => x.id === Number(holderId))?.name;

  return (
    <Modal open={open} onClose={close} title="Allocate asset">
      {conflict?.phase === "transfer-requested" ? (
        <div className="py-2 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-cobalt-050 text-cobalt-600">
            <TransferIcon size={18} />
          </div>
          <p className="text-sm font-medium">Transfer requested</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted">
            {conflict.assetTag && <AssetTag tag={conflict.assetTag} className="mr-1 align-middle" />}
            is queued for approval. The current holder keeps it until an approver signs off — track it in the Transfer requests tab.
          </p>
          <Button className="mt-4" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Asset" required>
            <Select
              required
              value={assetId}
              onChange={(e) => {
                setAssetId(e.target.value);
                setConflict(null);
                setError(null);
              }}
            >
              <option value="" disabled>
                Pick an asset
              </option>
              {Object.entries(groups).map(([label, list]) =>
                list.length ? (
                  <optgroup key={label} label={label}>
                    {list.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.assetTag} · {a.name}
                        {a.currentHolder ? ` — held by ${a.currentHolder.name}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Allocate to" required>
              <Select
                value={holderType}
                onChange={(e) => {
                  setHolderType(e.target.value as "EMPLOYEE" | "DEPARTMENT");
                  setHolderId("");
                }}
              >
                <option value="EMPLOYEE">An employee</option>
                <option value="DEPARTMENT">A department</option>
              </Select>
            </Field>
            <Field label={holderType === "EMPLOYEE" ? "Employee" : "Department"} required>
              <Select required value={holderId} onChange={(e) => setHolderId(e.target.value)}>
                <option value="" disabled>
                  {holderType === "EMPLOYEE" ? "Pick an employee" : "Pick a department"}
                </option>
                {holderType === "EMPLOYEE"
                  ? emps?.filter((x) => x.status === "ACTIVE").map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))
                  : depts?.filter((x) => x.status === "ACTIVE").map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
              </Select>
            </Field>
          </div>

          <Field label="Expected return" hint="Optional — overdue tracking starts from this date.">
            <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </Field>

          {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}

          {/* The conflict panel — the 409 body rendered as a next step, not a dead end. */}
          {(conflict?.phase === "conflict" || conflict?.phase === "transfer-form") && (
            <div className="rounded-lg border border-[#F79009]/40 bg-[#FFFAEB] p-3.5">
              <p className="text-sm font-medium text-[#B54708]">
                Held by {conflict.body.currentHolder}
                {conflict.body.heldSince && <> since {fmtDate(conflict.body.heldSince)}</>}
              </p>
              {conflict.phase === "conflict" ? (
                <>
                  <p className="mt-1 text-[13px] text-[#B54708]/90">
                    {selectedAsset?.assetTag ?? "This asset"} can&apos;t be double-allocated. Request a transfer instead — the current holder keeps it
                    until {holderName ? `the move to ${holderName}` : "the move"} is approved.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setConflict({ phase: "transfer-form", body: conflict.body, reason: "", submitting: false, error: null })}>
                      <TransferIcon size={14} /> Request transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAssetId("");
                        setConflict(null);
                      }}
                    >
                      Pick another asset
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-2.5">
                  <Field label={`Why should ${holderName ?? "the new holder"} get it?`}>
                    <Textarea
                      value={conflict.reason}
                      onChange={(e) => setConflict({ ...conflict, reason: e.target.value })}
                      placeholder="Project need, handover, replacement…"
                      autoFocus
                    />
                  </Field>
                  {conflict.error && <p className="text-[13px] text-danger-700">{conflict.error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" loading={conflict.submitting} onClick={requestTransfer}>
                      Send request
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConflict({ phase: "conflict", body: conflict.body })} disabled={conflict.submitting}>
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {conflict?.phase !== "conflict" && conflict?.phase !== "transfer-form" && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={allocate.isPending}>
                Allocate
              </Button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
