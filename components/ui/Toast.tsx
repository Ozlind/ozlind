"use client";

import {
  useEffect,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant =
  | "success"
  | "error"
  | "info";

interface ToastProps {
  open: boolean;
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function Toast({
  open,
  message,
  variant = "info",
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!open || duration <= 0) {
      return;
    }

    const timer = window.setTimeout(
      onClose,
      duration,
    );

    return () =>
      window.clearTimeout(timer);
  }, [
    open,
    duration,
    onClose,
  ]);

  if (!open || !message) {
    return null;
  }

  const Icon = icons[variant];

  return (
    <div
      role={
        variant === "error"
          ? "alert"
          : "status"
      }
      className={cn(
        "fixed inset-x-4 bottom-4 z-[60]",
        "mx-auto flex max-w-md items-center gap-3",
        "rounded-xl border px-3.5 py-3",
        "bg-[var(--surface-1)] shadow-xl",
        "sm:inset-x-auto sm:right-5 sm:left-auto",
        variant === "error"
          ? "border-red-500/30"
          : "border-[var(--border)]",
      )}
    >
      <Icon
        size={17}
        aria-hidden="true"
        className={
          variant === "error"
            ? "text-red-400"
            : variant === "success"
              ? "text-emerald-400"
              : "text-[var(--accent)]"
        }
      />

      <p className="min-w-0 flex-1 text-sm text-[var(--text)]">
        {message}
      </p>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        <X
          size={15}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}