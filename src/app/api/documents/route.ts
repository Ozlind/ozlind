import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteDocument, ingestDocument, searchDocuments } from "@/lib/documents/rag";
import { checkUserRateLimit, rateLimitErrorResponse } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_DOCUMENT_BODY_BYTES = 600 * 1024;

const uploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(150).default("text/plain"),
  sizeBytes: z.number().int().nonnegative().max(2_000_000),
  content: z.string().min(1).max(120_000).refine((value) => value.trim().length > 0),
});

function errorResponse(code: string, requestId: string, status: number) {
  return Response.json(
    { error: { code, requestId } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return errorResponse("AUTH_REQUIRED", requestId, 401);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";
    if (query.length > 500) return errorResponse("INVALID_QUERY", requestId, 400);

    const requestedLimit = Number(url.searchParams.get("limit") || 20);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
      : 20;

    if (query) {
      // Embedding/search incurs provider cost; it shares the per-user budget.
      const rateLimit = await checkUserRateLimit();
      const rateLimitError = rateLimitErrorResponse(rateLimit, requestId);
      if (rateLimitError) return rateLimitError;

      const results = await searchDocuments(query, { matchCount: limit });
      return Response.json({ results, requestId }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const { data, error: listError } = await supabase
      .from("documents")
      .select("id,name,mime,size_bytes,char_count,chunk_count,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (listError) throw listError;
    return Response.json({ documents: data ?? [], requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({
      event: "documents.list_failed",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse("DOCUMENTS_UNAVAILABLE", requestId, 503);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return errorResponse("AUTH_REQUIRED", requestId, 401);

    let requestBody: unknown;
    try {
      requestBody = await readJsonBody(request, MAX_DOCUMENT_BODY_BYTES);
    } catch (bodyError) {
      if (bodyError instanceof PayloadTooLargeError) {
        return errorResponse("PAYLOAD_TOO_LARGE", requestId, 413);
      }
      return errorResponse("INVALID_DOCUMENT", requestId, 400);
    }

    const parsed = uploadSchema.safeParse(requestBody);
    if (!parsed.success) return errorResponse("INVALID_DOCUMENT", requestId, 400);

    const rateLimit = await checkUserRateLimit();
    const rateLimitError = rateLimitErrorResponse(rateLimit, requestId);
    if (rateLimitError) return rateLimitError;

    const { count, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error(JSON.stringify({ event: "documents.quota_check_failed", requestId, error: countError.message }));
      return errorResponse("DOCUMENT_QUOTA_CHECK_FAILED", requestId, 503);
    }
    if ((count ?? 0) >= 20) return errorResponse("DOCUMENT_LIMIT_REACHED", requestId, 409);

    const document = await ingestDocument(parsed.data);
    return Response.json({ document, requestId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({
      event: "documents.ingest_failed",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }));
    // Do not expose provider or database exception messages to clients.
    return Response.json({
      error: {
        code: "DOCUMENT_INGEST_FAILED",
        requestId,
        message: "Document processing is temporarily unavailable.",
      },
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return errorResponse("AUTH_REQUIRED", requestId, 401);

    const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
    if (!id.success) return errorResponse("INVALID_DOCUMENT_ID", requestId, 400);

    const rateLimit = await checkUserRateLimit();
    const rateLimitError = rateLimitErrorResponse(rateLimit, requestId);
    if (rateLimitError) return rateLimitError;

    await deleteDocument(id.data);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({
      event: "documents.delete_failed",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse("DOCUMENT_DELETE_FAILED", requestId, 500);
  }
}
