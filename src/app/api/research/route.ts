import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkUserRateLimit } from "@/lib/rate-limit";

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

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", requestId } }, { status: 400 });

    const rateLimit = await checkUserRateLimit();
    if (rateLimit.unavailable) {
      return Response.json({ error: { code: "RATE_LIMITER_UNAVAILABLE", requestId } }, { status: 503 });
    }
    if (rateLimit.unauthorized) {
      return Response.json({ error: { code: "AUTH_REQUIRED", requestId } }, { status: 401 });
    }
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: "RATE_LIMITED", requestId, message: "Too many requests. Please try again shortly." } },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }

    const key = process.env.TAVILY_API_KEY;
    if (!key) return Response.json({ error: { code: "RESEARCH_NOT_CONFIGURED", requestId, message: "Web research is not configured." } }, { status: 503 });

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

    const body = await response.json();
    return Response.json({
      answer: body.answer ?? null,
      results: (body.results ?? []).map((item: { title?: string; url?: string; content?: string }) => ({
        title: item.title ?? "Untitled",
        url: item.url ?? "",
        snippet: item.content ?? "",
      })),
      requestId,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "research.error", requestId, error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: { code: "RESEARCH_UNAVAILABLE", requestId } }, { status: 503 });
  }
}
