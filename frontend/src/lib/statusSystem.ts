// statusSystem.ts — the single source of truth for state color.
// Every chip in the app is driven by this config; do not hardcode state colors
// anywhere else. Values are fixed by the design brief.

export const ASSET_STATUS = {
  AVAILABLE:         { label: "Available",         fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  ALLOCATED:         { label: "Allocated",         fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  RESERVED:          { label: "Reserved",          fg: "#B54708", bg: "#FFFAEB", dot: "#F79009" },
  UNDER_MAINTENANCE: { label: "Under maintenance", fg: "#5925DC", bg: "#F4F3FF", dot: "#7A5AF8" },
  LOST:              { label: "Lost",              fg: "#B42318", bg: "#FEF3F2", dot: "#F04438" },
  RETIRED:           { label: "Retired",           fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
  DISPOSED:          { label: "Disposed",          fg: "#344054", bg: "#EAECF0", dot: "#667085" },
} as const;

export const BOOKING_STATUS = {
  UPCOMING:  { label: "Upcoming",  fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  ONGOING:   { label: "Ongoing",   fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  COMPLETED: { label: "Completed", fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
  CANCELLED: { label: "Cancelled", fg: "#667085", bg: "#F2F4F7", dot: "#98A2B3" }, // + strikethrough
} as const;

export const MAINT_STATUS = {
  PENDING:             { label: "Pending",     fg: "#B54708", bg: "#FFFAEB", dot: "#F79009" },
  APPROVED:            { label: "Approved",    fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  TECHNICIAN_ASSIGNED: { label: "Assigned",    fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  IN_PROGRESS:         { label: "In progress", fg: "#5925DC", bg: "#F4F3FF", dot: "#7A5AF8" },
  RESOLVED:            { label: "Resolved",    fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  REJECTED:            { label: "Rejected",    fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
} as const;

export const AUDIT_RESULT = {
  VERIFIED: { label: "Verified", fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  MISSING:  { label: "Missing",  fg: "#B42318", bg: "#FEF3F2", dot: "#F04438" },
  DAMAGED:  { label: "Damaged",  fg: "#B54708", bg: "#FFFAEB", dot: "#F79009" },
} as const;

// Workflow states that share the same visual language but sit outside the four
// core families (transfer queue, audit cycles). Same discipline: defined once here.
export const TRANSFER_STATUS = {
  REQUESTED: { label: "Pending",  fg: "#B54708", bg: "#FFFAEB", dot: "#F79009" },
  APPROVED:  { label: "Approved", fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  REJECTED:  { label: "Rejected", fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
} as const;

export const CYCLE_STATUS = {
  OPEN:   { label: "Open",   fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  CLOSED: { label: "Closed", fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
} as const;

export const ALLOCATION_STATUS = {
  ACTIVE:   { label: "Active",   fg: "#1570EF", bg: "#EFF8FF", dot: "#2E90FA" },
  RETURNED: { label: "Returned", fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
} as const;

// Binary active/inactive for org entities (departments, categories, employees).
export const ENTITY_STATUS = {
  ACTIVE:   { label: "Active",   fg: "#067647", bg: "#ECFDF3", dot: "#17B26A" },
  INACTIVE: { label: "Inactive", fg: "#475467", bg: "#F2F4F7", dot: "#98A2B3" },
} as const;

export type StatusStyle = { label: string; fg: string; bg: string; dot: string };

export type AssetStatusKey = keyof typeof ASSET_STATUS;
export type BookingStatusKey = keyof typeof BOOKING_STATUS;
export type MaintStatusKey = keyof typeof MAINT_STATUS;
export type AuditResultKey = keyof typeof AUDIT_RESULT;
export type TransferStatusKey = keyof typeof TRANSFER_STATUS;
export type CycleStatusKey = keyof typeof CYCLE_STATUS;

export const STATUS_DOMAINS = {
  asset: ASSET_STATUS,
  booking: BOOKING_STATUS,
  maintenance: MAINT_STATUS,
  audit: AUDIT_RESULT,
  transfer: TRANSFER_STATUS,
  cycle: CYCLE_STATUS,
  allocation: ALLOCATION_STATUS,
  entity: ENTITY_STATUS,
} as const;

export type StatusDomain = keyof typeof STATUS_DOMAINS;

export function statusStyle(domain: StatusDomain, key: string): StatusStyle {
  const table = STATUS_DOMAINS[domain] as Record<string, StatusStyle>;
  return (
    table[key] ?? {
      label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " "),
      fg: "#475467",
      bg: "#F2F4F7",
      dot: "#98A2B3",
    }
  );
}
