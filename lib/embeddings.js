const DEFAULT_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;
const MAX_TEXT_LENGTH = 30000;

function normalizeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function createEmbedding(
  text,
  {
    taskType = null,
  } = {},
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini embedding service is not configured.",
    );
  }

  const input = normalizeText(text);

  if (!input) {
    throw new Error(
      "Cannot create an embedding from empty text.",
    );
  }

  const model =
    process.env.EMBEDDING_MODEL?.trim() ||
    DEFAULT_MODEL;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [
              {
                text: input,
              },
            ],
          },
          output_dimensionality:
            EMBEDDING_DIMENSIONS,

          ...(taskType
            ? {
                task_type: taskType,
              }
            : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      let detail = "";

      try {
        const data = await response.json();

        detail =
          data?.error?.message ||
          data?.error?.status ||
          "";
      } catch {
        // Ignore invalid error bodies.
      }

      throw new Error(
        detail ||
          `Embedding request failed with status ${response.status}.`,
      );
    }

    const data = await response.json();

    const values =
      data?.embedding?.values ||
      data?.embeddings?.[0]?.values;

    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        "The embedding service returned an invalid vector.",
      );
    }

    const embedding = values.map(Number);

    if (
      embedding.some(
        (value) => !Number.isFinite(value),
      )
    ) {
      throw new Error(
        "The embedding service returned invalid numeric values.",
      );
    }

    return embedding;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Embedding generation timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function embeddingDimensions() {
  return EMBEDDING_DIMENSIONS;
}