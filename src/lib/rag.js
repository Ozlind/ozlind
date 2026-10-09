import { createClient } from "@/lib/supabase/server";

import {
  createEmbedding,
  createEmbeddings,
} from "@/lib/embeddings";

const MAX_DOCUMENT_SIZE =
  2 * 1024 * 1024;

const MAX_DOCUMENT_CHARS =
  120000;

const MAX_CHUNKS = 40;

const CHUNK_SIZE = 5000;

const CHUNK_OVERLAP = 500;

function cleanText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoChunks(text) {
  const normalized =
    cleanText(text);

  if (!normalized) {
    return [];
  }

  const chunks = [];

  let start = 0;

  while (
    start < normalized.length &&
    chunks.length < MAX_CHUNKS
  ) {
    let end = Math.min(
      start + CHUNK_SIZE,
      normalized.length,
    );

    if (
      end < normalized.length
    ) {
      const paragraphBreak =
        normalized.lastIndexOf(
          "\n\n",
          end,
        );

      const sentenceBreak =
        normalized.lastIndexOf(
          ". ",
          end,
        );

      const whitespaceBreak =
        normalized.lastIndexOf(
          " ",
          end,
        );

      if (
        paragraphBreak >
        start +
          CHUNK_SIZE * 0.65
      ) {
        end = paragraphBreak;
      } else if (
        sentenceBreak >
        start +
          CHUNK_SIZE * 0.65
      ) {
        end =
          sentenceBreak + 1;
      } else if (
        whitespaceBreak >
        start +
          CHUNK_SIZE * 0.65
      ) {
        end = whitespaceBreak;
      }
    }

    const chunk =
      normalized
        .slice(start, end)
        .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (
      end >=
      normalized.length
    ) {
      break;
    }

    start = Math.max(
      end - CHUNK_OVERLAP,
      start + 1,
    );
  }

  return chunks;
}

function validateDocumentInput({
  name,
  mime,
  sizeBytes,
  content,
}) {
  const safeName =
    String(
      name ||
        "Untitled document",
    )
      .trim()
      .slice(0, 255);

  const safeMime =
    String(
      mime ||
        "text/plain",
    )
      .trim()
      .slice(0, 150);

  const numericSize =
    Number(sizeBytes);

  const text =
    cleanText(content).slice(
      0,
      MAX_DOCUMENT_CHARS,
    );

  if (!text) {
    throw new Error(
      "The document does not contain readable text.",
    );
  }

  if (
    Number.isFinite(
      numericSize,
    ) &&
    numericSize >
      MAX_DOCUMENT_SIZE
  ) {
    throw new Error(
      "Document is too large. The maximum supported size is 2 MB.",
    );
  }

  return {
    name: safeName,
    mime: safeMime,
    sizeBytes:
      Number.isFinite(
        numericSize,
      ) &&
      numericSize >= 0
        ? numericSize
        : null,
    content: text,
  };
}

async function getAuthenticatedUser(
  supabase,
) {
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
    throw new Error(
      "Authentication required.",
    );
  }

  return user;
}

export async function ingestDocument({
  name,
  mime,
  sizeBytes,
  content,
}) {
  const supabase =
    await createClient();

  const user =
    await getAuthenticatedUser(
      supabase,
    );

  const document =
    validateDocumentInput({
      name,
      mime,
      sizeBytes,
      content,
    });

  const chunks =
    splitIntoChunks(
      document.content,
    );

  if (!chunks.length) {
    throw new Error(
      "No usable document chunks were created.",
    );
  }

  const {
    data: documentRow,
    error: documentError,
  } =
    await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        name: document.name,
        mime: document.mime,
        size_bytes:
          document.sizeBytes,
        char_count:
          document.content.length,
        chunk_count: 0,
        status: "processing",
      })
      .select(
        "id, name, mime, size_bytes, char_count, status, created_at",
      )
      .single();

  if (documentError) {
    throw documentError;
  }

  try {
    const embeddings =
      await createEmbeddings(
        chunks,
        {
          taskType:
            "RETRIEVAL_DOCUMENT",

          titles:
            chunks.map(
              () =>
                document.name,
            ),
        },
      );

    if (
      embeddings.length !==
      chunks.length
    ) {
      throw new Error(
        "The embedding service returned an incomplete document index.",
      );
    }

    const rows =
      chunks.map(
        (
          content,
          index,
        ) => ({
          document_id:
            documentRow.id,

          user_id:
            user.id,

          chunk_index:
            index,

          content,

          embedding:
            embeddings[index],
        }),
      );

    const {
      error: chunkError,
    } =
      await supabase
        .from(
          "document_chunks",
        )
        .insert(rows);

    if (chunkError) {
      throw chunkError;
    }

    const {
      data:
        readyDocument,
      error:
        updateError,
    } =
      await supabase
        .from("documents")
        .update({
          chunk_count:
            rows.length,

          status: "ready",
        })
        .eq(
          "id",
          documentRow.id,
        )
        .eq(
          "user_id",
          user.id,
        )
        .select(
          "id, name, mime, size_bytes, char_count, chunk_count, status, created_at",
        )
        .single();

    if (updateError) {
      throw updateError;
    }

    return readyDocument;
  } catch (error) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
      })
      .eq(
        "id",
        documentRow.id,
      )
      .eq(
        "user_id",
        user.id,
      );

    throw error;
  }
}

export async function searchDocuments(
  query,
  {
    matchThreshold = 0.55,
    matchCount = 8,
  } = {},
) {
  const supabase =
    await createClient();

  const user =
    await getAuthenticatedUser(
      supabase,
    );

  const text =
    cleanText(query).slice(
      0,
      4000,
    );

  if (!text) {
    return [];
  }

  const {
    data:
      existingDocument,
    error:
      documentCheckError,
  } =
    await supabase
      .from("documents")
      .select("id")
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "status",
        "ready",
      )
      .limit(1)
      .maybeSingle();

  if (documentCheckError) {
    throw documentCheckError;
  }

  if (!existingDocument) {
    return [];
  }

  const embedding =
    await createEmbedding(
      text,
      {
        taskType:
          "RETRIEVAL_QUERY",
      },
    );

  const numericThreshold =
    Number(
      matchThreshold,
    );

  const threshold =
    Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(
          numericThreshold,
        )
          ? numericThreshold
          : 0.55,
      ),
    );

  const numericCount =
    Number(matchCount);

  const count =
    Math.min(
      20,
      Math.max(
        1,
        Number.isFinite(
          numericCount,
        )
          ? numericCount
          : 8,
      ),
    );

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding:
          embedding,

        match_threshold:
          threshold,

        match_count:
          count,
      },
    );

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(
      (row) =>
        typeof row?.content ===
          "string" &&
        row.content.trim(),
    )
    .map((row) => ({
      id: row.id,

      documentId:
        row.document_id,

      name:
        row.document_name ||
        "Document",

      chunkIndex:
        row.chunk_index,

      content:
        row.content,

      similarity:
        Number(
          row.similarity,
        ) || 0,
    }));
}

export async function deleteDocument(
  documentId,
) {
  const supabase =
    await createClient();

  const user =
    await getAuthenticatedUser(
      supabase,
    );

  const {
    error,
  } =
    await supabase
      .from("documents")
      .delete()
      .eq(
        "id",
        documentId,
      )
      .eq(
        "user_id",
        user.id,
      );

  if (error) {
    throw error;
  }
}