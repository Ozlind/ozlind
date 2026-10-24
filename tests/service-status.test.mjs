import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("readiness exposes only non-secret capability booleans for the settings UI", async () => {
  const route = await readText("../src/app/api/ready/route.ts");
  const settings = await readText("../src/app/app/settings/page.tsx");
  assert.match(route, /researchConfigured = Boolean\(process\.env\.TAVILY_API_KEY\)/);
  assert.match(route, /researchConfigured,/);
  assert.match(settings, /fetch\("\/api\/ready", \{ cache: "no-store"/);
  assert.match(settings, /live generation not tested here/);
  assert.match(settings, /live search not tested here/);
  assert.doesNotMatch(settings, /GROQ_API_KEY|GEMINI_API_KEY|TAVILY_API_KEY|SUPABASE_SECRET_KEY/);
});
