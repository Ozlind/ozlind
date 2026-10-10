import test from "node:test";
import assert from "node:assert/strict";
import { getSafeRedirect } from "../src/lib/safe-redirect.mjs";

const origin = "https://ozlind.example";

test("allows a same-origin app path including query and fragment", () => {
  const result = getSafeRedirect("/app/chat?mode=research#latest", origin);
  assert.equal(result.origin, origin);
  assert.equal(result.pathname, "/app/chat");
  assert.equal(result.search, "?mode=research");
  assert.equal(result.hash, "#latest");
});

test("falls back for missing or relative destinations", () => {
  for (const input of [null, "", "app/chat", "https://evil.example/path"]) {
    assert.equal(getSafeRedirect(input, origin).href, new URL("/app", origin).href);
  }
});

test("blocks protocol-relative redirects and backslash variants", () => {
  for (const input of ["//evil.example/path", "/\\\\evil.example/path", "/\\evil.example/path"]) {
    assert.equal(getSafeRedirect(input, origin).href, new URL("/app", origin).href);
  }
});

test("blocks control characters", () => {
  assert.equal(getSafeRedirect("/app\n//evil.example", origin).href, new URL("/app", origin).href);
});
