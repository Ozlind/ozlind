import { json } from "@/lib/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 120;
const MAX_RESULTS = 30;

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: "Authentication required." }, 401);
    }

    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_QUERY_CHARS);

    if (query.length < 2) {
      return json({ results: [] });
    }

    const { data, error } = await supabase
      .from("messages")
      .select(
        "conversation_id, created_at, content, conversations!inner(id, title, updated_at, archived)",
      )
      .eq("user_id", user.id)
      .textSearch("search", query, {
        type: "websearch",
        config: "simple",
      })
      .order("created_at", { ascending: false })
      .limit(MAX_RESULTS * 2);

    if (error) {
      console.error("OZLIND history search failed:", error);
      return json(
        { error: "History search is temporarily unavailable." },
        500,
      );
    }

    const seen = new Set();
    const results = [];

    for (const row of data || []) {
      const conversation = row?.conversations;
      const id = row?.conversation_id;

      if (!id || seen.has(id) || conversation?.archived) {
        continue;
      }

      seen.add(id);
      results.push({
        id,
        title: conversation?.title || "New conversation",
        updatedAt:
          Date.parse(
            conversation?.updated_at ||
              row?.created_at ||
              "",
          ) || Date.now(),
      });

      if (results.length >= MAX_RESULTS) break;
    }

    return json({ results });
  } catch (error) {
    console.error("OZLIND history search error:", error);
    return json(
      { error: "History search is temporarily unavailable." },
      500,
    );
  }
}
