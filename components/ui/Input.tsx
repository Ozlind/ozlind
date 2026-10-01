import type {
  InputHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({
  error,
  className,
  id,
  ...props
}: InputProps) {
  const describedBy =
    error && id
      ? `${id}-error`
      : undefined;

  return (
    <div className="w-full">
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 w-full rounded-xl border",
          "border-[var(--border)]",
          "bg-[var(--surface-2)]",
          "px-3.5 text-sm text-[var(--text)]",
          "placeholder:text-[var(--text-faint)]",
          "outline-none transition-colors",
          "focus:border-[var(--accent)]",
          "focus:ring-2 focus:ring-[var(--accent)]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />

      {error ? (
        <p
          id={
            id
              ? `${id}-error`
              : undefined
          }
          role="alert"
          className="mt-1.5 text-xs text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}