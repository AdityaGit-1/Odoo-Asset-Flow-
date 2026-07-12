import type { ReactNode } from "react";

/**
 * The one screen allowed to breathe: centered card over a faint blueprint
 * grid — the tag/control-board motif as ambience, kept disciplined.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(43,54,217,0.045) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(43,54,217,0.045) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%)",
        }}
      />
      <div className="relative z-10 mb-8 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cobalt-600 shadow-card">
          <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
            <rect x="7" y="10" width="18" height="12" rx="2.5" fill="none" stroke="#EEF0FE" strokeWidth="2.5" />
            <circle cx="11.5" cy="16" r="1.6" fill="#EEF0FE" />
            <path d="M16 13v6M19.5 13v6M22 13v6" stroke="#EEF0FE" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="text-lg font-semibold leading-tight tracking-tight">AssetFlow</p>
          <p className="font-mono text-[11px] tracking-[0.14em] text-faint">ASSET &amp; RESOURCE CONTROL</p>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
