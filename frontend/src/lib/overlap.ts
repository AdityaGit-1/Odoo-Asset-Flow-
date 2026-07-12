/**
 * Half-open [start, end) overlap — the booking-slot semantics from the phase-4
 * brief. Touching boundaries do NOT overlap: after a 09:00–10:00 booking,
 * 10:00–11:00 is free and 09:30–10:30 conflicts.
 */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
