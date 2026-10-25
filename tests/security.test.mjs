import assert from "node:assert/strict";
import test from "node:test";
import { PayloadTooLargeError, readJsonBody } from "../src/lib/security/request.mjs";

function requestFromChunks(chunks, headers = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });

  return new Request("https://ozlind.test/api", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  });
}

test("reads valid JSON across streamed chunks", async () => {
  const request = requestFromChunks(['{"model":', '"fast","ok":true}']);
  assert.deepEqual(await readJsonBody(request, 64), { model: "fast", ok: true });
});

test("rejects declared oversized payloads before reading", async () => {
  const request = new Request("https://ozlind.test/api", {
    method: "POST",
    headers: { "content-length": "1000" },
    body: "{}",
  });

  await assert.rejects(readJsonBody(request, 10), PayloadTooLargeError);
});

test("rejects streamed oversized payloads without relying on Content-Length", async () => {
  const request = requestFromChunks(["123456", "789012"]);
  await assert.rejects(readJsonBody(request, 10), PayloadTooLargeError);
});

test("rejects malformed JSON", async () => {
  const request = requestFromChunks(['{"broken":']);
  await assert.rejects(readJsonBody(request, 64), SyntaxError);
});

test("rejects invalid UTF-8", async () => {
  const request = requestFromChunks([new Uint8Array([0xff, 0xfe])]);
  await assert.rejects(readJsonBody(request, 64), TypeError);
});

test("stateful API routes enforce byte caps before parsing JSON", async () => {
  const { readFile } = await import("node:fs/promises");
  const routes = [
    ["../src/app/api/artifacts/route.ts", /readJsonBody\(request, MAX_BODY_BYTES\)/, /const MAX_BODY_BYTES = 512 \* 1024/],
    ["../src/app/api/presets/route.ts", /readJsonBody\(request, MAX_BODY_BYTES\)/, /const MAX_BODY_BYTES = 64 \* 1024/],
    ["../src/app/api/preferences/route.ts", /readJsonBody\(request, MAX_BODY_BYTES\)/, /const MAX_BODY_BYTES = 8 \* 1024/],
  ];

  for (const [path, readerPattern, limitPattern] of routes) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, readerPattern, path);
    assert.match(source, limitPattern, path);
    assert.match(source, /PayloadTooLargeError/, path);
  }
});

test("readiness checks actual Supabase Auth reachability with a bounded timeout", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/app/api/ready/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /checkSupabaseReachability/);
  assert.match(source, /\/auth\/v1\/health/);
  assert.match(source, /AbortSignal\.timeout\(SUPABASE_HEALTH_TIMEOUT_MS\)/);
  assert.match(source, /supabaseConfigured/);
  assert.match(source, /supabaseReachable/);
  assert.match(source, /Cache-Control/);
  // Text models have backend defaults, so readiness must not require explicit model IDs.
  assert.match(source, /const groqConfigured = Boolean\(process\.env\.GROQ_API_KEY\)/);
  assert.doesNotMatch(source, /GROQ_API_KEY\s*&&\s*\(process\.env\.GROQ_FAST_MODEL/);
  // Report multimodal readiness separately from general text readiness.
  assert.match(source, /const visionConfigured = Boolean/);
  assert.match(source, /vision: visionConfigured/);
});

test("admin RPC hardening migration moves the helper and dependent policies together", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../supabase/migrations/20261021_unexpose_is_admin_rpc.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /create schema if not exists private/i);
  assert.match(source, /create or replace function private\.is_admin\(\)/i);
  assert.match(source, /grant execute on function private\.is_admin\(\) to authenticated/i);
  const triggerFunction = source.match(/create or replace function public\.protect_profile_columns\(\)[\s\S]*?\$function\$;/i)?.[0];
  assert.ok(triggerFunction, "profile trigger function must be redefined before removing the old helper");
  assert.match(triggerFunction, /not private\.is_admin\(\)/i);
  assert.doesNotMatch(triggerFunction, /public\.is_admin\(\)/i);
  assert.match(
    source,
    /revoke truncate, references, trigger, maintain\s+on all tables in schema public/i,
  );
  assert.match(source, /drop function if exists public\.is_admin\(\)/i);
  assert.equal((source.match(/private\.is_admin\(\)/g) || []).length >= 10, true);
  assert.match(source, /migration ledger/i);
});

test("all public tables revoke non-row-level client privileges and future app tables inherit the hardening", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../supabase/migrations/20261021_unexpose_is_admin_rpc.sql", import.meta.url),
    "utf8",
  );
  const schema = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /revoke truncate, references, trigger, maintain\s+on all tables in schema public\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke truncate, references, trigger, maintain on tables\s+from public, anon, authenticated/i,
  );
  assert.match(schema, /grant execute on function public\.check_rate_limit\(uuid, integer, integer\) to service_role/i);
});

test("stateful workspace mutations use the shared fail-closed rate limiter", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const path of [
    "../src/app/api/artifacts/route.ts",
    "../src/app/api/presets/route.ts",
    "../src/app/api/preferences/route.ts",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /checkUserRateLimit/);
    assert.match(source, /rateLimitErrorResponse/);
    assert.match(source, /rateLimitResponse\) return rateLimitResponse/);
  }
});


test("bootstrap schema keeps production index and non-row-level privilege hardening", async () => {
  const { readFile } = await import("node:fs/promises");
  const schema = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    schema,
    /create index if not exists artifacts_conversation_id_idx\s+on public\.artifacts\s*\(conversation_id\)/i,
  );
  assert.match(
    schema,
    /revoke truncate, references, trigger, maintain\s+on all tables in schema public\s+from public, anon, authenticated/i,
  );
  assert.match(
    schema,
    /alter default privileges for role postgres in schema public\s+revoke truncate, references, trigger, maintain on tables\s+from public, anon, authenticated/i,
  );
});


test("chat context loads the latest messages in chronological order within a character budget", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/app/api/chat/route.ts", import.meta.url),
    "utf8",
  );
  const historyQuery = source.slice(
    source.indexOf('const { data: history, error: historyError }'),
    source.indexOf('const lastUserIndex = historyRows'),
  );

  assert.match(historyQuery, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(historyQuery, /\.limit\(100\)/);
  assert.match(historyQuery, /const chronologicalHistory = \(history \?\? \[\]\)\.reverse\(\)/);
  assert.match(historyQuery, /const MAX_HISTORY_CHARS = 60_000/);
  assert.match(historyQuery, /historyChars \+ nextLength > MAX_HISTORY_CHARS/);
  assert.match(historyQuery, /chronologicalHistory\.slice\(firstIncluded\)/);
  assert.doesNotMatch(historyQuery, /ascending: true/);
});


test("authenticated API routes reuse verified identity for rate limiting", async () => {
  const { readFile } = await import("node:fs/promises");
  const limiter = await readFile(new URL("../src/lib/rate-limit.ts", import.meta.url), "utf8");
  assert.ok(limiter.includes("checkUserRateLimit(verifiedUserId?: string)"));
  assert.ok(limiter.includes("supabase.auth.getUser()"));
  for (const path of [
    "../src/app/api/chat/route.ts", "../src/app/api/research/route.ts",
    "../src/app/api/artifacts/route.ts", "../src/app/api/documents/route.ts",
    "../src/app/api/preferences/route.ts", "../src/app/api/presets/route.ts",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.ok(source.includes("checkUserRateLimit(user.id)"), path);
    assert.ok(!source.includes("checkUserRateLimit()"), path);
  }
});

test("chat context excludes incomplete assistant responses", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  const historyQuery = source.slice(source.indexOf('const { data: history, error: historyError }'), source.indexOf("const lastUserIndex = historyRows"));
  assert.ok(historyQuery.includes('.eq("status", "complete")'));
});


test("chat interruption logs omit user and conversation identifiers", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile(
    new URL("../src/app/api/chat/route.ts", import.meta.url),
    "utf8",
  );

  for (const event of [
    'event: "chat.stream_failed"',
    'event: "chat.stream_cancel_persist_failed"',
  ]) {
    const start = route.indexOf(event);
    assert.notEqual(start, -1, "missing log event: " + event);
    const end = route.indexOf("}));", start);
    assert.notEqual(end, -1, "unterminated log object: " + event);
    const fields = route.slice(start, end);

    assert.ok(fields.includes("requestId"), event);
    assert.ok(!fields.includes("userId"), event);
    assert.ok(!fields.includes("conversationId"), event);
  }
});


test("untrusted preset and research context stay out of the privileged system prompt", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(source, /system: SYSTEM_PROMPT,/);
  assert.doesNotMatch(source, /system: SYSTEM_PROMPT \+ presetContext \+ research\.context/);
  assert.match(source, /OZLIND_REFERENCE_CONTEXT/);
  assert.match(source, /JSON\.stringify\(\{ userPreset: presetContext \|\| null, webResearch: research\.context \|\| null \}\)/);
  assert.match(source, /contextualMessages\.splice\(Math\.max\(0, lastUserIndex\), 0/);
  assert.match(source, /a product of Ozlind Enterprises/);
});


test("document quota is enforced atomically by the database", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../supabase/migrations/20261025_document_quota_guard.sql", import.meta.url),
    "utf8",
  );
  const route = await readFile(new URL("../src/app/api/documents/route.ts", import.meta.url), "utf8");
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(new\.user_id::text, 0\)\)/i);
  assert.match(migration, /select count\(\*\)::integer[\s\S]*from public\.documents[\s\S]*where user_id = new\.user_id/i);
  assert.match(migration, /existing_count >= 20/i);
  assert.match(migration, /message = 'DOCUMENT_LIMIT_REACHED'/i);
  assert.match(migration, /before insert on public\.documents/i);
  assert.match(route, /error\.message === "DOCUMENT_LIMIT_REACHED"[\s\S]*?errorResponse\("DOCUMENT_LIMIT_REACHED", requestId, 409\)/);
});


test("OAuth callback redirects are restricted to the same origin", async () => {
  const { readFile } = await import("node:fs/promises");
  const callback = await readFile(
    new URL("../src/app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(callback, /const destination = new URL\(next, origin\)/);
  assert.match(callback, /if \(destination\.origin !== origin\) return "\/app"/);
  assert.match(callback, /return `\$\{destination\.pathname\}\$\{destination\.search\}\$\{destination\.hash\}`/);
  assert.match(callback, /NextResponse\.redirect\(\s*new URL\(getSafeNextPath\(next, url\.origin\), url\.origin\)/);
});
