import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("voice input is allowed only for the same origin while camera and geolocation stay blocked", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /microphone=\(self\)/);
  assert.match(config, /camera=\(\)/);
  assert.match(config, /geolocation=\(\)/);
  assert.doesNotMatch(config, /microphone=\(\)/);
});
