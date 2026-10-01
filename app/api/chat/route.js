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

const RESEARCH_TIMEOUT = 15_000;

async function tavilySearch(query) {
  const apiKey =
    process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Web search is not configured."
    );
  }

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    RESEARCH_TIMEOUT
  );

  try {
    const response =
      await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${apiKey}`,
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
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof data?.detail ===
        "string"
          ? data.detail
          : "Web search request failed.";

      throw new Error(detail);
    }

    const results = Array.isArray(
      data?.results
    )
      ? data.results
          .slice(0, 5)
          .map((item) => {
            let domain = "";

            try {
              domain = new URL(
                item?.url || ""
              )
                .hostname.replace(
                  /^www\./,
                  ""
                );
            } catch {
              domain = "";
            }

            return {
              title:
                typeof item?.title ===
                "string"
                  ? item.title
                  : "",
              url:
                typeof item?.url ===
                "string"
                  ? item.url
                  : "",
              domain,
              content:
                typeof item?.content ===
                "string"
                  ? item.content
                  : "",
            };
          })
          .filter((item) =>
            /^https?:\/\//i.test(
              item.url
            )
          )
      : [];

    return {
      answer:
        typeof data?.answer ===
        "string"
          ? data.answer
          : "",
      results,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Web search timed out."
      );
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
      latestUserMessage(
        messages
      );

    const vision =
      hasVision(messages);

    if (
      !query.trim() &&
      !vision
    ) {
      return json(
        {
          error:
            "Please enter a message.",
        },
        400
      );
    }

    let research = null;
    let researchNotice = "";

    if (
      shouldResearch(
        body || {},
        query
      )
    ) {
      try {
        research =
          await tavilySearch(
            query
          );
      } catch (error) {
        console.error(
          "OZLIND research error:",
          error?.message
        );

        /*
         * Normal chat should NEVER fail merely because Tavily
         * is unavailable.
         */
        researchNotice =
          "Live web research is unavailable right now. Continuing without live sources.";
      }
    }

    const system =
      systemPrompt(
        body || {},
        research
      );

    const mode =
      typeof body?.mode ===
      "string"
        ? body.mode
        : "auto";

    const order =
      providerOrder(
        mode,
        vision
      );

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({
        async start(controller) {
          let closed = false;

          const send = (payload) => {
            if (closed) {
              return;
            }

            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify(
                    payload
                  )}\n\n`
                )
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
              // Stream may already be closed by the runtime.
            }
          };

          try {
            send({
              type: "ready",
            });

            if (researchNotice) {
              send({
                type: "notice",
                message:
                  researchNotice,
              });
            }

            const result =
              await streamFromProviders({
                order,
                messages,
                system,
                mode,
                hasVision: vision,

                onDelta(delta) {
                  send({
                    type: "delta",
                    content: delta,
                  });
                },
              });

            if (
              research?.results
                ?.length
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

            console.info(
              "OZLIND provider:",
              result.provider,
              result.model
            );

            close();
          } catch (error) {
            console.error(
              "OZLIND chat error:",
              error
            );

            send({
              type: "error",
              error:
                safeError(error),
            });

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
        },
      }
    );
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