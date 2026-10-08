import {
  hasVision,
  json,
  isTrustedSameOrigin,
  isUuid,
  latestUserMessage,
  safeError,
  shouldResearch,
  validateMessages,
} from "@/lib/server";
import { providerOrder } from "@/lib/providers";
import { checkUserRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { createChatStream } from "@/lib/ai/chat-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHAT_REQUEST_BYTES = 5_000_000;

export async function POST(request) {
  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
  let rateUserId = null;

  try {
    if (!isTrustedSameOrigin(request)) {
      return json(
        { error: "Invalid request origin." },
        403,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);

    if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_REQUEST_BYTES) {
      return json(
        { error: "Chat request is too large. Please reduce the attachment size and try again." },
        413,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return json(
        { error: "A JSON chat request is required." },
        415,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    const rate = await checkUserRateLimit();
    rateUserId = rate.userId || null;

    if (rate.unauthorized) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }

    if (rate.unavailable) {
      return json(
        { error: "The request protection service is temporarily unavailable. Please try again shortly." },
        503,
        {
          "Retry-After": "5",
          "X-RateLimit-Remaining": "0",
          "X-OZLIND-Request-ID": requestId,
        },
      );
    }

    if (!rate.allowed) {
      return json(
        { error: "Too many requests. Please wait a moment and try again." },
        429,
        {
          "Retry-After": String(rate.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
          "X-OZLIND-Request-ID": requestId,
        },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const validation = validateMessages(body.messages);

    if (!validation.ok) {
      return json(
        { error: validation.error || "Invalid chat messages." },
        400,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    const messages = validation.messages;
    const allowedModes = new Set(["auto", "fast", "pro", "vision"]);
    const mode =
      typeof body.mode === "string" && allowedModes.has(body.mode)
        ? body.mode
        : "auto";
    const vision = hasVision(messages);
    const query = latestUserMessage(messages);

    const conversationId = isUuid(body.conversationId)
      ? body.conversationId
      : null;

    if (conversationId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.user_id !== rate.userId) {
        return json(
          { error: "This conversation is not available." },
          403,
          { "X-OZLIND-Request-ID": requestId },
        );
      }
    }

    const research = shouldResearch(body, query);
    const providers = providerOrder(mode, vision, {
      messages,
      research,
    });

    if (!providers.length) {
      return json(
        {
          error: vision
            ? "Image analysis is temporarily unavailable."
            : "OZLIND is temporarily unavailable.",
        },
        503,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    const stream = await createChatStream({
      messages,
      body,
      mode,
      vision,
      providers,
      research,
      userId: rate.userId,
      conversationId,
      request,
      requestId,
      requestStartedAt,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-OZLIND-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    console.error("OZLIND chat request failed:", { requestId, error });

    return json(
      { error: safeError(error) },
      500,
      { "X-OZLIND-Request-ID": requestId },
    );
  }
}
