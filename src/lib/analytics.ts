"use client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const INGEST_PATH = "/ingest/i/v0/e";
const OPT_OUT_KEY = "ozlind_analytics_opt_out";
const ANONYMOUS_ID_KEY = "ozlind_analytics_distinct_id";
const USER_ID_KEY = "ozlind_analytics_user_id";
const SESSION_ID_KEY = "ozlind_analytics_session_id";
const WINDOW_ID_KEY = "ozlind_analytics_window_id";
const CONSENT_CHANGED_EVENT = "ozlind:analytics-consent-changed";

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
let memorySessionId: string | null = null;
let memoryWindowId: string | null = null;
let memoryOptOut = false;

function makeDistinctId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Keep identifiers UUID-shaped for Capture API event de-duplication on older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isOptedOut(): boolean {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return true;
  if (memoryOptOut) return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    // Keep a session-only opt-out if browser storage is unavailable.
    return memoryOptOut;
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
    // When storage is available, its absence is authoritative (including
    // sign-out in another tab); only fall back to memory if storage is blocked.
    return localStorage.getItem(USER_ID_KEY) || null;
  } catch {
    return memoryUserId;
  }
}

function getTabScopedId(key: string): string {
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = makeDistinctId();
      sessionStorage.setItem(key, id);
    }
    if (key === SESSION_ID_KEY) memorySessionId = id;
    else memoryWindowId = id;
    return id;
  } catch {
    if (key === SESSION_ID_KEY) {
      if (!memorySessionId) memorySessionId = makeDistinctId();
      return memorySessionId;
    }
    if (!memoryWindowId) memoryWindowId = makeDistinctId();
    return memoryWindowId;
  }
}

function getSessionId(): string {
  return getTabScopedId(SESSION_ID_KEY);
}

function getWindowId(): string {
  return getTabScopedId(WINDOW_ID_KEY);
}

function currentDistinctId(): string {
  return getStoredUserId() || getAnonymousId();
}

function resetTabScopedIdentity(): void {
  memorySessionId = null;
  memoryWindowId = null;
  try {
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(WINDOW_ID_KEY);
  } catch {
    // The in-memory identifiers will rotate on the next event.
  }
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

const ALLOWED_STRING_VALUES: Record<string, ReadonlySet<string>> = {
  error_source: new Set(["window", "promise"]),
  metric_name: new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  metric_rating: new Set(["good", "needs-improvement", "poor", "unknown"]),
  navigation_type: new Set(["navigate", "reload", "back_forward", "prerender", "unknown"]),
  model_mode: new Set(["auto", "fast", "vision", "pro"]),
  action: new Set(["send", "regenerate"]),
  result: new Set(["success", "failed", "aborted", "duplicate"]),
};

function safeProperties(properties: Record<string, AnalyticsValue>): Record<string, AnalyticsValue> {
  const sanitized: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;

    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) continue;
      if (key === "status_code" && (!Number.isInteger(value) || value > 599)) continue;
      if (key === "duration_ms" && value > 1_800_000) continue;
      if (key === "metric_value" && value > 10_000_000) continue;
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    const clean = value.replace(/[\r\n\t]/g, " ").trim().slice(0, 120);
    if (!clean) continue;
    const allowedValues = ALLOWED_STRING_VALUES[key];
    if (allowedValues && !allowedValues.has(clean)) continue;
    if (key === "error_type" && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(clean)) continue;
    if (key === "$anon_distinct_id" && !/^[a-z0-9_-]{8,128}$/i.test(clean)) continue;
    sanitized[key] = clean;
  }
  return sanitized;
}

async function deliverCapture(body: string): Promise<void> {
  // Reuse the same event UUID for one bounded retry, preventing a retry from
  // counting twice if the first response is lost after successful ingestion.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(INGEST_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.ok) return;
      if (attempt === 0 && response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      console.warn("[Ozlind analytics] PostHog ingestion returned HTTP", response.status);
      return;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      // No event or user payload is written to the console.
      console.warn("[Ozlind analytics] First-party ingestion request failed.");
      return;
    }
  }
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
      uuid: makeDistinctId(),
      properties: {
        // PostHog Capture API requires distinct_id inside properties.
        distinct_id: currentDistinctId(),
        $device_id: getAnonymousId(),
        $session_id: getSessionId(),
        $window_id: getWindowId(),
        $current_url: `${window.location.origin}${path}`,
        $pathname: path,
        $lib: "ozlind-native",
        $lib_version: "1.2.0",
        // Explicitly disable GeoIP enrichment; project-level IP anonymization
        // is configured separately.
        $geoip_disable: true,
        ...safeProperties(properties),
      },
    });

    // Same-origin Vercel rewrite avoids cross-origin CORS/CSP failures.
    // Delivery is bounded and never awaited by the interaction that emitted it.
    void deliverCapture(body);
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
    resetTabScopedIdentity();
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
  resetTabScopedIdentity();
  try {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.setItem(ANONYMOUS_ID_KEY, memoryAnonymousId);
  } catch {
    // In-memory anonymous identity remains usable.
  }
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === "undefined") return;
  memoryOptOut = optOut;
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // The in-memory preference still enforces opt-out for the current tab.
  }

  if (optOut) resetAnalyticsIdentity();
  else getAnonymousId();

  // Re-identify on opt-in without requiring a full page reload. The listener
  // ignores this event while opted out or when the browser requests DNT.
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  } catch {
    // Analytics consent changes must never interrupt settings.
  }
}
