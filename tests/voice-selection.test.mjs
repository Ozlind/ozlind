import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("speech synthesis voice matching uses real word boundaries", async () => {
  const chat = await readFile(new URL("../src/components/chat/Chat.tsx", import.meta.url), "utf8");
  const correctMatcher = String.raw`/\bmale\b|\bman\b|masculine/i`;
  const overescapedMatcher = String.raw`/\\bmale\\b|\\bman\\b|masculine/i`;

  assert.ok(chat.includes(correctMatcher), "male voice selectors should use real word-boundary assertions");
  assert.equal(chat.includes(overescapedMatcher), false, "selectors must not match a literal backslash followed by b");
});
