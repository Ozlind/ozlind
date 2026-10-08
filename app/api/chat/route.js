import { hasVision, json, latestUserMessage, safeError, shouldResearch, systemPrompt, validateMessages, isTrustedSameOrigin, isUuid } from "@/lib/server";
import { providerOrder } from "@/lib/providers";
import { generateChatResponse } from "@/lib/ai/gateway";
import { checkUserRateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { writeUsageLog } from "@/lib/backend/usage";
import { buildSearchQuery, performResearch } from "@/lib/ai/research";
import { buildDocumentContext, performDocumentRetrieval } from "@/lib/rag/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_CHAT_REQUEST_BYTES = 5_000_000;
function sse(event, data) { return "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n"; }

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(
  request,
) {
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

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json(
        { error: "A JSON chat request is required." },
        415,
        { "X-OZLIND-Request-ID": requestId },
      );
    }

    const rate =
      await checkUserRateLimit();
    rateUserId = rate.userId || null;

    if (rate.unauthorized) {
      return json(
        {
          error:
            "Your session has expired. Please sign in again.",
        },
        401,
      );
    }

    if (rate.unavailable) {
      return json(
        {
          error:
            "The request protection service is temporarily unavailable. Please try again shortly.",
        },
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
        {
          error:
            "Too many requests. Please wait a moment and try again.",
        },
        429,
        {
          "Retry-After":
            String(
              rate.retryAfterSeconds,
            ),
          "X-RateLimit-Remaining":
            "0",
        },
      );
    }

    let body;

    try {
      body =
        await request.json();
    } catch {
      return json(
        {
          error:
            "Invalid JSON request.",
        },
        400,
      );
    }

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(body)
    ) {
      return json(
        {
          error:
            "Invalid request body.",
        },
        400,
      );
    }

    const validation =
      validateMessages(
        body.messages,
      );

    if (!validation.ok) {
      return json(
        {
          error:
            validation.error ||
            "Invalid chat messages.",
        },
        400,
      );
    }

    const messages =
      validation.messages;

    const allowedModes =
      new Set([
        "auto",
        "fast",
        "pro",
        "vision",
      ]);

    const mode =
      typeof body.mode ===
        "string" &&
      allowedModes.has(
        body.mode,
      )
        ? body.mode
        : "auto";

    const vision =
      hasVision(messages);

    const query =
      latestUserMessage(
        messages,
      );

    const conversationId =
      isUuid(body.conversationId)
        ? body.conversationId
        : null;

    if (conversationId) {
      const admin = createAdminClient();
      const { data: ownedConversation, error: ownershipError } =
        await admin
          .from("conversations")
          .select("id, user_id")
          .eq("id", conversationId)
          .maybeSingle();

      if (ownershipError) {
        throw ownershipError;
      }

      if (
        ownedConversation &&
        ownedConversation.user_id !== rate.userId
      ) {
        return json(
          { error: "This conversation is not available." },
          403,
          { "X-OZLIND-Request-ID": requestId },
        );
      }
    }

    const research =
      shouldResearch(
        body,
        query,
      );

    const providers =
      providerOrder(
        mode,
        vision,
        {
          messages,
          research,
        },
      );

    if (!providers.length) {
      return json(
        {
          error: vision
            ? "Image analysis is temporarily unavailable."
            : "OZLIND is temporarily unavailable.",
        },
        503,
      );
    }

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({
        async start(
          controller,
        ) {
          let closed = false;
          let output = "";

          const send = (
            event,
            data,
          ) => {
            if (
              closed ||
              request.signal?.aborted
            ) {
              return;
            }

            try {
              controller.enqueue(
                encoder.encode(
                  sse(
                    event,
                    data,
                  ),
                ),
              );
            } catch {
              closed = true;
            }
          };

          const close = () => {
            if (closed) {
              return;
            }

            closed = true;

            try {
              controller.close();
            } catch {
              // Already closed.
            }
          };

          try {
            send(
              "ready",
              {
                type: "ready",
              },
            );

            let sources = [];
            let researchNotice =
              null;
            let selectedProvider = null;
            let selectedModel = null;

            let documentResults =
              [];

            let documentNotice =
              null;

            send(
              "status",
              {
                type: "status",
                message:
                  research
                    ? "Gathering your documents and live sources…"
                    : "Checking your saved documents…",
              },
            );

            const searchQuery =
              buildSearchQuery(messages);

            const documentPromise =
              body.memory === false
                ? Promise.resolve({
                    results: [],
                    notice: null,
                  })
                : performDocumentRetrieval(
                    searchQuery,
                  );

            const researchPromise = research
              ? performResearch(searchQuery, request.signal)
              : Promise.resolve({ sources: [], notice: null });

            const [documentResult, researchResult] =
              await Promise.all([documentPromise, researchPromise]);

            documentResults = documentResult.results;
            documentNotice = documentResult.notice;
            sources = researchResult.sources;
            researchNotice = researchResult.notice;

            if (documentNotice) {
              send("notice", { type: "notice", message: documentNotice });
            }
            if (sources.length) {
              send("sources", {
                type: "sources",
                sources: publicSources(sources),
              });
            }
            if (researchNotice) {
              send("notice", { type: "notice", message: researchNotice });
            }

            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            const basePrompt =
              systemPrompt(
                {
                  responseStyle:
                    body.responseStyle,
                  responseLength:
                    body.responseLength,
                  customInstructions:
                    body.customInstructions,
                  memory:
                    body.memory,
                },
                {
                  results:
                    sources,
                },
              );

            const prompt =
              `${basePrompt}\n${buildDocumentContext(
                documentResults,
              )}`;

            send(
              "status",
              {
                type: "status",
                message:
                  vision
                    ? "Analysing the request…"
                    : documentResults.length
                      ? "Using relevant information from your documents…"
                      : "Preparing your response…",
              },
            );

            const providerResult =
              await generateChatResponse(
              {
                messages,
                mode,
                vision,
                systemPrompt:
                  prompt,
                providers,
                signal:
                  request.signal,

                onProvider:
                  (provider, model) => {
                    selectedProvider = provider;
                    selectedModel = model;
                  },

                onDelta:
                  (content) => {
                    if (
                      typeof content !==
                        "string" ||
                      !content ||
                      closed
                    ) {
                      return;
                    }

                    output +=
                      content;

                    send(
                      "delta",
                      {
                        type:
                          "delta",
                        content,
                      },
                    );
                  },
              },
            );

            if (providerResult?.provider) {
              selectedProvider = providerResult.provider;
            }
            if (providerResult?.model) {
              selectedModel = providerResult.model;
            }

            if (
              request.signal?.aborted
            ) {
              close();
              return;
            }

            if (!output.trim()) {
              throw new Error(
                "The AI returned an empty response.",
              );
            }

            send(
              "status",
              {
                type: "status",
                message: "",
              },
            );

            send(
              "done",
              {
                type: "done",
              },
            );

            await writeUsageLog({
              userId: rate.userId,
              conversationId,
              mode,
              provider: selectedProvider,
              model: selectedModel,
              latencyMs: Date.now() - requestStartedAt,
              ok: true,
            });

            close();
          } catch (error) {
            if (
              closed ||
              request.signal?.aborted
            ) {
              close();
              return;
            }

            const safeMessage =
              safeError(error);

            await writeUsageLog({
              userId: rate.userId,
              conversationId,
              mode,
              provider: selectedProvider,
              model: selectedModel,
              latencyMs: Date.now() - requestStartedAt,
              ok: false,
              error: safeMessage,
            });

            send(
              "error",
              {
                type: "error",
                error:
                  vision &&
                  safeMessage ===
                    "OZLIND could not complete that request. Please try again."
                    ? "OZLIND could not analyse that image right now. Please try again shortly."
                    : safeMessage,
              },
            );

            close();
          }
        },
      });

    return new Response(
      stream,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",
          "Cache-Control":
            "no-cache, no-transform",
          Connection:
            "keep-alive",
          "X-Accel-Buffering":
            "no",
          "X-OZLIND-Request-ID": requestId,
          "X-Content-Type-Options": "nosniff",
          "X-RateLimit-Remaining":
            String(
              rate.remaining,
            ),
        },
      },
    );
  } catch (error) {
    console.error("OZLIND chat request failed:", { requestId, error });
    await writeUsageLog({
      userId: rateUserId,
      conversationId: null,
      mode: "unknown",
      latencyMs: Date.now() - requestStartedAt,
      ok: false,
      error: safeError(error),
    });
    return json({ error: safeError(error) }, 500, { "X-OZLIND-Request-ID": requestId });
  }
}