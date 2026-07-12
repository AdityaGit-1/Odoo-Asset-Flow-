"use client";

import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/format";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { Button } from "./button";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon } from "@/components/icons";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align (numbers). Numeric cells also get mono + tabular figures. */
  align?: "right";
  mono?: boolean;
  sortable?: boolean;
  className?: string;
  /** Hide below a breakpoint to keep mobile scannable. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

const hideClass = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  rowClassName,
  empty,
  pagination,
  sort,
  stickyTop = "top-14",
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Extra classes per row — e.g. the overdue red left-border treatment. */
  rowClassName?: (row: T) => string | undefined;
  empty: { title: string; body?: string; action?: ReactNode };
  pagination?: { page: number; totalPages: number; totalElements: number; onPage: (page: number) => void };
  sort?: SortState & { onSort: (key: string) => void };
  stickyTop?: string;
}) {
  const showSkeleton = loading && (!rows || rows.length === 0);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort && sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "sticky z-10 border-b border-hairline bg-surface px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted first:pl-4 last:pr-4",
                      stickyTop,
                      col.align === "right" && "text-right",
                      col.hideBelow && hideClass[col.hideBelow],
                    )}
                  >
                    {col.sortable && sort ? (
                      <button
                        type="button"
                        onClick={() => sort.onSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink",
                          active && "text-ink",
                        )}
                      >
                        {col.header}
                        {active ? (
                          sort.dir === "asc" ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />
                        ) : (
                          <ChevronsUpDownIcon size={12} className="text-faint" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-3 py-3 first:pl-4 last:pr-4", col.hideBelow && hideClass[col.hideBelow])}>
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row);
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      "h-11 border-b border-hairline transition-colors last:border-0",
                      onRowClick && "cursor-pointer hover:bg-hover",
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2 first:pl-4 last:pr-4",
                          col.align === "right" && "text-right",
                          (col.mono || col.align === "right") && "font-mono text-[13px] tabular-nums",
                          col.hideBelow && hideClass[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!showSkeleton && rows?.length === 0 && <EmptyState title={empty.title} body={empty.body} action={empty.action} />}

      {pagination && pagination.totalElements > 0 && (
        <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
          <p className="text-xs text-muted">
            <span className="font-mono tabular-nums">{fmtNumber(pagination.totalElements)}</span>{" "}
            {pagination.totalElements === 1 ? "result" : "results"}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" disabled={pagination.page === 0} onClick={() => pagination.onPage(pagination.page - 1)} aria-label="Previous page">
              <ChevronLeftIcon size={14} />
            </Button>
            <span className="px-1 text-xs text-muted">
              Page <span className="font-mono tabular-nums">{pagination.page + 1}</span> of{" "}
              <span className="font-mono tabular-nums">{pagination.totalPages}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages - 1}
              onClick={() => pagination.onPage(pagination.page + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
