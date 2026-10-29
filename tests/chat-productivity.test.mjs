import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("chat offers useful task starters that populate the composer without auto-sending", async () => {
  const chat = await read("../src/components/chat/Chat.tsx");
  for (const label of ["Explain simply", "Write something", "Brainstorm ideas", "Debug code", "Research a topic", "Make a plan"]) {
    assert.ok(chat.includes(label), "missing starter prompt: " + label);
  }
  assert.match(chat, /setDraft\(starter\.prompt\)/);
  assert.match(chat, /textareaRef\.current\?\.focus\(\)/);
});

test("unfinished drafts are stored in tab-scoped session storage and never require a server", async () => {
  const chat = await read("../src/components/chat/Chat.tsx");
  assert.match(chat, /sessionStorage\.setItem\(key, draft\.slice\(0, 20000\)\)/);
  assert.match(chat, /sessionStorage\.getItem\(key\)/);
  assert.match(chat, /sessionStorage\.removeItem\(key\)/);
  assert.match(chat, /ozlind:draft:/);
});

test("keyboard shortcuts can send, stop generation, and stop read-aloud", async () => {
  const chat = await read("../src/components/chat/Chat.tsx");
  assert.match(chat, /event\.key === "Escape"/);
  assert.match(chat, /abortRef\.current\?\.abort\(\)/);
  assert.match(chat, /event\.key === "Enter"/);
  assert.match(chat, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(chat, /Ctrl\/⌘ \+ Enter to send · Esc to stop/);
});

test("starter prompts and shortcut hints have responsive styles", async () => {
  const css = await read("../src/styles/unified-design-system.css");
  assert.match(css, /\.starter-prompts\s*\{/);
  assert.match(css, /\.starter-prompt:hover/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.starter-prompts/);
  assert.match(css, /\.composer-shortcut-hint/);
});
