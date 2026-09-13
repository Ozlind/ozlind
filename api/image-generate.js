// OZLIND AI — In-chat image generation endpoint V2.1
// Provider: Pollinations
//
// V2.1 goals:
// - Preserve the existing working OZLIND image-generation contract
// - Follow the user's prompt more literally
// - Do NOT use automatic prompt enhancement
// - Do NOT rely on negative_prompt for Flux
// - Request provider safety filtering
// - Request no provider logo where supported
// - Support the existing image sizes
// - Support Flux / Turbo
// - Support deterministic or random regeneration through seed
//
// IMPORTANT:
// This version keeps the existing image.pollinations.ai route
// intentionally, so the current chatbot integration does not
// need to be changed.
//
// Provider-side watermark behavior cannot be guaranteed by code.
// nologo=true is only a provider request.

"use strict";


// ============================================================
// MODELS
// ============================================================

const ALLOWED_MODELS = new Set([
  "flux",
  "turbo"
]);

const DEFAULT_MODEL = "flux";


// ============================================================
// ALLOWED IMAGE SIZES
// ============================================================

const ALLOWED_SIZES = new Set([
  "512x512",
  "768x768",
  "1024x1024",
  "1024x768",
  "768x1024",
  "1536x1024",
  "1024x1536"
]);


// ============================================================
// PROMPT CLEANING
// ============================================================

function cleanPrompt(value, max = 1200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}


// ============================================================
// INTEGER PARSER
// ============================================================

function int(value, fallback) {
  const n = Number.parseInt(value, 10);

  return Number.isFinite(n)
    ? n
    : fallback;
}


// ============================================================
// SIZE VALIDATION
// ============================================================

function validSize(width, height) {
  return ALLOWED_SIZES.has(
    `${width}x${height}`
  );
}


// ============================================================
// MODEL VALIDATION
// ============================================================

function normalizeModel(value) {
  const requested = String(
    value || DEFAULT_MODEL
  )
    .trim()
    .toLowerCase();

  return ALLOWED_MODELS.has(requested)
    ? requested
    : DEFAULT_MODEL;
}


// ============================================================
// PROMPT BUILDER
// ============================================================
//
// IMPORTANT:
// We deliberately DO NOT use Pollinations "enhance=true".
//
// The user's original prompt stays the main instruction.
// We only add a small amount of quality/fidelity guidance.
//
// This prevents simple prompts such as:
// "a cat"
// from being unnecessarily rewritten into something else.
//

function buildPrompt(userPrompt) {

  const prompt = cleanPrompt(userPrompt);

  if (!prompt) {
    throw new Error(
      "Describe the image you want OZLIND to create."
    );
  }

  return [
    prompt,

    "Follow the user's description literally and accurately.",

    "Preserve all explicitly requested subjects, objects, people, quantities, poses, clothing, environment, composition, and style.",

    "Do not add unrelated people, animals, objects, characters, or events.",

    "If the user specifies an exact number of subjects, preserve that exact number.",

    "Maintain natural anatomy, realistic proportions, coherent perspective, and consistent lighting.",

    "Keep the requested subject clearly recognizable and visually dominant.",

    "Use detailed textures, natural lighting, clean focus, realistic depth, and high visual quality.",

    "Do not add captions, text, signatures, logos, borders, or frames unless explicitly requested."
  ].join(" ");
}


// ============================================================
// IMAGE URL BUILDER
// ============================================================

function buildUrl(prompt, options) {

  const base =
    "https://image.pollinations.ai/prompt/";

  const encodedPrompt =
    encodeURIComponent(prompt);

  const params = new URLSearchParams();


  // Image dimensions
  params.set(
    "width",
    String(options.width)
  );

  params.set(
    "height",
    String(options.height)
  );


  // Model
  params.set(
    "model",
    options.model
  );


  // Seed
  params.set(
    "seed",
    String(options.seed)
  );


  // Ask provider not to add its logo where supported.
  params.set(
    "nologo",
    "true"
  );


  // Request provider-side safety filtering.
  params.set(
    "safe",
    "true"
  );


  // Keep generated result private where supported.
  params.set(
    "private",
    "true"
  );


  return (
    `${base}${encodedPrompt}?` +
    params.toString()
  );
}


// ============================================================
// MAIN HANDLER
// ============================================================

module.exports = async function handler(
  req,
  res
) {


  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // CACHE CONTROL
  // ----------------------------------------------------------

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  // ----------------------------------------------------------
  // OPTIONS / PREFLIGHT
  // ----------------------------------------------------------

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  // ----------------------------------------------------------
  // METHOD CHECK
  // ----------------------------------------------------------

  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      error: "Method not allowed."
    });
  }


  try {


    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};


    // --------------------------------------------------------
    // PROMPT
    // --------------------------------------------------------

    const prompt = cleanPrompt(
      body.prompt ||
      body.description ||
      body.text ||
      ""
    );


    // --------------------------------------------------------
    // EMPTY PROMPT
    // --------------------------------------------------------

    if (!prompt) {

      return res.status(400).json({
        error:
          "Describe the image you want OZLIND to create."
      });
    }


    // --------------------------------------------------------
    // PROMPT LENGTH
    // --------------------------------------------------------

    if (prompt.length > 1200) {

      return res.status(400).json({
        error:
          "Image prompt is too long. Keep it under 1200 characters."
      });
    }


    // --------------------------------------------------------
    // IMAGE SIZE
    // --------------------------------------------------------

    let width = int(
      body.width,
      1024
    );

    let height = int(
      body.height,
      1024
    );


    // Only allow known supported dimensions.
    if (!validSize(width, height)) {

      width = 1024;
      height = 1024;
    }


    // --------------------------------------------------------
    // MODEL
    // --------------------------------------------------------

    const model =
      normalizeModel(body.model);


    // --------------------------------------------------------
    // SEED
    // --------------------------------------------------------
    //
    // A valid supplied seed allows the frontend to request
    // a repeatable result.
    //
    // If no valid seed is supplied, create a fresh variation.
    //

    let seed = int(
      body.seed,
      0
    );


    if (
      seed < 1 ||
      seed > 2147483647
    ) {

      seed = Math.floor(
        Math.random() * 2147483647
      );
    }


    // --------------------------------------------------------
    // BUILD PROMPT
    // --------------------------------------------------------

    const finalPrompt =
      buildPrompt(prompt);


    // --------------------------------------------------------
    // BUILD IMAGE URL
    // --------------------------------------------------------

    const imageUrl =
      buildUrl(
        finalPrompt,
        {
          model,
          width,
          height,
          seed
        }
      );


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({

      success: true,

      imageUrl,

      // Original user prompt.
      prompt,

      width,

      height,

      model,

      seed,

      provider:
        "Pollinations"

    });


  } catch (error) {


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    console.error(
      "OZLIND image generation error:",
      error
    );


    return res.status(500).json({

      error:
        error?.message ||
        "OZLIND could not create the image right now. Please try again."

    });
  }
};
