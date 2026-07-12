"use client";

import { NAV_ITEMS } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  AuditIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  DashboardIcon,
  PackageIcon,
  TransferIcon,
  WrenchIcon,
  XIcon,
} from "@/components/icons";

const ICONS = {
  dashboard: DashboardIcon,
  package: PackageIcon,
  transfer: TransferIcon,
  calendar: CalendarIcon,
  wrench: WrenchIcon,
  audit: AuditIcon,
  chart: ChartIcon,
  building: BuildingIcon,
  activity: ActivityIcon,
};

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cobalt-600">
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden>
          <rect x="7" y="10" width="18" height="12" rx="2.5" fill="none" stroke="#EEF0FE" strokeWidth="2.5" />
          <circle cx="11.5" cy="16" r="1.6" fill="#EEF0FE" />
          <path d="M16 13v6M19.5 13v6M22 13v6" stroke="#EEF0FE" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">AssetFlow</span>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active ? "bg-cobalt-050 font-medium text-cobalt-700" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon size={16} className={active ? "text-cobalt-600" : "text-faint"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-surface lg:flex">
      <div className="flex h-14 items-center border-b border-hairline px-4">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <SidebarNav />
      </div>
      <div className="border-t border-hairline px-5 py-3">
        <p className="font-mono text-[11px] tracking-wider text-faint">ASSETFLOW · INTERNAL</p>
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden className="fixed inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-overlay">
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
          <Logo />
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-muted hover:bg-hover">
            <XIcon size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
