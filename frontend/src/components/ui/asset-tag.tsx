import { cn } from "@/lib/utils";

/**
 * The signature element: an asset tag rendered as a physical label — mono,
 * tabular, letter-spaced, hairline border. Used everywhere an asset appears.
 */
export function AssetTag({ tag, size = "sm", className }: { tag: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-hairline bg-surface font-mono font-medium tracking-[0.08em] text-ink tabular-nums whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[13px]" : "px-2.5 py-1 text-base",
        className,
      )}
    >
      {tag}
    </span>
  );
}
