import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<
  ButtonVariant,
  string
> = {
  primary:
    "bg-[var(--accent)] text-black hover:opacity-90",
  secondary:
    "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-3)]",
  ghost:
    "bg-transparent text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  danger:
    "bg-transparent text-red-400 hover:bg-red-500/10",
  icon:
    "bg-transparent text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
};

const sizes: Record<
  NonNullable<ButtonProps["size"]>,
  string
> = {
  sm: "min-h-8 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--accent)]",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}

      {children}
    </button>
  );
}