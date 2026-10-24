import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("readiness exposes only non-secret capability booleans for the settings UI", async () => {
  const route = await readText("../src/app/api/ready/route.ts");
  const settings = await readText("../src/app/app/settings/page.tsx");
  assert.match(route, /researchConfigured = Boolean\(process\.env\.TAVILY_API_KEY\)/);
  assert.match(route, /researchConfigured,/);
  assert.match(route, /aiGatewayConfigured = Boolean\(process\.env\.AI_GATEWAY_API_KEY\)/);
  assert.match(route, /gatewayVisionModelConfigured,/);
  assert.match(route, /const gatewayReady = checks\.aiGatewayConfigured/);
  assert.match(route, /checks\.groq \|\| checks\.google \|\| gatewayReady/);
  assert.match(route, /AI_GATEWAY_VISION_MODEL/);
  assert.match(settings, /fetch\("\/api\/ready", \{ cache: "no-store"/);
  assert.match(settings, /live generation not tested here/);
  assert.match(settings, /live search not tested here/);
  assert.doesNotMatch(settings, /GROQ_API_KEY|GEMINI_API_KEY|TAVILY_API_KEY|SUPABASE_SECRET_KEY/);
  assert.match(settings, /NEXT_PUBLIC_OZLIND_ANALYTICS_ENABLED !== "true"/);
  assert.match(settings, /temporarily paused globally/);
});

test("chat route supports optional AI Gateway fallback models without replacing native providers", async () => {
  const chat = await readText("../src/app/api/chat/route.ts");
  assert.match(chat, /createGateway, streamText/);
  assert.match(chat, /function configuredGatewayModels\(\)/);
  assert.match(chat, /AI_GATEWAY_FAST_MODEL/);
  assert.match(chat, /AI_GATEWAY_PRO_MODEL/);
  assert.match(chat, /AI_GATEWAY_AUTO_MODEL/);
  assert.match(chat, /AI_GATEWAY_VISION_MODEL/);
  assert.match(chat, /\.\.\.fallbackOrder\(input\.model\)\.flatMap/);
});
