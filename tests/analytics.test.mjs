import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readText = async (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("PostHog events use the same-origin capture route and a property allowlist", async () => {
  const analytics = await readText("../src/lib/analytics.ts");
  const config = await readText("../next.config.ts");

  assert.match(analytics, /const INGEST_PATH = "\/ingest\/i\/v0\/e"/);
  assert.match(analytics, /if \(!ALLOWED_PROPERTIES\.has\(key\)\) continue;/);
  assert.match(analytics, /fetch\(INGEST_PATH/);
  assert.match(analytics, /properties:\s*\{\s*\/\/ PostHog Capture API requires distinct_id inside properties\.\s*distinct_id: currentDistinctId\(\)/);
  assert.doesNotMatch(analytics, /event,\s*distinct_id: currentDistinctId\(\),\s*properties:/);
  assert.match(config, /source: "\/ingest\/i\/v0\/e"/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_POSTHOG_HOST/);
  assert.doesNotMatch(analytics, /https:\/\/us\.i\.posthog\.com/);
});

test("AI request analytics contains outcomes, never prompt or completion text", async () => {
  const chat = await readText("../src/components/chat/Chat.tsx");
  const start = chat.indexOf('trackAnalyticsEvent("ozlind_ai_request_completed"');
  assert.notEqual(start, -1, "chat request analytics should be wired");
  const end = chat.indexOf("});", start);
  assert.notEqual(end, -1, "chat request analytics should be a complete call");
  const eventCall = chat.slice(start, end);

  assert.match(eventCall, /duration_ms/);
  assert.match(eventCall, /status_code/);
  assert.match(eventCall, /model_mode/);
  assert.doesNotMatch(eventCall, /outgoingContent|message\.content|response\.text|error\.message|conversationId|idempotencyKey/);
});

test("analytics payloads are session-aware, retry-safe, and avoid page-title leakage", async () => {
  const analytics = await readText("../src/lib/analytics.ts");
  const identity = await readText("../src/components/analytics/PostHogIdentity.tsx");
  const component = await readText("../src/components/analytics/PostHogAnalytics.tsx");

  assert.match(analytics, /uuid: makeDistinctId\(\)/);
  assert.match(analytics, /\$session_id: getSessionId\(\)/);
  assert.match(analytics, /\$window_id: getWindowId\(\)/);
  assert.match(analytics, /\$device_id: getAnonymousId\(\)/);
  assert.match(analytics, /attempt < 2/);
  assert.match(analytics, /response\.status >= 500/);
  assert.doesNotMatch(analytics, /\$title/);
  assert.match(analytics, /memoryOptOut = optOut/);
  assert.match(identity, /ozlind:analytics-consent-changed/);
  assert.match(component, /Do not send document\.title/);
  assert.match(component, /maxCumulativeLayoutShift/);
  assert.match(component, /interactionDurations/);
  assert.match(component, /Math\.floor\(durations\.length \/ 50\)/);
});

test("analytics restricts string values and bounds browser-error deduplication memory", async () => {
  const analytics = await readText("../src/lib/analytics.ts");
  const component = await readText("../src/components/analytics/PostHogAnalytics.tsx");

  assert.match(analytics, /ALLOWED_STRING_VALUES/);
  assert.match(analytics, /key === "error_type"/);
  assert.match(analytics, /key === "status_code"/);
  assert.match(analytics, /key === "duration_ms"/);
  assert.match(component, /recentErrors\.size > 100/);
  assert.match(component, /now - timestamp > 60_000/);
});

test("authenticated identification uses a stable user ID and excludes profile PII", async () => {
  const identity = await readText("../src/components/analytics/PostHogIdentity.tsx");
  const analytics = await readText("../src/lib/analytics.ts");

  assert.match(identity, /identifyAnalyticsUser\(userId\)/);
  assert.match(analytics, /localStorage\.setItem\(USER_ID_KEY, userId\)/);
  assert.doesNotMatch(identity, /email|displayName|user_metadata/);
});

test("browser errors are rate-limited and performance telemetry names core web vitals", async () => {
  const component = await readText("../src/components/analytics/PostHogAnalytics.tsx");

  assert.match(component, /recentErrors/);
  assert.match(component, /30_000/);
  for (const metric of ["LCP", "INP", "CLS", "FCP", "TTFB"]) {
    assert.ok(component.includes(`"${metric}"`), `${metric} should be measured`);
  }
  assert.match(component, /Never serialize a rejection reason/);
});
