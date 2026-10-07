import { NextResponse } from "next/server";

export function requestId() {
  return crypto.randomUUID();
}

export function json(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...headers,
    },
  });
}

export function errorResponse({
  requestId: id,
  status = 500,
  code,
  message,
  retryAfter,
}) {
  const headers = {};
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(Math.max(0, Math.ceil(retryAfter)));
  }

  return json(
    {
      error: {
        code,
        message,
        requestId: id,
      },
    },
    status,
    {
      ...headers,
      "X-OZLIND-Request-ID": id,
    },
  );
}

export function withRequestId(response, id) {
  response.headers.set("X-OZLIND-Request-ID", id);
  return response;
}
