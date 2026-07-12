import { statusStyle, type StatusDomain } from "@/lib/statusSystem";
import { cn } from "@/lib/utils";

/**
 * Every state chip in the app: colored dot + label, driven entirely by
 * statusSystem.ts. Cancelled bookings additionally strike through.
 */
export function StatusChip({ domain, status, className }: { domain: StatusDomain; status: string; className?: string }) {
  const s = statusStyle(domain, status);
  const struck = domain === "booking" && status === "CANCELLED";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}
      style={{ color: s.fg, backgroundColor: s.bg }}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
      <span className={struck ? "line-through" : undefined}>{s.label}</span>
    </span>
  );
}

/**
 * Overdue is an emphasis treatment, not a status: a small solid red pill,
 * deliberately louder than the calm chips. Pair with a red row left-border.
 */
export function OverduePill({ className, children = "Overdue" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-danger-600 px-1.5 py-0.5 text-[11px] font-semibold text-white uppercase tracking-wide whitespace-nowrap", className)}>
      {children}
    </span>
  );
}
