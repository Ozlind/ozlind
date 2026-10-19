export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the allowed size.");
    this.name = "PayloadTooLargeError";
    this.code = "PAYLOAD_TOO_LARGE";
  }
}

/**
 * Read a JSON request with a hard byte cap. Content-Length may be absent,
 * so bytes are checked while streaming as well as against the declared size.
 */
export async function readJsonBody(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const declaredBytes = Number(declaredLength);
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > maxBytes) {
      throw new PayloadTooLargeError();
    }
  }

  if (!request.body) throw new SyntaxError("Expected a JSON request body.");

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(json);
}
