import type {
  HTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

interface SkeletonProps
  extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg",
        "bg-[var(--surface-3)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "space-y-2",
        className,
      )}
    >
      {Array.from({
        length: Math.max(1, lines),
      }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3",
            index === lines - 1
              ? "w-2/3"
              : "w-full",
          )}
        />
      ))}
    </div>
  );
}