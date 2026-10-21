import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkUserRateLimit, rateLimitErrorResponse } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request.mjs";
import { normalizeTavilyResponse } from "@/lib/research/tavily.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const schema = z.object({ query: z.string().trim().min(2).max(500) });

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: { code: "AUTH_REQUIRED", requestId } }, { status: 401 });

    let requestBody: unknown;
    try {
      requestBody = await readJsonBody(request, 16 * 1024);
    } catch (bodyError) {
      if (bodyError instanceof PayloadTooLargeError) {
        return Response.json({ error: { code: "PAYLOAD_TOO_LARGE", requestId } }, { status: 413 });
      }
      return Response.json({ error: { code: "INVALID_INPUT", requestId } }, { status: 400 });
    }

    const parsed = schema.safeParse(requestBody);
    if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", requestId } }, { status: 400 });

    const key = process.env.TAVILY_API_KEY;
    if (!key) return Response.json({ error: { code: "RESEARCH_NOT_CONFIGURED", requestId, message: "Web research is not configured." } }, { status: 503 });

    // Share the fail-closed per-user request budget used by the chat route.
    const rateLimit = await checkUserRateLimit(user.id);
    const rateLimitError = rateLimitErrorResponse(rateLimit, requestId);
    if (rateLimitError) return rateLimitError;

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: parsed.data.query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(JSON.stringify({ event: "research.provider_failed", requestId, status: response.status }));
      return Response.json({ error: { code: "RESEARCH_PROVIDER_ERROR", requestId } }, { status: 502 });
    }

    const normalized = normalizeTavilyResponse(await response.json());
    if (!normalized.results.length) {
      console.warn(JSON.stringify({ event: "research.no_usable_sources", requestId }));
      return Response.json({
        error: {
          code: "RESEARCH_NO_USABLE_SOURCES",
          requestId,
          message: "The search provider returned no usable sources. Try another query shortly.",
        },
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({
      answer: normalized.answer,
      results: normalized.results.map(({ title, url, content }) => ({
        title,
        url,
        snippet: content,
      })),
      requestId,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "research.error", requestId, error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: { code: "RESEARCH_UNAVAILABLE", requestId } }, { status: 503 });
  }
}
