import {
  buildSearchQuery,
  performResearch,
} from "@/lib/ai/research";
import {
  buildDocumentContext,
  performDocumentRetrieval,
} from "@/lib/rag/context";
import {
  safeError,
  systemPrompt,
} from "@/lib/server";
import { generateChatResponse } from "@/lib/ai/gateway";
import { writeUsageLog } from "@/lib/backend/usage";

function sse(event, data) {
  return "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
}

function sourceList(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 8)
    .map(({ title, url, domain, publishedDate }) => ({
      title,
      url,
      domain,
      ...(publishedDate ? { publishedDate } : {}),
    }));
}

export async function createChatStream({
  messages,
  body,
  mode,
  vision,
  providers,
  research,
  userId,
  conversationId,
  request,
  requestId,
  requestStartedAt,
}) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let closed = false;
      let output = "";
      let selectedProvider = null;
      let selectedModel = null;

      const send = (event, data) => {
        if (closed || request.signal?.aborted) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      try {
        send("ready", { type: "ready" });

        const searchQuery = buildSearchQuery(messages);

        send("status", {
          type: "status",
          message: research
            ? "Gathering your documents and live sources…"
            : "Checking your saved documents…",
        });

        const documentPromise =
          body.memory === false
            ? Promise.resolve({ results: [], notice: null })
            : performDocumentRetrieval(searchQuery);

        const researchPromise = research
          ? performResearch(searchQuery, request.signal)
          : Promise.resolve({ sources: [], notice: null });

        const [documentResult, researchResult] =
          await Promise.all([documentPromise, researchPromise]);

        if (documentResult.notice) {
          send("notice", {
            type: "notice",
            message: documentResult.notice,
          });
        }

        const sources = sourceList(researchResult.sources);

        if (sources.length) {
          send("sources", { type: "sources", sources });
        }

        if (researchResult.notice) {
          send("notice", {
            type: "notice",
            message: researchResult.notice,
          });
        }

        if (request.signal?.aborted) {
          close();
          return;
        }

        const prompt =
          systemPrompt(
            {
              responseStyle: body.responseStyle,
              responseLength: body.responseLength,
              customInstructions: body.customInstructions,
              memory: body.memory,
            },
            { results: researchResult.sources || [] },
          ) +
          "\n" +
          buildDocumentContext(documentResult.results);

        send("status", {
          type: "status",
          message: vision
            ? "Analysing the request…"
            : documentResult.results?.length
              ? "Using relevant information from your documents…"
              : "Preparing your response…",
        });

        const providerResult = await generateChatResponse({
          messages,
          mode,
          vision,
          systemPrompt: prompt,
          providers,
          signal: request.signal,
          onProvider: (provider, model) => {
            selectedProvider = provider;
            selectedModel = model;
            send("provider", {
              type: "provider",
              provider,
              model,
            });
          },
          onDelta: (content) => {
            if (!content || closed) return;
            output += content;
            send("delta", {
              type: "delta",
              content,
            });
          },
        });

        selectedProvider = providerResult?.provider || selectedProvider;
        selectedModel = providerResult?.model || selectedModel;

        if (request.signal?.aborted) {
          close();
          return;
        }

        if (!output.trim()) {
          throw new Error("The AI returned an empty response.");
        }

        send("status", { type: "status", message: "" });
        send("done", { type: "done" });

        await writeUsageLog({
          userId,
          conversationId,
          requestId,
          mode,
          provider: selectedProvider,
          model: selectedModel,
          latencyMs: Date.now() - requestStartedAt,
          ok: true,
        });

        close();
      } catch (error) {
        if (closed || request.signal?.aborted) {
          close();
          return;
        }

        const message = safeError(error);

        await writeUsageLog({
          userId,
          conversationId,
          mode,
          provider: selectedProvider,
          model: selectedModel,
          latencyMs: Date.now() - requestStartedAt,
          ok: false,
          error: message,
        });

        send("error", {
          type: "error",
          error:
            vision &&
            message === "OZLIND could not complete that request. Please try again."
              ? "OZLIND could not analyse that image right now. Please try again shortly."
              : message,
        });

        close();
      }
    },
  });
}
