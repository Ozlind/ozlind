"use client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const INGEST_PATH = "/ingest/i/v0/e";
const OPT_OUT_KEY = "ozlind_analytics_opt_out";
const ANONYMOUS_ID_KEY = "ozlind_analytics_distinct_id";
const USER_ID_KEY = "ozlind_analytics_user_id";

type AnalyticsValue = string | number | boolean;
type AnalyticsEventName =
  | "$pageview"
  | "$identify"
  | "ozlind_client_error"
  | "ozlind_web_vital"
  | "ozlind_ai_request_completed";

const ALLOWED_EVENTS = new Set<AnalyticsEventName>([
  "$pageview",
  "$identify",
  "ozlind_client_error",
  "ozlind_web_vital",
  "ozlind_ai_request_completed",
]);

// Explicit allowlist prevents chat text, responses, filenames, URLs, tokens,
// conversation IDs, emails, stack traces, and other arbitrary values entering analytics.
const ALLOWED_PROPERTIES = new Set([
  "$title",
  "$anon_distinct_id",
  "error_type",
  "error_source",
  "metric_name",
  "metric_value",
  "metric_rating",
  "navigation_type",
  "duration_ms",
  "status_code",
  "model_mode",
  "has_attachments",
  "action",
  "result",
  "used_web_search",
]);

let memoryAnonymousId = "";
let memoryUserId: string | null = null;

function makeDistinctId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `oz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isOptedOut(): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function getAnonymousId(): string {
  try {
    let id = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!id) {
      id = makeDistinctId();
      localStorage.setItem(ANONYMOUS_ID_KEY, id);
    }
    memoryAnonymousId = id;
    return id;
  } catch {
    if (!memoryAnonymousId) memoryAnonymousId = makeDistinctId();
    return memoryAnonymousId;
  }
}

function getStoredUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY) || memoryUserId;
  } catch {
    return memoryUserId;
  }
}

function currentDistinctId(): string {
  return getStoredUserId() || getAnonymousId();
}

function safePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
        /^[a-z0-9_-]{24,}$/i.test(segment) ||
        /^[^/]+@[^/]+\.[^/]+$/.test(segment)
      ) {
        return "[id]";
      }
      return segment;
    })
    .join("/");
}

function safeProperties(properties: Record<string, AnalyticsValue>): Record<string, AnalyticsValue> {
  const sanitized: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
    const clean = value.replace(/[\r\n\t]/g, " ").trim().slice(0, 120);
    if (clean) sanitized[key] = clean;
  }
  return sanitized;
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  properties: Record<string, AnalyticsValue> = {},
): void {
  if (
    typeof window === "undefined" ||
    !POSTHOG_KEY ||
    !POSTHOG_HOST ||
    !ALLOWED_EVENTS.has(event) ||
    isOptedOut()
  ) {
    return;
  }

  try {
    const path = safePath(window.location.pathname);
    const body = JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: currentDistinctId(),
      properties: {
        $current_url: `${window.location.origin}${path}`,
        $pathname: path,
        $lib: "ozlind-native",
        $lib_version: "1.1.0",
        // Avoid GeoIP enrichment for these events. Project-level IP anonymization
        // remains a separate PostHog setting.
        $geoip_disable: true,
        ...safeProperties(properties),
      },
    });

    // Same-origin Vercel rewrite avoids cross-origin CORS/CSP failures and
    // reduces common tracker-blocking issues without exposing any server secret.
    void fetch(INGEST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          console.warn("[Ozlind analytics] PostHog ingestion returned HTTP", response.status);
        }
      })
      .catch(() => {
        // Analytics must never interrupt the chat or another app interaction.
        console.warn("[Ozlind analytics] First-party ingestion request failed.");
      });
  } catch {
    // Analytics must never interrupt the app.
  }
}

export function identifyAnalyticsUser(userId: string): void {
  if (
    typeof window === "undefined" ||
    !POSTHOG_KEY ||
    !POSTHOG_HOST ||
    isOptedOut() ||
    !/^[a-z0-9_-]{8,128}$/i.test(userId)
  ) {
    return;
  }

  const previousUserId = getStoredUserId();
  if (previousUserId === userId) return;

  let anonymousId = getAnonymousId();
  if (previousUserId && previousUserId !== userId) {
    // Never connect two signed-in accounts through the same anonymous identity.
    memoryUserId = null;
    memoryAnonymousId = makeDistinctId();
    anonymousId = memoryAnonymousId;
    try {
      localStorage.removeItem(ANONYMOUS_ID_KEY);
      localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
      localStorage.removeItem(USER_ID_KEY);
    } catch {
      // In-memory identity remains usable when browser storage is unavailable.
    }
  }

  memoryUserId = userId;
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {
    // Keep the user ID in memory for this tab only.
  }

  // Use only the stable Supabase user ID. Never send email or display name.
  trackAnalyticsEvent("$identify", { $anon_distinct_id: anonymousId });
}

export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined") return;
  memoryUserId = null;
  memoryAnonymousId = makeDistinctId();
  try {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.setItem(ANONYMOUS_ID_KEY, memoryAnonymousId);
  } catch {
    // In-memory anonymous identity remains usable.
  }
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optOut) {
      localStorage.setItem(OPT_OUT_KEY, "1");
      resetAnalyticsIdentity();
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
      getAnonymousId();
    }
  } catch {
    // Respect a failed storage write as best effort without disrupting the app.
  }
}
