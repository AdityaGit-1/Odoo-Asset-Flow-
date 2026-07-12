"use client";

// Purpose-built SVG/CSS charts (no chart framework). Specs follow the dataviz
// method: 2px lines, ~10% area wash, ≤24px bars with 4px rounded data-ends,
// single-hue sequential ramp for the heatmap, recessive hairline grid, text in
// text tokens (never the series color), hover layer on every plot.

import { fmtDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

const COBALT = "#2B36D9";

// ---- Line/area: utilization trend ------------------------------------------------

export function UtilizationChart({ points }: { points: { weekStart: string; utilizationPct: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const W = 640;
  const H = 200;
  const PAD = { l: 34, r: 16, t: 10, b: 22 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / Math.max(1, points.length - 1)) * iw;
  const y = (v: number) => PAD.t + (1 - v / 100) * ih;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.utilizationPct).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = points[points.length - 1]!;
  const h = hover === null ? null : points[hover]!;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Utilization trend over ${points.length} weeks, currently ${last.utilizationPct}%`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.l) / iw) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Recessive grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#E4E7EC" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#8A909C" fontFamily="var(--font-mono)">
              {v}
            </text>
          </g>
        ))}
        {/* X labels — every other week */}
        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9.5} fill="#8A909C" fontFamily="var(--font-mono)">
              {fmtDateShort(p.weekStart)}
            </text>
          ) : null,
        )}
        <path d={area} fill={COBALT} opacity={0.1} />
        <path d={path} fill="none" stroke={COBALT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* End marker with surface ring + direct end label */}
        <circle cx={x(points.length - 1)} cy={y(last.utilizationPct)} r={4.5} fill={COBALT} stroke="#FFFFFF" strokeWidth={2} />
        <text x={x(points.length - 1) - 2} y={y(last.utilizationPct) - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="#17191F" fontFamily="var(--font-mono)">
          {last.utilizationPct}%
        </text>
        {/* Crosshair */}
        {h !== null && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#8A909C" strokeWidth={1} strokeDasharray="none" opacity={0.5} />
            <circle cx={x(hover)} cy={y(h.utilizationPct)} r={4.5} fill={COBALT} stroke="#FFFFFF" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h !== null && hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="whitespace-nowrap font-mono text-[11px] text-muted">wk of {fmtDateShort(h.weekStart)}</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{h.utilizationPct}%</p>
        </div>
      )}
    </div>
  );
}

// ---- Horizontal bars: maintenance frequency --------------------------------------

export function HBarChart({ rows, unit }: { rows: { key: string; count: number; openCount?: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="group flex items-center gap-3" title={`${r.key}: ${r.count} ${unit}${r.openCount ? ` (${r.openCount} open)` : ""}`}>
          <span className="w-32 shrink-0 truncate text-[13px] text-muted">{r.key}</span>
          <span className="relative h-5 flex-1">
            <span
              className="absolute inset-y-0 left-0 rounded-r bg-cobalt-600 transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(2, (100 * r.count) / max)}%` }}
            />
            <span className="absolute inset-y-0 flex items-center pl-2 font-mono text-[11px] font-semibold text-ink tabular-nums" style={{ left: `${Math.max(2, (100 * r.count) / max)}%` }}>
              {r.count}
              {r.openCount ? <span className="ml-1.5 font-normal text-faint">({r.openCount} open)</span> : null}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Heatmap: weekday × hour booking density --------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Single-hue sequential: light→dark cobalt by count. */
function cellColor(count: number, max: number): string {
  if (count === 0) return "#F0F2F5";
  const t = Math.min(1, count / max);
  const alpha = 0.15 + t * 0.85;
  return `rgba(43, 54, 217, ${alpha.toFixed(2)})`;
}

export function BookingHeatmapGrid({ hours, hourRange, max }: { hours: number[][]; hourRange: [number, number]; max: number }) {
  const [lo, hi] = hourRange;
  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `44px repeat(${DAYS.length}, 1fr)` }}>
          <span />
          {DAYS.map((d) => (
            <span key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
              {d}
            </span>
          ))}
          {range.map((hr) => (
            <HeatRow key={hr} hour={hr} counts={hours[hr] ?? []} max={max} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="text-[11px] text-faint">Fewer</span>
          <span className="flex gap-[3px]" aria-hidden>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t} className="h-3 w-6 rounded-[3px]" style={{ backgroundColor: t === 0 ? "#F0F2F5" : `rgba(43,54,217,${0.15 + t * 0.85})` }} />
            ))}
          </span>
          <span className="text-[11px] text-faint">More bookings</span>
        </div>
      </div>
    </div>
  );
}

function HeatRow({ hour, counts, max }: { hour: number; counts: number[]; max: number }) {
  return (
    <>
      <span className="pr-2 text-right font-mono text-[11px] leading-6 text-faint tabular-nums">{String(hour).padStart(2, "0")}:00</span>
      {DAYS.map((d, day) => {
        const count = counts[day] ?? 0;
        return (
          <span
            key={d}
            role="img"
            tabIndex={0}
            aria-label={`${d} ${hour}:00 — ${count} booking${count === 1 ? "" : "s"}`}
            title={`${d} ${String(hour).padStart(2, "0")}:00 · ${count} booking${count === 1 ? "" : "s"}`}
            className={cn("h-6 rounded-[3px] transition-transform hover:scale-105", count > 0 && "cursor-default")}
            style={{ backgroundColor: cellColor(count, max) }}
          />
        );
      })}
    </>
  );
}
