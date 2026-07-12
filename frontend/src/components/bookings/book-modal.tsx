"use client";

import { bookings as bookingsApi } from "@/api/bookings";
import { ApiError } from "@/api/client";
import type { Asset, Booking, BookingConflictBody } from "@/api/types";
import { AlertTriangleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtSlot, toLocalInput } from "@/lib/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

export interface BookModalState {
  resourceId?: number;
  start?: Date;
  /** Set when rescheduling an existing booking. */
  reschedule?: Booking;
}

/**
 * HERO FLOW #2. On a 409 overlap the modal stays open and shows a clear,
 * directional message with the conflicting range — never a raw error. The
 * boundary case is demoable here: after 09:00–10:00, booking 10:00–11:00
 * succeeds and 09:30–10:30 is rejected.
 */
export function BookModal({
  state,
  onClose,
  resources,
}: {
  state: BookModalState | null;
  onClose: () => void;
  resources: Asset[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [resourceId, setResourceId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [conflict, setConflict] = useState<BookingConflictBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setConflict(null);
    setError(null);
    if (state.reschedule) {
      setResourceId(String(state.reschedule.resourceId));
      setStart(toLocalInput(state.reschedule.start));
      setEnd(toLocalInput(state.reschedule.end));
      return;
    }
    setResourceId(state.resourceId ? String(state.resourceId) : "");
    const s = state.start ?? (() => {
      const d = new Date(Date.now() + 60 * 60_000);
      d.setMinutes(0, 0, 0);
      return d;
    })();
    setStart(toLocalInput(s));
    setEnd(toLocalInput(new Date(s.getTime() + 60 * 60_000)));
  }, [state]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
      return state?.reschedule
        ? bookingsApi.reschedule(state.reschedule.id, body)
        : bookingsApi.create({ resourceId: Number(resourceId), ...body });
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(state?.reschedule ? "Booking moved" : "Booked", `${b.resource?.name ?? "Resource"} · ${fmtSlot(b.start, b.end)}`);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        // The overlap body — show it as direction, keep the form live.
        setConflict(e.body as BookingConflictBody);
        return;
      }
      setError(e instanceof ApiError ? e.direction : "Couldn't book — try again.");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setConflict(null);
    setError(null);
    mutation.mutate();
  };

  const resource = resources.find((r) => r.id === Number(resourceId));

  return (
    <Modal open={!!state} onClose={onClose} title={state?.reschedule ? `Move booking — ${resource?.name ?? ""}` : "Book a resource"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {!state?.reschedule && (
          <Field label="Resource" required>
            <Select required value={resourceId} onChange={(e) => { setResourceId(e.target.value); setConflict(null); }}>
              <option value="" disabled>
                Pick a shared resource
              </option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.assetTag} · {r.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Starts" required hint="Slot start is inclusive.">
            <Input type="datetime-local" required value={start} onChange={(e) => { setStart(e.target.value); setConflict(null); }} />
          </Field>
          <Field label="Ends" required hint="End is exclusive — back-to-back is fine.">
            <Input type="datetime-local" required value={end} onChange={(e) => { setEnd(e.target.value); setConflict(null); }} />
          </Field>
        </div>

        {conflict && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#F79009]/40 bg-[#FFFAEB] px-3 py-2.5">
            <AlertTriangleIcon size={15} className="mt-0.5 shrink-0 text-[#F79009]" />
            <div className="text-[13px] text-[#B54708]">
              <p className="font-medium">{conflict.message}</p>
              <p className="mt-0.5 text-[#B54708]/80">
                Tip: end times are exclusive — a slot starting exactly when {conflict.conflict ? "that one" : "the existing one"} ends will go through.
              </p>
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {state?.reschedule ? "Move booking" : "Book slot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
