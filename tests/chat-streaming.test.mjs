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


test("frontend preserves buffered text and terminates assistant state when a stream fails", async () => {
  const chat = await readFile(
    new URL("../src/components/chat/Chat.tsx", import.meta.url),
    "utf8",
  );

  assert.match(chat, /let pendingText = "";[\s\S]*?try \{/);
  assert.match(chat, /const trailingText = pendingText;[\s\S]*?pendingText = "";/);
  assert.match(chat, /const content = message\.content \+ trailingText;/);
  assert.match(chat, /status: controller\.signal\.aborted \|\| content \? "interrupted" : "failed"/);
  assert.doesNotMatch(chat, /current\.filter\(\(message\) => message\.id !== assistantId \|\| Boolean\(message\.content\)\)/);
});


test("frontend model selection stays aligned with the backend API allowlist", async () => {
  const [chat, route] = await Promise.all([
    readFile(new URL("../src/components/chat/Chat.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);

  const modelIds = [
    "groq:llama-3.3-70b-versatile",
    "groq:deepseek-r1-distill-llama-70b",
    "google:gemini-2.0-flash",
  ];

  for (const modelId of modelIds) {
    assert.ok(chat.includes(modelId), `Frontend does not select supported model: ${modelId}`);
    assert.ok(route.includes(modelId), `Backend does not allow frontend model: ${modelId}`);
  }
});
