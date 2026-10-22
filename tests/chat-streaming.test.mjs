import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CHAT_UI_FLUSH_INTERVAL_MS, shouldFlushVisibleText } from "../src/lib/chat/streaming.mjs";

test("keeps the chat stream UI flush window at 32ms", () => {
  assert.equal(CHAT_UI_FLUSH_INTERVAL_MS, 32);
});

test("holds tiny provider chunks until the flush window elapses", () => {
  assert.equal(shouldFlushVisibleText("Hel", 1020, 1000), false);
  assert.equal(shouldFlushVisibleText("Hello", 1032, 1000), true);
});

test("forces the final buffered text to flush even before the interval", () => {
  assert.equal(shouldFlushVisibleText("tail", 1001, 1000, true), true);
});

test("never emits a state update for an empty buffer", () => {
  assert.equal(shouldFlushVisibleText("", 2000, 0, true), false);
});


test("persists canceled chat streams and aborts provider generation", async () => {
  const route = await readFile(
    new URL("../src/app/api/chat/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /const streamAbortController = new AbortController\(\)/);
  assert.match(
    route,
    /AbortSignal\.any\(\[request\.signal, streamAbortController\.signal, AbortSignal\.timeout\(50000\)\]\)/,
  );
  assert.match(route, /async cancel\(\)[\s\S]*?streamAbortController\.abort/);
  assert.match(route, /status: buffer \? "interrupted" : "failed"/);
});


test("frontend preserves buffered text when a stream fails or is stopped", async () => {
  const chat = await readFile(new URL("../src/components/chat/Chat.tsx", import.meta.url), "utf8");
  assert.ok(chat.includes('let pendingText = "";'));
  assert.ok(chat.includes("const trailingText = pendingText;"));
  assert.ok(chat.includes("const content = message.content + trailingText;"));
  assert.ok(chat.includes('status: controller.signal.aborted || content ? "interrupted" : "failed"'));
  assert.ok(!chat.includes("current.filter((message) => message.id !== assistantId || Boolean(message.content))"));
});

test("stream response headers disable intermediary caching", async () => {
  const route = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes('"Cache-Control": "no-store, no-cache, no-transform"'));
  assert.ok(route.includes('"X-Content-Type-Options": "nosniff"'));
});


test("successful web-researched answers append real checked URLs, not generated source claims", async () => {
  const route = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("normalized.results.map(({ title, url }) => ({ title, url }))"));
  assert.ok(route.includes("Sources consulted"));
  assert.ok(route.includes("controller.enqueue(encoder.encode(footer))"));
});
