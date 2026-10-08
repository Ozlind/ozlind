const DEFAULT_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;
const MAX_TEXT_LENGTH = 30000;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_BATCH_ITEMS = 32;

function normalizeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function getModel() {
  return (
    process.env.EMBEDDING_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function isGeminiEmbedding2(model) {
  return model === "gemini-embedding-2";
}

function prepareInput(
  text,
  {
    taskType = null,
    title = null,
  } = {},
) {
  const input = normalizeText(text);

  if (!input) {
    throw new Error(
      "Cannot create an embedding from empty text.",
    );
  }

  if (isGeminiEmbedding2(getModel())) {
    if (taskType === "RETRIEVAL_QUERY") {
      return `task: search result | query: ${input}`;
    }

    if (taskType === "RETRIEVAL_DOCUMENT") {
      const safeTitle =
        normalizeText(title || "none").slice(
          0,
          500,
        ) || "none";

      return `title: ${safeTitle} | text: ${input}`;
    }
  }

  return input;
}

function createAbortController() {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  return {
    controller,
    timeout,
  };
}

function validateEmbedding(values) {
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
}

async function parseEmbeddingError(response) {
  try {
    const data = await response.json();

    return (
      data?.error?.message ||
      data?.error?.status ||
      ""
    );
  } catch {
    return "";
  }
}

async function requestEmbedding(
  text,
  {
    taskType = null,
    title = null,
  } = {},
) {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini embedding service is not configured.",
    );
  }

  const model = getModel();

  const prepared = prepareInput(
    text,
    {
      taskType,
      title,
    },
  );

  const {
    controller,
    timeout,
  } = createAbortController();

  const body = {
    model: `models/${model}`,
    content: {
      parts: [
        {
          text: prepared,
        },
      ],
    },
    output_dimensionality:
      EMBEDDING_DIMENSIONS,
  };

  /*
   * Older Gemini embedding models may support
   * task_type directly. Gemini Embedding 2 uses
   * the retrieval instruction in the input text
   * instead.
   */
  if (
    !isGeminiEmbedding2(model) &&
    taskType
  ) {
    body.task_type = taskType;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail =
        await parseEmbeddingError(
          response,
        );

      throw new Error(
        detail ||
          `Embedding request failed with status ${response.status}.`,
      );
    }

    const data =
      await response.json();

    return validateEmbedding(
      data?.embedding?.values ||
        data?.embeddings?.[0]?.values,
    );
  } catch (error) {
    if (
      error?.name === "AbortError"
    ) {
      throw new Error(
        "Embedding generation timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createEmbedding(
  text,
  options = {},
) {
  return requestEmbedding(
    text,
    options,
  );
}

export async function createEmbeddings(
  texts,
  {
    taskType = null,
    titles = [],
  } = {},
) {
  if (
    !Array.isArray(texts) ||
    !texts.length
  ) {
    return [];
  }

  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini embedding service is not configured.",
    );
  }

  const model = getModel();

  if (texts.length === 1) {
    return [
      await requestEmbedding(
        texts[0],
        {
          taskType,
          title: titles[0],
        },
      ),
    ];
  }

  const allEmbeddings = [];

  for (
    let offset = 0;
    offset < texts.length;
    offset += MAX_BATCH_ITEMS
  ) {
    const batchTexts =
      texts.slice(
        offset,
        offset + MAX_BATCH_ITEMS,
      );

    const requests =
      batchTexts.map(
        (text, index) => {
          const prepared =
            prepareInput(
              text,
              {
                taskType,
                title:
                  titles[
                    offset + index
                  ],
              },
            );

          const request = {
            model:
              `models/${model}`,
            content: {
              parts: [
                {
                  text: prepared,
                },
              ],
            },
            output_dimensionality:
              EMBEDDING_DIMENSIONS,
          };

          if (
            !isGeminiEmbedding2(
              model,
            ) &&
            taskType
          ) {
            request.task_type =
              taskType;
          }

          return request;
        },
      );

    const {
      controller,
      timeout,
    } = createAbortController();

    try {
      const response =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model,
          )}:batchEmbedContents`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "x-goog-api-key":
                apiKey,
            },
            body: JSON.stringify({
              requests,
            }),
            signal:
              controller.signal,
            cache: "no-store",
          },
        );

      if (!response.ok) {
        const detail =
          await parseEmbeddingError(
            response,
          );

        throw new Error(
          detail ||
            `Batch embedding request failed with status ${response.status}.`,
        );
      }

      const data =
        await response.json();

      const embeddings =
        Array.isArray(
          data?.embeddings,
        )
          ? data.embeddings.map(
              (item) =>
                validateEmbedding(
                  item?.values,
                ),
            )
          : [];

      if (
        embeddings.length !==
        batchTexts.length
      ) {
        throw new Error(
          "The embedding service returned an incomplete batch.",
        );
      }

      allEmbeddings.push(
        ...embeddings,
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        throw new Error(
          "Batch embedding generation timed out.",
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return allEmbeddings;
}

export function embeddingDimensions() {
  return EMBEDDING_DIMENSIONS;
}