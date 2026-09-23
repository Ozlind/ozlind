import {
  clean,
  hasVision,
  json,
  latestUserMessage,
  safeError,
  shouldResearch,
  systemPrompt,
  validateMessages,
} from "@/lib/server";

import {
  providerOrder,
  streamFromProviders,
} from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Web search is not configured on the server.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query.slice(0, 500),
        topic: "general",
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : "Web search request failed.";
      throw new Error(detail);
    }

    const results = (data.results || [])
      .slice(0, 5)
      .map((item) => {
        let domain = "";
        try {
          domain = new URL(item.url || "").hostname.replace(/^www\./, "");
        } catch {}

        return {
          title: item.title || "",
          url: item.url || "",
          domain,
          content: item.content || "",
        };
      })
      .filter((item) => /^https?:\/\//i.test(item.url));

    return {
      answer: data.answer || "",
      results,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Web search timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  try {
    const body =
      await request.json();

    const messages =
      validateMessages(
        body?.messages
      );

    const query =
      latestUserMessage(messages);

    const vision =
      hasVision(messages);

    if (!query.trim() && !vision) {
      return json(
        {
          error:
            "Please enter a message.",
        },
        400
      );
    }

    const research =
      shouldResearch(
        body || {},
        query
      )
        ? await tavilySearch(query)
        : null;

    const system =
      systemPrompt(
        body || {},
        research
      );

    const order =
      providerOrder(
        body?.mode || "auto",
        vision
      );

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({
        async start(controller) {
          const send = (payload) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(
                  payload
                )}\n\n`
              )
            );
          };

          try {
            send({
              type: "ready",
            });

            const result =
              await streamFromProviders({
                order,
                messages,
                system,

                onDelta(delta) {
                  send({
                    type: "delta",
                    content: delta,
                  });
                },
              });

            if (
              research?.results?.length
            ) {
              send({
                type: "sources",
                sources:
                  research.results,
              });
            }

            send({
              type: "done",
            });

            controller.close();
          } catch (error) {
            send({
              type: "error",
              error: safeError(error),
            });

            controller.close();
          }
        },
      });

    return new Response(stream, {
      status: 200,

      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        Connection: "keep-alive",

        "X-Accel-Buffering":
          "no",
      },
    });
  } catch (error) {
    return json(
      {
        error: clean(
          safeError(error),
          220
        ),
      },
      400
    );
  }
}
