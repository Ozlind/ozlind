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
  assert.match(source, /drop function if exists public\.is_admin\(\)/i);
  assert.equal((source.match(/private\.is_admin\(\)/g) || []).length >= 10, true);
  assert.match(source, /migration ledger/i);
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
