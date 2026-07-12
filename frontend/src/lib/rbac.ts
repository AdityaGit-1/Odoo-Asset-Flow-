// Client-side role gating is UX only — the server's 403s are the boundary.
import type { Role } from "@/api/types";

export const ALL_ROLES: Role[] = ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"];
export const MANAGERS: Role[] = ["ADMIN", "ASSET_MANAGER"];

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "package" | "transfer" | "calendar" | "wrench" | "audit" | "chart" | "building" | "activity";
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ALL_ROLES },
  { href: "/assets", label: "Assets", icon: "package", roles: ALL_ROLES },
  { href: "/allocations", label: "Allocation & transfer", icon: "transfer", roles: ALL_ROLES },
  { href: "/bookings", label: "Bookings", icon: "calendar", roles: ALL_ROLES },
  { href: "/maintenance", label: "Maintenance", icon: "wrench", roles: ALL_ROLES },
  { href: "/audits", label: "Audit", icon: "audit", roles: ALL_ROLES },
  { href: "/reports", label: "Reports", icon: "chart", roles: MANAGERS },
  { href: "/org", label: "Org setup", icon: "building", roles: ["ADMIN"] },
  { href: "/activity", label: "Activity log", icon: "activity", roles: MANAGERS },
];
