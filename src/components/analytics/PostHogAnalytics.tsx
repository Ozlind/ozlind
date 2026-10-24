"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
const OPT_OUT_KEY = "ozlind_analytics_opt_out";
const DISTINCT_ID_KEY = "ozlind_analytics_distinct_id";

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1" || navigator.doNotTrack === "1";
  } catch {
    return true;
  }
}

function getDistinctId(): string | null {
  try {
    let id = localStorage.getItem(DISTINCT_ID_KEY);
    if (!id) {
      id = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `oz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DISTINCT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function safePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^[a-z0-9_-]{24,}$/i.test(segment)) {
        return "[id]";
      }
      return segment;
    })
    .join("/");
}

function capture(event: string, properties: Record<string, string | number | boolean>): void {
  if (!KEY || isOptedOut()) return;
  const distinctId = getDistinctId();
  if (!distinctId) return;

  const body = JSON.stringify({
    api_key: KEY,
    event,
    properties: {
      distinct_id: distinctId,
      $current_url: `${window.location.origin}${safePath(window.location.pathname)}`,
      $pathname: safePath(window.location.pathname),
      $lib: "ozlind-native",
      $lib_version: "1.0.1",
      ...properties,
    },
  });

  // Use a CORS-safelisted content type for cross-origin beacon delivery.
  // Some browsers can report sendBeacon() as queued even when a non-safelisted
  // JSON content type would trigger a failed preflight at the ingestion host.
  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        `${HOST}/i/v0/e/`,
        new Blob([body], { type: "text/plain;charset=UTF-8" }),
      );
      if (sent) return;
    }
    void fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Analytics must never break the application.
  }
}

export default function PostHogAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY || !pathname) return;
    capture("$pageview", { $title: document.title });
  }, [pathname]);

  useEffect(() => {
    if (!KEY) return;

    const onError = (event: ErrorEvent) => {
      capture("ozlind_client_error", {
        error_type: event.error instanceof Error ? event.error.name : "WindowError",
        error_source: "window",
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      capture("ozlind_client_error", {
        error_type: event.reason instanceof Error ? event.reason.name : "UnhandledRejection",
        error_source: "promise",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
