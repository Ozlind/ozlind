import {
  deleteDocument,
  ingestDocument,
  searchDocuments,
} from "@/lib/rag";

import { json } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request,
) {
  try {
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

    const message =
      error?.message ||
      "Could not process the document.";

    if (
      /authentication required/i.test(
        message,
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

export async function GET(
  request,
) {
  try {
    const url =
      new URL(
        request.url,
      );

    const query =
      url.searchParams
        .get("q")
        ?.trim() || "";

    if (!query) {
      return json(
        {
          ok: true,
          results: [],
        },
      );
    }

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
  } catch (error) {
    console.error(
      "OZLIND document search error:",
      error,
    );

    const message =
      error?.message || "";

    if (
      /authentication required/i.test(
        message,
      )
    ) {
      return json(
        {
          error:
            "Please sign in before searching documents.",
        },
        401,
      );
    }

    return json(
      {
        error:
          "OZLIND could not search your documents right now.",
      },
      500,
    );
  }
}

export async function DELETE(
  request,
) {
  try {
    const url =
      new URL(
        request.url,
      );

    const documentId =
      url.searchParams
        .get("id")
        ?.trim();

    if (!documentId) {
      return json(
        {
          error:
            "Document id is required.",
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

    const message =
      error?.message || "";

    if (
      /authentication required/i.test(
        message,
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