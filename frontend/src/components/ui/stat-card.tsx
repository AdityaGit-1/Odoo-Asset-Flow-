"use client";

import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";
import { Skeleton } from "./skeleton";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * KPI tile. Numbers are mono + tabular per the design brief. `tone="danger"`
 * is reserved for Overdue Returns — the one card allowed to shout.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  href,
  icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  tone?: "default" | "danger";
  href?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  const display = useCountUp(loading ? undefined : value);
  const danger = tone === "danger";

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-medium", danger ? "text-danger-700" : "text-muted")}>{label}</p>
        {icon && <span className={danger ? "text-danger-500" : "text-faint"}>{icon}</span>}
      </div>
      {loading || display === undefined ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className={cn("mt-1 font-mono text-[28px] font-semibold leading-9 tabular-nums", danger ? "text-danger-700" : "text-ink")}>
          {fmtNumber(display)}
        </p>
      )}
      {sub && <p className={cn("mt-0.5 text-xs", danger ? "text-danger-600" : "text-faint")}>{sub}</p>}
    </>
  );

  const className = cn(
    "block rounded-lg border bg-surface p-4 shadow-card transition-colors",
    danger ? "border-danger-500/40 border-l-[3px] border-l-danger-500" : "border-hairline",
    href && "hover:bg-hover",
  );

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
