import {
  cleanText,
  json,
  originAllowed,
  rateLimit,
} from "../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aspectMap = {
  square: "1:1",
  landscape: "16:9",
  portrait: "9:16",
  wide: "21:9",
  standard: "4:3",
};

const allowedMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_IMAGES = 10;
const MAX_IMAGE_BASE64_LENGTH = 12_000_000;

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

function getImageModel() {
  return (
    process.env.GEMINI_IMAGE_MODEL ||
    "gemini-3.1-flash-image"
  );
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images
    .filter(
      (image) =>
        image &&
        typeof image.data === "string" &&
        typeof image.mimeType === "string"
    )
    .filter((image) =>
      allowedMimeTypes.includes(image.mimeType)
    )
    .slice(0, MAX_IMAGES)
    .map((image) => ({
      type: "image",
      mime_type: image.mimeType,
      data: image.data.slice(
        0,
        MAX_IMAGE_BASE64_LENGTH
      ),
    }));
}

/* -------------------------------------------------------
   Extract image from Gemini Interactions response
------------------------------------------------------- */

function extractGeneratedImage(data) {
  /*
   * Current Gemini Interactions API convenience output.
   */
  if (data?.output_image?.data) {
    return {
      data: data.output_image.data,
      mimeType:
        data.output_image.mime_type ||
        "image/png",
    };
  }

  /*
   * Fallback: inspect output blocks.
   */
  const output = Array.isArray(data?.output)
    ? data.output
    : [];

  for (const block of output) {
    if (
      block?.type === "image" &&
      block?.data
    ) {
      return {
        data: block.data,
        mimeType:
          block.mime_type || "image/png",
      };
    }

    if (block?.content) {
      const content = Array.isArray(block.content)
        ? block.content
        : [];

      for (const item of content) {
        if (
          item?.type === "image" &&
          item?.data
        ) {
          return {
            data: item.data,
            mimeType:
              item.mime_type || "image/png",
          };
        }
      }
    }
  }

  return null;
}

function extractGeneratedText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output)
    ? data.output
    : [];

  return output
    .flatMap((block) => {
      if (typeof block?.text === "string") {
        return [block.text];
      }

      if (Array.isArray(block?.content)) {
        return block.content
          .filter(
            (item) =>
              typeof item?.text === "string"
          )
          .map((item) => item.text);
      }

      return [];
    })
    .join("\n")
    .trim();
}

/* -------------------------------------------------------
   POST
------------------------------------------------------- */

export async function POST(request) {
  try {
    /* ---------------------------------------------
       Security
    --------------------------------------------- */

    if (!originAllowed(request)) {
      return json(
        { error: "Origin rejected." },
        { status: 403 }
      );
    }

    const limit = rateLimit(request, {
      limit: 8,
      windowMs: 60_000,
    });

    if (!limit.ok) {
      return json(
        {
          error:
            "Image generation limit reached. Please wait and try again.",
          retryAfter: limit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              limit.retryAfter || 30
            ),
          },
        }
      );
    }

    /* ---------------------------------------------
       API key
    --------------------------------------------- */

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return json(
        {
          error:
            "Image generation is not configured yet.",
        },
        { status: 503 }
      );
    }

    /* ---------------------------------------------
       Request body
    --------------------------------------------- */

    const body = await request.json();

    const prompt = cleanText(
      body.prompt || body.message || "",
      6000
    );

    if (!prompt) {
      return json(
        {
          error:
            "An image prompt is required.",
        },
        { status: 400 }
      );
    }

    const aspectRatio =
      aspectMap[body.aspect] || "1:1";

    const imageSize =
      ["1K", "2K", "4K"].includes(body.imageSize)
        ? body.imageSize
        : "1K";

    /*
     * Optional input images.
     *
     * If images are supplied, the same endpoint becomes
     * an image-editing / image-to-image workflow.
     */
    const inputImages = normalizeImages(
      body.images || body.attachments || []
    );

    /* ---------------------------------------------
       Build Interactions input
    --------------------------------------------- */

    const input = [
      ...inputImages,
      {
        type: "text",
        text:
          inputImages.length > 0
            ? [
                "Edit the provided image according to the user's request.",
                "Preserve the original subject identity, composition and important details unless the user explicitly asks to change them.",
                "Do not introduce unrelated people, objects, text or logos.",
                "",
                "USER REQUEST:",
                prompt,
              ].join("\n")
            : [
                "Create an image according to the user's request.",
                "Follow the requested subject, composition, lighting, style and aspect ratio.",
                "Do not add unrelated people, objects, logos or text unless requested.",
                "",
                "USER REQUEST:",
                prompt,
              ].join("\n"),
      },
    ];

    /* ---------------------------------------------
       Gemini Interactions API
    --------------------------------------------- */

    const model = getImageModel();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          input,
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: aspectRatio,
            image_size: imageSize,
          },
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const detail = (
        await response.text()
      ).slice(0, 800);

      console.error(
        "[ozlind/image/gemini]",
        response.status,
        detail
      );

      return json(
        {
          error:
            "Image generation failed. Please check the Gemini image model access and API configuration.",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    /* ---------------------------------------------
       Extract generated image
    --------------------------------------------- */

    const generatedImage =
      extractGeneratedImage(data);

    if (!generatedImage) {
      console.error(
        "[ozlind/image]",
        "Gemini returned no image",
        JSON.stringify(data).slice(0, 1200)
      );

      return json(
        {
          error:
            "Gemini completed the request but did not return an image.",
        },
        { status: 502 }
      );
    }

    const generatedText =
      extractGeneratedText(data);

    /* ---------------------------------------------
       Return image to OZLIND client
    --------------------------------------------- */

    return json({
      success: true,
      imageUrl:
        `data:${generatedImage.mimeType};base64,` +
        generatedImage.data,

      message: generatedText || "",

      model,
      aspectRatio,
      imageSize,

      /*
       * This tells the frontend whether this was
       * generation or editing.
       */
      mode:
        inputImages.length > 0
          ? "edit"
          : "generate",
    });
  } catch (error) {
    console.error(
      "[ozlind/image]",
      error
    );

    return json(
      {
        error:
          "Image generation could not be completed. Please try again.",
      },
      { status: 500 }
    );
  }
    }
