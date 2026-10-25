import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CHAT_UI_FLUSH_INTERVAL_MS, shouldFlushVisibleText } from "../src/lib/chat/streaming.mjs";
import { appendOrReplaceLatestAssistant } from "../src/lib/chat/message-state.mjs";

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
    /AbortSignal\.any\(\[request\.signal, streamAbortController\.signal, AbortSignal\.timeout\(input\.images\.length \? 18000 : 12000\)\]\)/,
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

test("stream response reports the actual provider model separately from the UI model key", async () => {
  const route = await readFile(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /"X-OZLIND-Model": selectedKey/);
  assert.match(route, /"X-OZLIND-Provider-Model": selectedProviderModel \?\? selectedKey/);
  assert.match(route, /selectedProviderModel = candidate\.modelId/);
});

test("new assistant responses append after existing chat messages", () => {
  const messages = [
    { id: "user-1", role: "user", content: "First" },
    { id: "assistant-1", role: "assistant", content: "Answer one" },
    { id: "user-2", role: "user", content: "Second" },
  ];
  const next = { id: "assistant-2", role: "assistant", content: "", status: "streaming" };

  assert.deepEqual(
    appendOrReplaceLatestAssistant(messages, next, false),
    [...messages, next],
  );
});

test("regeneration replaces the latest assistant answer in-place without duplicating it", () => {
  const messages = [
    { id: "user-1", role: "user", content: "First" },
    { id: "assistant-1", role: "assistant", content: "Answer one" },
    { id: "user-2", role: "user", content: "Second" },
    { id: "assistant-2", role: "assistant", content: "Partial answer", status: "interrupted" },
  ];
  const next = { id: "assistant-3", role: "assistant", content: "", status: "streaming" };
  const result = appendOrReplaceLatestAssistant(messages, next, true);

  assert.equal(result.length, messages.length);
  assert.deepEqual(result, [messages[0], messages[1], messages[2], next]);
});

test("regeneration never replaces an answer that predates the latest user turn", () => {
  const messages = [
    { id: "user-1", role: "user", content: "First" },
    { id: "assistant-1", role: "assistant", content: "Answer one" },
    { id: "user-2", role: "user", content: "Second" },
  ];
  const next = { id: "assistant-2", role: "assistant", content: "", status: "streaming" };

  assert.deepEqual(
    appendOrReplaceLatestAssistant(messages, next, true),
    [...messages, next],
  );
});

test("chat component uses in-place assistant replacement for regeneration", async () => {
  const chat = await readFile(
    new URL("../src/components/chat/Chat.tsx", import.meta.url),
    "utf8",
  );
  assert.match(chat, /appendOrReplaceLatestAssistant/);
  assert.match(chat, /action === "regenerate"/);
});


test("mode chooser uses a static icon and reflects the selected mode", async () => {
  const chat = await readFile(
    new URL("../src/components/chat/Chat.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(chat.includes('name="i-ai-chat"'));
  assert.ok(!chat.includes('name="sym-processing"'));
  assert.match(chat, /mode === "auto" ? "Auto" : mode === "fast" ? "Fast" : mode === "vision" ? "Vision" : "Pro"/);
});

test("web-search loading copy is based on the response's confirmed research status", async () => {
  const chat = await readFile(
    new URL("../src/components/chat/Chat.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(chat.includes('message.research ? "Searching the web…" : "Thinking…"'));
  assert.ok(!chat.includes('message.research ? "Searching the web…" : researchEnabled ? "Searching the web…"'));
});

test("chat transcript does not expose provider implementation model labels", async () => {
  const chat = await readFile(
    new URL("../src/components/chat/Chat.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!chat.includes("function modelLabel("));
  assert.ok(!chat.includes('"Fast model"'));
  assert.ok(!chat.includes('"Pro model"'));
  assert.ok(!chat.includes('"Vision model"'));
});

test("unified design system owns the final mobile composer geometry", async () => {
  const css = await readFile(
    new URL("../src/styles/unified-design-system.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /Final mobile chat pass/);
  assert.match(css, /\.composer-modebar \{[\s\S]*?align-items: center/);
  assert.match(css, /grid-template-columns: 36px 36px minmax\(0, 1fr\) 40px/);
  assert.match(css, /\.composer \.send-button \{[\s\S]*?border-radius: 50%/);
});


test("mobile chat utility buttons keep accessible names when text labels are hidden", async () => {
  const utilities = await readFile(
    new URL("../src/components/chat/ChatUtilities.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../src/styles/unified-design-system.css", import.meta.url),
    "utf8",
  );
  assert.ok(utilities.includes('aria-label="Export conversation as Markdown"'));
  assert.ok(utilities.includes('aria-label="Save conversation to Workspace"'));
  assert.match(css, /max-width: 480px[\s\S]*?\.chat-header-tool span\s*\{\s*display: none/);
});
