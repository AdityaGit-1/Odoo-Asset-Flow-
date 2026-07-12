"use client";

import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({ tabs, active, onChange, className }: { tabs: TabDef[]; active: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-hairline", className)}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              selected ? "border-cobalt-600 text-ink" : "border-transparent text-muted hover:border-hairline hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[11px] tabular-nums",
                  selected ? "bg-cobalt-050 text-cobalt-700" : "bg-hover text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
