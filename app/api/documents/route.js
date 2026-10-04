import {
  deleteDocument,
  ingestDocument,
  searchDocuments,
} from "@/lib/rag";

import { json } from "@/lib/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getAuthenticatedUser() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    const error =
      new Error(
        "Authentication required.",
      );

    error.code =
      "AUTH_REQUIRED";

    throw error;
  }

  return {
    supabase,
    user,
  };
}

/* -------------------------------------------------------------------------- */
/* POST — INGEST DOCUMENT                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(
  request,
) {
  try {
    const {
      user,
    } =
      await getAuthenticatedUser();

    let body;

    try {
      body =
        await request.json();
    } catch {
      return json(
        {
          error:
            "Invalid JSON request.",
        },
        400,
      );
    }

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(body)
    ) {
      return json(
        {
          error:
            "Invalid document request.",
        },
        400,
      );
    }

    /*
     * The authenticated user is obtained
     * from the server session.
     *
     * No client-provided user ID is accepted.
     */
    const document =
      await ingestDocument({
        name: body.name,
        mime: body.mime,
        sizeBytes:
          body.sizeBytes,
        content:
          body.content,
      });

    return json(
      {
        ok: true,
        document,
      },
      201,
    );
  } catch (error) {
    console.error(
      "OZLIND document ingestion error:",
      error,
    );

    if (
      error?.code ===
      "AUTH_REQUIRED" ||
      /authentication required/i.test(
        error?.message || "",
      )
    ) {
      return json(
        {
          error:
            "Please sign in before adding documents.",
        },
        401,
      );
    }

    const message =
      error?.message || "";

    if (
      /too large/i.test(
        message,
      )
    ) {
      return json(
        {
          error: message,
        },
        413,
      );
    }

    if (
      /empty|readable|chunks/i.test(
        message,
      )
    ) {
      return json(
        {
          error: message,
        },
        400,
      );
    }

    return json(
      {
        error:
          "OZLIND could not process this document right now. Please try again.",
      },
      500,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* GET — LIST DOCUMENTS OR SEARCH DOCUMENTS                                   */
/* -------------------------------------------------------------------------- */

export async function GET(
  request,
) {
  try {
    const {
      supabase,
      user,
    } =
      await getAuthenticatedUser();

    const url =
      new URL(
        request.url,
      );

    const query =
      url.searchParams
        .get("q")
        ?.trim() || "";

    /*
     * Search mode:
     *
     * /api/documents?q=...
     *
     * Uses vector retrieval and returns only
     * chunks belonging to the authenticated user.
     */
    if (query) {
      const results =
        await searchDocuments(
          query,
          {
            matchThreshold:
              Number(
                url.searchParams.get(
                  "threshold",
                ),
              ) || 0.55,

            matchCount:
              Number(
                url.searchParams.get(
                  "limit",
                ),
              ) || 8,
          },
        );

      return json({
        ok: true,
        results,
      });
    }

    /*
     * Library mode:
     *
     * /api/documents
     *
     * Only document metadata is returned.
     * Document contents and embeddings are never
     * exposed through this endpoint.
     */
    const {
      data,
      error,
    } =
      await supabase
        .from("documents")
        .select(
          [
            "id",
            "name",
            "mime",
            "size_bytes",
            "char_count",
            "chunk_count",
            "status",
            "created_at",
          ].join(", "),
        )
        .eq(
          "user_id",
          user.id,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(100);

    if (error) {
      throw error;
    }

    const documents =
      Array.isArray(data)
        ? data.map(
            (document) => ({
              id:
                document.id,

              name:
                document.name,

              mime:
                document.mime,

              sizeBytes:
                document.size_bytes,

              charCount:
                document.char_count,

              chunkCount:
                document.chunk_count,

              status:
                document.status,

              createdAt:
                document.created_at,
            }),
          )
        : [];

    return json({
      ok: true,
      documents,
    });
  } catch (error) {
    console.error(
      "OZLIND document request error:",
      error,
    );

    if (
      error?.code ===
      "AUTH_REQUIRED" ||
      /authentication required/i.test(
        error?.message || "",
      )
    ) {
      return json(
        {
          error:
            "Please sign in before accessing your documents.",
        },
        401,
      );
    }

    return json(
      {
        error:
          "OZLIND could not load your documents right now.",
      },
      500,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE — DELETE OWN DOCUMENT                                               */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  request,
) {
  try {
    await getAuthenticatedUser();

    const url =
      new URL(
        request.url,
      );

    const documentId =
      url.searchParams
        .get("id")
        ?.trim() || "";

    /*
     * UUID format validation prevents accidental
     * malformed database requests.
     */
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      !uuidPattern.test(
        documentId,
      )
    ) {
      return json(
        {
          error:
            "A valid document id is required.",
        },
        400,
      );
    }

    await deleteDocument(
      documentId,
    );

    return json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "OZLIND document deletion error:",
      error,
    );

    if (
      error?.code ===
      "AUTH_REQUIRED" ||
      /authentication required/i.test(
        error?.message || "",
      )
    ) {
      return json(
        {
          error:
            "Please sign in before deleting documents.",
        },
        401,
      );
    }

    return json(
      {
        error:
          "Could not delete the document.",
      },
      500,
    );
  }
}