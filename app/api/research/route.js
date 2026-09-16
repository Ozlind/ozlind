import {
  cleanText,
  json,
  originAllowed,
  rateLimit,
} from "../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 1200;
const MAX_RESULTS = 8;
const MAX_CONTENT_LENGTH = 2200;

function cleanUrl(value) {
  const url = cleanText(value, 1200);

  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeResults(results) {
  if (!Array.isArray(results)) return [];

  return results
    .slice(0, MAX_RESULTS)
    .map((result) => ({
      title: cleanText(result?.title || "", 300),
      url: cleanUrl(result?.url || ""),
      content: cleanText(
        result?.content || "",
        MAX_CONTENT_LENGTH
      ),
      score:
        typeof result?.score === "number"
          ? result.score
          : null,
    }))
    .filter((result) => result.url);
}

export async function POST(request) {
  try {
    /* ---------------------------------------------
       Security
    --------------------------------------------- */

    if (!originAllowed(request)) {
      return json(
        { error: "Origin rejected." },
        { status: 403 }
      );
    }

    const limit = rateLimit(request, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!limit.ok) {
      return json(
        {
          error:
            "Too many research requests. Please wait and try again.",
          retryAfter: limit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              limit.retryAfter || 30
            ),
          },
        }
      );
    }

    /* ---------------------------------------------
       API key
    --------------------------------------------- */

    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return json(
        {
          error:
            "Web research is not configured yet.",
        },
        { status: 503 }
      );
    }

    /* ---------------------------------------------
       Request
    --------------------------------------------- */

    const body = await request.json();

    const query = cleanText(
      body.query || body.prompt || "",
      MAX_QUERY_LENGTH
    );

    if (!query) {
      return json(
        {
          error:
            "A research query is required.",
        },
        { status: 400 }
      );
    }

    const depth =
      body.depth === "advanced"
        ? "advanced"
        : "basic";

    /* ---------------------------------------------
       Tavily
    --------------------------------------------- */

    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: depth,
          topic:
            body.topic === "news"
              ? "news"
              : "general",

          max_results: MAX_RESULTS,

          include_answer: true,
          include_raw_content: false,
          include_images: false,

          auto_parameters: true,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const detail = (
        await response.text()
      ).slice(0, 500);

      console.error(
        "[ozlind/research/tavily]",
        response.status,
        detail
      );

      return json(
        {
          error:
            "Web research provider returned an error.",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const sources = normalizeResults(
      data.results
    );

    /* ---------------------------------------------
       Response
    --------------------------------------------- */

    return json({
      success: true,

      query,

      answer: cleanText(
        data.answer || "",
        5000
      ),

      sources,

      metadata: {
        resultCount: sources.length,
        depth,
        topic:
          body.topic === "news"
            ? "news"
            : "general",
      },
    });
  } catch (error) {
    console.error(
      "[ozlind/research]",
      error
    );

    return json(
      {
        error:
          "Web research could not be completed. Please try again.",
      },
      { status: 500 }
    );
  }
}
