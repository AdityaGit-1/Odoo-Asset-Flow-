"use client";

import type { Booking } from "@/api/types";
import { fmtTime } from "@/lib/format";
import { BOOKING_STATUS } from "@/lib/statusSystem";
import { cn } from "@/lib/utils";

export const DAY_START = 7; // 07:00
export const DAY_END = 21; // grid ends 21:00
const ROW_H = 44;

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function DayColumn({
  day,
  bookings,
  onSlotClick,
  onBookingClick,
}: {
  day: Date;
  bookings: Booking[];
  onSlotClick: (start: Date) => void;
  onBookingClick: (b: Booking) => void;
}) {
  const dayBookings = bookings.filter((b) => b.status !== "CANCELLED" && isSameDay(new Date(b.start), day));
  const now = new Date();
  const showNowLine = isSameDay(now, day) && now.getHours() >= DAY_START && now.getHours() < DAY_END;

  return (
    <div className="relative min-w-28 flex-1 border-l border-hairline first:border-l-0">
      {/* Clickable empty slots */}
      {Array.from({ length: DAY_END - DAY_START }).map((_, i) => {
        const slotStart = new Date(day);
        slotStart.setHours(DAY_START + i, 0, 0, 0);
        const past = slotStart.getTime() < Date.now() - 60_000;
        return (
          <button
            key={i}
            type="button"
            disabled={past}
            aria-label={`Book ${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at ${String(DAY_START + i).padStart(2, "0")}:00`}
            onClick={() => onSlotClick(slotStart)}
            className={cn(
              "block w-full border-b border-hairline/60 transition-colors",
              past ? "cursor-default bg-paper/40" : "hover:bg-cobalt-050/60",
            )}
            style={{ height: ROW_H }}
          />
        );
      })}

      {/* Booking blocks — data is overlap-free by construction, so just render. */}
      {dayBookings.map((b) => {
        const start = new Date(b.start);
        const end = new Date(b.end);
        const startH = Math.max(DAY_START, start.getHours() + start.getMinutes() / 60);
        const endH = Math.min(DAY_END, end.getHours() + end.getMinutes() / 60 || DAY_END);
        const top = (startH - DAY_START) * ROW_H;
        const height = Math.max(20, (endH - startH) * ROW_H - 2);
        const style = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.UPCOMING;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onBookingClick(b)}
            className="absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-card transition-transform hover:scale-[1.01]"
            style={{ top, height, backgroundColor: style.bg, borderLeftColor: style.dot }}
          >
            <span className="block truncate font-mono text-[11px] font-medium tabular-nums" style={{ color: style.fg }}>
              {fmtTime(b.start)}–{fmtTime(b.end)}
            </span>
            {height > 34 && (
              <span className="block truncate text-[11px]" style={{ color: style.fg }}>
                {b.bookedByName ?? "Booked"}
              </span>
            )}
          </button>
        );
      })}

      {showNowLine && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: (now.getHours() + now.getMinutes() / 60 - DAY_START) * ROW_H }}
        >
          <span className="h-1.5 w-1.5 -translate-x-0.5 rounded-full bg-danger-500" />
          <span className="h-px flex-1 bg-danger-500/70" />
        </div>
      )}
    </div>
  );
}

export function BookingCalendar({
  days,
  bookings,
  onSlotClick,
  onBookingClick,
}: {
  days: Date[];
  bookings: Booking[];
  onSlotClick: (start: Date) => void;
  onBookingClick: (b: Booking) => void;
}) {
  const today = new Date();
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-surface shadow-card">
      <div className="min-w-fit">
        {/* Day headers */}
        <div className="flex border-b border-hairline pl-14">
          {days.map((day) => (
            <div key={day.toISOString()} className="min-w-28 flex-1 border-l border-hairline px-2 py-2 first:border-l-0">
              <p className={cn("text-xs font-semibold uppercase tracking-wider", isSameDay(day, today) ? "text-cobalt-600" : "text-muted")}>
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
              </p>
              <p className={cn("font-mono text-[13px] tabular-nums", isSameDay(day, today) ? "font-semibold text-cobalt-700" : "text-faint")}>
                {day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex">
          {/* Hour gutter */}
          <div className="w-14 shrink-0">
            {Array.from({ length: DAY_END - DAY_START }).map((_, i) => (
              <div key={i} className="border-b border-transparent pr-2 text-right font-mono text-[11px] text-faint tabular-nums" style={{ height: ROW_H }}>
                <span className="relative -top-1.5">{String(DAY_START + i).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn key={day.toISOString()} day={day} bookings={bookings} onSlotClick={onSlotClick} onBookingClick={onBookingClick} />
          ))}
        </div>
      </div>
    </div>
  );
}
