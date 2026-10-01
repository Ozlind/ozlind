import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LIMITS, TEXT_FILE_PATTERN } from "@/constants/limits";

/** Merges conditional class names and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > LIMITS.titleMaxChars
    ? `${cleaned.slice(0, LIMITS.titleMaxChars).trim()}…`
    : cleaned;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("");
  return (letters.slice(0, 2) || "U").toUpperCase();
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isTextFile(file: Pick<File, "name" | "type">): boolean {
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    TEXT_FILE_PATTERN.test(file.name)
  );
}

/** Compile-time exhaustiveness check for switch statements over unions. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}