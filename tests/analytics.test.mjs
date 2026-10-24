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
  assert.match(analytics, /properties:\s*\{\s*\.\.\.safeProperties\(properties\),\s*\/\/ PostHog Capture API requires distinct_id inside properties\.\s*distinct_id: currentDistinctId\(\)/);
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


test("analytics groups sessions and limits routes to known, non-identifying paths", async () => {
  const analytics = await readText("../src/lib/analytics.ts");

  assert.match(analytics, /SESSION_IDLE_MS = 30 \* 60 \* 1000/);
  assert.match(analytics, /\$session_id: getSessionId\(\)/);
  assert.match(analytics, /\$window_id: getWindowId\(\)/);
  assert.match(analytics, /\$insert_id: makeDistinctId\(\)/);
  assert.match(analytics, /return "\/app\/\[conversation\]"/);
  assert.match(analytics, /return "\/other"/);
  assert.doesNotMatch(analytics, /\$title/);
});

test("analytics validates event property values and retries only transient failures", async () => {
  const analytics = await readText("../src/lib/analytics.ts");

  assert.match(analytics, /SAFE_ENUM_VALUES/);
  assert.match(analytics, /if \(!ALLOWED_PROPERTIES\.has\(key\)\) continue;/);
  assert.match(analytics, /response\.status === 408 \|\| response\.status === 429 \|\| response\.status >= 500/);
  assert.match(analytics, /RETRY_DELAYS_MS = \[250, 1_000\]/);
  assert.match(analytics, /if \(isOptedOut\(\)\) return;/);
  assert.doesNotMatch(analytics, /autocapture|session_recording|sessionReplay/);
});

test("page engagement and lifecycle telemetry contain only durations and safe states", async () => {
  const component = await readText("../src/components/analytics/PostHogAnalytics.tsx");
  const settings = await readText("../src/app/app/settings/page.tsx");

  assert.match(component, /ozlind_page_engagement/);
  assert.match(component, /ozlind_app_lifecycle/);
  assert.match(component, /trackAnalyticsEvent\("\$pageview"\)/);
  assert.doesNotMatch(component, /\$title:\s*document\.title/);
  assert.match(settings, /setAnalyticsOptOut\(!enabled\)/);
  assert.match(settings, /Prompts, replies, uploaded files or images/);
});

test("product interaction telemetry excludes the content being copied, saved, or renamed", async () => {
  const chat = await readText("../src/components/chat/Chat.tsx");
  const save = await readText("../src/components/chat/SaveResponseButton.tsx");
  const sidebar = await readText("../src/components/layout/Sidebar.tsx");
  const settings = await readText("../src/app/app/settings/page.tsx");

  for (const action of ["attach_image", "remove_attachment", "select_mode", "toggle_web_search", "open_image_preview", "copy"]) {
    assert.ok(chat.includes('action: "' + action + '"'), "chat interaction " + action + " should be instrumented");
  }
  assert.match(save, /action: "save_response", result: "success"/);
  assert.match(sidebar, /action: "rename_conversation", result: "success"/);
  assert.match(sidebar, /action: "archive_conversation"/);
  assert.match(settings, /recordPreferenceChange\("default_model"\)/);
  assert.doesNotMatch(chat, /trackAnalyticsEvent\([^;]*(?:message\.content|outgoingContent|dataUrl|image\.name)/s);
});
