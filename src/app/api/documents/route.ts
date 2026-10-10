import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteDocument, ingestDocument, searchDocuments } from "@/lib/rag";
import { checkUserRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const uploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(150).default("text/plain"),
  sizeBytes: z.number().int().nonnegative().max(2_000_000),
  content: z.string().min(1).max(120_000),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";
    const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
    // Malformed query parameters must not become NaN and turn a client error
    // into a misleading database/service failure.
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
      : 20;

    if (query) {
      const results = await searchDocuments(query, { matchCount: limit });
      return Response.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const { data, error: listError } = await supabase
      .from("documents")
      .select("id,name,mime,size_bytes,char_count,chunk_count,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (listError) throw listError;
    return Response.json({ documents: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[documents]", error);
    return Response.json({ error: { code: "DOCUMENTS_UNAVAILABLE" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "INVALID_DOCUMENT" } }, { status: 400 });

    const rateLimit = await checkUserRateLimit();
    if (rateLimit.unavailable) {
      return Response.json({ error: { code: "RATE_LIMITER_UNAVAILABLE" } }, { status: 503 });
    }
    if (rateLimit.unauthorized) {
      return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
    }
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: "RATE_LIMITED" } },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }

    const { count, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countError) throw countError;
    if ((count ?? 0) >= 20) {
      return Response.json({ error: { code: "DOCUMENT_LIMIT_REACHED" } }, { status: 409 });
    }

    const document = await ingestDocument(parsed.data);
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    console.error("[documents]", error);
    // Do not expose database, embedding-provider, or internal exception details
    // to clients. Keep diagnostics in server logs and return a stable envelope.
    return Response.json(
      { error: { code: "DOCUMENT_INGEST_FAILED", message: "Could not process the document. Please check the file and try again." } },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return Response.json({ error: { code: "INVALID_DOCUMENT_ID" } }, { status: 400 });

    await deleteDocument(parsed.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[documents]", error);
    return Response.json({ error: { code: "DOCUMENT_DELETE_FAILED" } }, { status: 500 });
  }
}
