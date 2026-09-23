import { json, clean, limits } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const query = clean(body?.query, limits().researchQuery);

    if (!query) return json({ error: "A research query is required." }, 400);
    if (!process.env.TAVILY_API_KEY) {
      return json({ error: "Live research is not configured." }, 503);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          topic: "general",
          search_depth: "basic",
          max_results: 5,
          include_answer: true,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return json({ error: "Live research is temporarily unavailable." }, 502);
      }

      return json({
        answer: data.answer || "",
        results: (data.results || [])
          .slice(0, 5)
          .map((item) => ({
            title: item.title || "",
            url: item.url || "",
            domain: (() => {
              try {
                return new URL(item.url || "")
                  .hostname.replace(/^www\./, "");
              } catch {
                return "";
              }
            })(),
            content: item.content || "",
          }))
          .filter((item) => /^https?:\/\//i.test(item.url)),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return json({ error: "Invalid research request." }, 400);
  }
}
