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
