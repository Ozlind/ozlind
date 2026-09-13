"use strict";

/*
 * OZLIND AI PLATFORM
 * Image Generation API
 *
 * Route:
 *   POST /api/image-generate
 *
 * Purpose:
 *   - Generate images directly inside OZLIND Chat
 *   - Preserve user intent as accurately as possible
 *   - Request clean output without logos/watermarks/text
 *   - Validate input safely
 *   - Avoid exposing secrets to the browser
 *
 * NOTE:
 *   The provider may still apply its own watermark/branding
 *   depending on its account/tier policy. nologo=true is requested,
 *   but the provider ultimately controls provider-side watermarking.
 */

const ALLOWED_MODELS = new Set([
  "flux",
  "zimage",
  "gptimage",
  "gpt-image-2",
  "nanobanana-2"
]);

const DEFAULT_MODEL = "zimage";

const MAX_PROMPT_LENGTH = 5000;
const MIN_DIMENSION = 512;
const MAX_DIMENSION = 1536;

/*
 * Strong negative prompt.
 *
 * This is deliberately conservative:
 * we want to prevent common generation failures without
 * over-constraining the actual user request.
 */
const NEGATIVE_PROMPT = [
  "blurry",
  "low quality",
  "low resolution",
  "pixelated",
  "out of focus",
  "motion blur",
  "jpeg artifacts",

  "bad anatomy",
  "poor anatomy",
  "deformed body",
  "disfigured",
  "unnatural proportions",
  "malformed body",

  "bad hands",
  "deformed hands",
  "mutated hands",
  "extra fingers",
  "missing fingers",
  "fused fingers",
  "extra limbs",
  "missing limbs",

  "duplicate person",
  "duplicate subject",
  "extra person",
  "extra people",
  "missing person",
  "cloned face",

  "distorted face",
  "deformed face",
  "asymmetrical eyes",
  "cross-eyed",
  "misaligned eyes",
  "unnatural teeth",

  "bad perspective",
  "warped objects",
  "floating objects",
  "impossible geometry",

  "random text",
  "text artifacts",
  "random letters",
  "unwanted caption",
  "unwanted typography",

  "logo",
  "brand logo",
  "signature",
  "watermark",
  "stamp",
  "border",
  "frame"
].join(", ");


/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */

function cleanText(value, maxLength = MAX_PROMPT_LENGTH) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
}


function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, Math.round(number))
  );
}


function getModel(value) {
  const requested = cleanText(value, 80).toLowerCase();

  if (ALLOWED_MODELS.has(requested)) {
    return requested;
  }

  return DEFAULT_MODEL;
}


function createSeed(value) {
  const supplied = Number(value);

  if (
    Number.isFinite(supplied) &&
    supplied >= 1 &&
    supplied <= 2147483647
  ) {
    return Math.round(supplied);
  }

  return Math.floor(
    Math.random() * 2147483646
  ) + 1;
}


/* ---------------------------------------------------------
 * Prompt Engineering
 * --------------------------------------------------------- */

function buildPrompt(userPrompt) {
  const prompt = cleanText(userPrompt);

  if (!prompt) {
    throw new Error(
      "Please describe the image you want OZLIND to create."
    );
  }

  /*
   * The user's original request stays first.
   *
   * This is important because the model should prioritize
   * the actual creative instruction rather than our helper text.
   */

  const instruction = [
    "Create the image exactly according to the user's description.",
    "Treat the user's requested subjects, objects, people, quantities, relationships, poses, clothing, colors, environment, camera angle, perspective, lighting, mood, style, and composition as mandatory requirements.",
    "Preserve the exact number of people and important objects requested.",
    "Do not replace, remove, duplicate, or invent important subjects.",
    "Keep faces, body proportions, hands, fingers, clothing, objects, and spatial relationships anatomically and physically coherent.",
    "Follow explicit positioning instructions such as left, right, center, foreground, background, beside, behind, sitting, standing, looking at, or holding.",
    "If the user specifies an artistic or photographic style, follow that style while preserving the requested content.",
    "Use natural perspective, realistic lighting, coherent shadows, accurate depth, detailed textures, and sharp subject separation.",
    "Do not add unrelated people, objects, decorations, text, captions, logos, signatures, watermarks, borders, or frames.",
    "Produce a clean professional image."
  ].join(" ");

  return `${prompt}\n\n${instruction}`;
}


/* ---------------------------------------------------------
 * Provider URL
 * --------------------------------------------------------- */

function createImageUrl({
  prompt,
  model,
  width,
  height,
  seed
}) {
  /*
   * Legacy Pollinations image endpoint is kept here for
   * compatibility with the current OZLIND setup.
   *
   * If the provider is changed later, only this function
   * needs to be replaced; the OZLIND frontend route can stay
   * /api/image-generate.
   */

  const baseUrl =
    "https://image.pollinations.ai/prompt/";

  const encodedPrompt =
    encodeURIComponent(prompt);

  const params =
    new URLSearchParams();

  params.set(
    "width",
    String(width)
  );

  params.set(
    "height",
    String(height)
  );

  params.set(
    "model",
    model
  );

  params.set(
    "seed",
    String(seed)
  );

  /*
   * Prompt enhancement.
   */
  params.set(
    "enhance",
    "true"
  );

  /*
   * Request no provider logo.
   *
   * Important:
   * this is a provider request, not a guarantee.
   */
  params.set(
    "nologo",
    "true"
  );

  /*
   * Negative prompt for visual quality control.
   */
  params.set(
    "negative_prompt",
    NEGATIVE_PROMPT
  );

  return (
    `${baseUrl}${encodedPrompt}?${params.toString()}`
  );
}


/* ---------------------------------------------------------
 * Request validation
 * --------------------------------------------------------- */

function parseRequest(body) {
  const data =
    body && typeof body === "object"
      ? body
      : {};

  const prompt = cleanText(
    data.prompt ||
    data.description ||
    data.text ||
    ""
  );

  if (!prompt) {
    throw new Error(
      "Please describe the image you want OZLIND to create."
    );
  }

  if (prompt.length < 2) {
    throw new Error(
      "Please provide a more detailed image description."
    );
  }

  const model =
    getModel(data.model);

  /*
   * Default square output.
   *
   * The frontend can request another valid size.
   */
  const width =
    clampNumber(
      data.width,
      MIN_DIMENSION,
      MAX_DIMENSION,
      1024
    );

  const height =
    clampNumber(
      data.height,
      MIN_DIMENSION,
      MAX_DIMENSION,
      1024
    );

  const seed =
    createSeed(data.seed);

  return {
    prompt,
    model,
    width,
    height,
    seed
  };
}


/* ---------------------------------------------------------
 * Handler
 * --------------------------------------------------------- */

module.exports = async function handler(req, res) {
  /*
   * Basic CORS support.
   */
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  /*
   * Prevent caching of generation responses.
   */
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  /*
   * Preflight.
   */
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /*
   * Only POST is supported.
   */
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  try {
    /*
     * Parse and validate everything before constructing
     * the provider URL.
     */
    const request =
      parseRequest(req.body);

    const finalPrompt =
      buildPrompt(request.prompt);

    const imageUrl =
      createImageUrl({
        prompt: finalPrompt,
        model: request.model,
        width: request.width,
        height: request.height,
        seed: request.seed
      });

    /*
     * Keep the response compatible with the current
     * OZLIND chatbot.js implementation.
     */
    return res.status(200).json({
      ok: true,

      imageUrl,

      provider:
        "OZLIND Image Engine",

      model:
        request.model,

      width:
        request.width,

      height:
        request.height,

      seed:
        request.seed
    });

  } catch (error) {
    console.error(
      "OZLIND IMAGE GENERATION ERROR:",
      error
    );

    return res.status(400).json({
      ok: false,

      error:
        error?.message ||
        "OZLIND could not generate the image. Please try again."
    });
  }
};
