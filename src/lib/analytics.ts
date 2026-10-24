"use client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const INGEST_PATH = "/ingest/i/v0/e";
const OPT_OUT_KEY = "ozlind_analytics_opt_out";
const ANONYMOUS_ID_KEY = "ozlind_analytics_distinct_id";
const USER_ID_KEY = "ozlind_analytics_user_id";
const SESSION_ID_KEY = "ozlind_analytics_session";
const WINDOW_ID_KEY = "ozlind_analytics_window_id";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const RETRY_DELAYS_MS = [250, 1_000] as const;

type AnalyticsValue = string | number | boolean;
type AnalyticsEventName =
  | "$pageview"
  | "$identify"
  | "ozlind_client_error"
  | "ozlind_web_vital"
  | "ozlind_ai_request_completed"
  | "ozlind_product_interaction"
  | "ozlind_app_lifecycle"
  | "ozlind_page_engagement";

const ALLOWED_EVENTS = new Set<AnalyticsEventName>([
  "$pageview",
  "$identify",
  "ozlind_client_error",
  "ozlind_web_vital",
  "ozlind_ai_request_completed",
  "ozlind_product_interaction",
  "ozlind_app_lifecycle",
  "ozlind_page_engagement",
]);

// Keep this list deliberately small. Never add prompt text, completions, user-entered
// labels, filenames, conversation IDs, full URLs, query strings, or stack traces.
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
  "attachment_count",
  "action",
  "interaction",
  "result",
  "used_web_search",
]);

const SAFE_ENUM_VALUES: Record<string, ReadonlySet<string>> = {
  error_type: new Set([
    "Error",
    "TypeError",
    "ReferenceError",
    "RangeError",
    "SyntaxError",
    "EvalError",
    "URIError",
    "WindowError",
    "UnhandledRejection",
    "SecurityError",
    "NetworkError",
    "AbortError",
  ]),
  error_source: new Set(["window", "promise"]),
  metric_name: new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  metric_rating: new Set(["good", "needs-improvement", "poor", "unknown"]),
  navigation_type: new Set(["navigate", "reload", "back_forward", "prerender"]),
  model_mode: new Set(["auto", "fast", "vision", "pro"]),
  action: new Set([
    "send",
    "regenerate",
    "stop",
    "copy",
    "save_response",
    "attach_image",
    "remove_attachment",
    "select_mode",
    "toggle_web_search",
    "open_image_preview",
    "new_chat",
    "retry_history",
    "clear_preset",
    "new_chat",
    "save_response",
    "rename_conversation",
    "toggle_pin",
    "archive_conversation",
    "restore_conversation",
    "change_preference",
  ]),
  interaction: new Set([
    "theme",
    "accent",
    "density",
    "layout",
    "default_model",
    "language",
    "enter_to_send",
    "auto_scroll",
    "show_reasoning",
    "research_enabled",
  ]),
  result: new Set([
    "success",
    "failed",
    "aborted",
    "duplicate",
    "enabled",
    "disabled",
    "online",
    "offline",
    "complete",
    "interrupted",
  ]),
};

let memorySessionId = "";
let memoryWindowId = "";
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
  // Only emit known application routes. Conversation IDs, arbitrary dynamic
  // segments, slugs and future unknown paths collapse to a non-identifying route.
  const normalized = pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  const knownRoutes = new Set([
    "/",
    "/login",
    "/app",
    "/app/settings",
    "/app/documents",
    "/app/workspace",
  ]);
  if (knownRoutes.has(normalized)) return normalized;
  if (/^\/app\/[^/]+$/.test(normalized)) return "/app/[conversation]";
  return "/other";
}

function safeProperties(properties: Record<string, AnalyticsValue>): Record<string, AnalyticsValue> {
  const sanitized: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;

    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) continue;
      if (key === "status_code" && (!Number.isInteger(value) || value > 599)) continue;
      if (key === "duration_ms" && (!Number.isInteger(value) || value > 3_600_000)) continue;
      if (key === "attachment_count" && (!Number.isInteger(value) || value > 2)) continue;
      if (key === "metric_value" && value > 600_000) continue;
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      if (key === "has_attachments" || key === "used_web_search") sanitized[key] = value;
      continue;
    }

    const clean = value.replace(/[\r\n\t]/g, " ").trim().slice(0, 120);
    if (!clean) continue;

    if (key === "$anon_distinct_id") {
      if (/^[a-z0-9_-]{8,128}$/i.test(clean)) sanitized[key] = clean;
      continue;
    }

    const allowedValues = SAFE_ENUM_VALUES[key];
    if (allowedValues) {
      if (allowedValues.has(clean)) sanitized[key] = clean;
      else if (key === "error_type") sanitized[key] = "Error";
      continue;
    }
  }
  return sanitized;
}

function getSessionId(): string {
  const now = Date.now();
  try {
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed === "object" &&
        "id" in parsed &&
        typeof parsed.id === "string" &&
        "lastActivityAt" in parsed &&
        typeof parsed.lastActivityAt === "number" &&
        now - parsed.lastActivityAt >= 0 &&
        now - parsed.lastActivityAt < SESSION_IDLE_MS
      ) {
        sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: parsed.id, lastActivityAt: now }));
        memorySessionId = parsed.id;
        return parsed.id;
      }
    }

    memorySessionId = makeDistinctId();
    sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: memorySessionId, lastActivityAt: now }));
    return memorySessionId;
  } catch {
    if (!memorySessionId) memorySessionId = makeDistinctId();
    return memorySessionId;
  }
}

function getWindowId(): string {
  try {
    let id = sessionStorage.getItem(WINDOW_ID_KEY);
    if (!id) {
      id = makeDistinctId();
      sessionStorage.setItem(WINDOW_ID_KEY, id);
    }
    memoryWindowId = id;
    return id;
  } catch {
    if (!memoryWindowId) memoryWindowId = makeDistinctId();
    return memoryWindowId;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function sendCapture(body: string, attempt = 0): Promise<void> {
  if (isOptedOut()) return;

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

    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (retryable && attempt < RETRY_DELAYS_MS.length && !isOptedOut()) {
      await delay(RETRY_DELAYS_MS[attempt]);
      return sendCapture(body, attempt + 1);
    }

    console.warn("[Ozlind analytics] Ingestion request failed with HTTP", response.status);
  } catch {
    const canRetry = typeof navigator === "undefined" || navigator.onLine !== false;
    if (canRetry && attempt < RETRY_DELAYS_MS.length && !isOptedOut()) {
      await delay(RETRY_DELAYS_MS[attempt]);
      return sendCapture(body, attempt + 1);
    }
    // Do not throw: analytics failures must never affect chat or navigation.
    console.warn("[Ozlind analytics] Ingestion request failed after retrying.");
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
      properties: {
        ...safeProperties(properties),
        // PostHog Capture API requires distinct_id inside properties.
        distinct_id: currentDistinctId(),
        $insert_id: makeDistinctId(),
        $session_id: getSessionId(),
        $window_id: getWindowId(),
        $current_url: `${window.location.origin}${path}`,
        $pathname: path,
        $lib: "ozlind-native",
        $lib_version: "1.2.0",
        // Exclude GeoIP enrichment. Project-level IP anonymization remains a
        // separate PostHog project setting.
        $geoip_disable: true,
      },
    });

    // Retry only transient failures, with a small bounded backoff. Never block
    // a chat interaction while analytics is being delivered.
    void sendCapture(body);
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
