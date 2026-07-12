import { cn } from "@/lib/utils";
import { SpinnerIcon } from "@/components/icons";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-cobalt-600 text-white hover:bg-cobalt-500 active:bg-cobalt-700 disabled:opacity-50 disabled:hover:bg-cobalt-600",
  secondary: "bg-surface text-ink border border-hairline hover:bg-hover disabled:opacity-50 disabled:hover:bg-surface",
  ghost: "text-muted hover:bg-hover hover:text-ink disabled:opacity-50",
  danger: "bg-danger-600 text-white hover:bg-danger-500 active:bg-danger-700 disabled:opacity-50 disabled:hover:bg-danger-600",
};

const sizes = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <SpinnerIcon size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
