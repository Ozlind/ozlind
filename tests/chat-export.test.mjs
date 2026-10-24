import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationMarkdown, suggestArtifactTitle } from "../src/lib/chat/export.mjs";

test("exports a readable transcript with role boundaries and attached image names", () => {
  const transcript = buildConversationMarkdown([
    { role: "user", content: "Explain this chart", images: [{ name: "revenue.png", dataUrl: "data:image/jpeg;base64,SECRET" }] },
    { role: "assistant", content: "The chart trends upward." },
  ], "Quarterly review");

  assert.match(transcript, /^# Quarterly review/m);
  assert.match(transcript, /## You/);
  assert.match(transcript, /## Ozlind/);
  assert.match(transcript, /revenue\.png/);
  assert.match(transcript, /The chart trends upward\./);
  assert.doesNotMatch(transcript, /data:image|SECRET/);
});

test("keeps empty streaming placeholders out of exports", () => {
  const transcript = buildConversationMarkdown([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "" },
  ]);
  assert.match(transcript, /## You/);
  assert.doesNotMatch(transcript, /## Ozlind/);
});

test("creates a useful, bounded artifact title without line breaks", () => {
  const title = suggestArtifactTitle([
    { role: "user", content: "  # Build a secure API\nwith tests  " },
  ], "Answer");
  assert.equal(title, "Answer — Build a secure API with tests");
  assert.ok(title.length <= 160);
  assert.doesNotMatch(title, /[\r\n]/);
});

test("uses a clear fallback when the conversation has no text", () => {
  assert.equal(suggestArtifactTitle([], "Saved answer"), "Saved answer conversation");
});
