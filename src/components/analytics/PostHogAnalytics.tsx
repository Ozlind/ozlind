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

  const path = safePath(window.location.pathname);
  const body = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: distinctId,
    properties: {
      $current_url: `${window.location.origin}${path}`,
      $pathname: path,
      $lib: "ozlind-native",
      $lib_version: "1.0.2",
      ...properties,
    },
  });

  // Use the documented capture endpoint with JSON so ingestion can validate
  // the event payload. A queued sendBeacon can silently hide cross-origin
  // ingestion failures, so use fetch and check the HTTP response instead.
  try {
    void fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).then((response) => {
      if (!response.ok) {
        console.warn("[Ozlind analytics] PostHog rejected an event:", response.status);
      }
    }).catch(() => {
      console.warn("[Ozlind analytics] Could not reach the PostHog ingestion endpoint.");
    });
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
