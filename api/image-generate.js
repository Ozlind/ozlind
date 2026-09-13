// OZLIND AI — In-chat image generation endpoint V2
// Provider: Pollinations
//
// V2 keeps the existing working POST contract and
// image.pollinations.ai generation flow.
//
// Improvements:
// - Smarter prompt enhancement
// - Better subject/detail preservation
// - Negative prompt
// - Safer model validation
// - Safer size validation
// - Optional seed support for variations
// - Cache protection
// - Better response metadata
//
// IMPORTANT:
// nologo=true is only a request to the provider.
// Provider-side watermark behavior depends on
// the provider/account/tier.

"use strict";


// ============================================================
// CONFIG
// ============================================================

const ALLOWED_MODELS = new Set([
  "flux",
  "turbo"
]);

const DEFAULT_MODEL = "flux";

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
// NEGATIVE PROMPT
// ============================================================

const NEGATIVE_PROMPT = [
  "blurry",
  "low quality",
  "low resolution",
  "out of focus",
  "bad anatomy",
  "deformed",
  "disfigured",
  "extra fingers",
  "missing fingers",
  "extra limbs",
  "mutated hands",
  "duplicate subject",
  "duplicate people",
  "distorted face",
  "asymmetrical eyes",
  "unnatural proportions",
  "bad perspective",
  "cropped subject",
  "cut off subject",
  "text artifacts",
  "random letters",
  "unwanted text",
  "signature",
  "watermark",
  "logo",
  "border",
  "frame"
].join(", ");


// ============================================================
// TEXT CLEANING
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

  if (ALLOWED_MODELS.has(requested)) {
    return requested;
  }

  return DEFAULT_MODEL;
}


// ============================================================
// SMART PROMPT BUILDER
// ============================================================
//
// Important:
// We do NOT replace the user's idea.
// We add quality instructions around it.
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

    "Create exactly what the user described.",

    "Preserve every explicit subject, object, person, quantity, relationship, pose, clothing detail, environment, composition, and visual style.",

    "Do not invent unrelated subjects, objects, people, or events.",

    "If the user specifies an exact number of people or objects, preserve that exact number.",

    "Keep subjects anatomically natural with realistic proportions.",

    "Maintain coherent perspective, depth, lighting, shadows, textures, and spatial relationships.",

    "Keep important facial features, hands, eyes, body proportions, clothing, and object shapes natural and consistent.",

    "If a specific style, camera angle, lighting condition, environment, or composition is requested, follow it closely.",

    "Use detailed textures and sharp focus appropriate to the requested scene.",

    "Do not add captions, text, signatures, logos, borders, frames, or watermarks unless the user explicitly requests them."
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

  params.set(
    "width",
    String(options.width)
  );

  params.set(
    "height",
    String(options.height)
  );

  params.set(
    "model",
    options.model
  );

  params.set(
    "seed",
    String(options.seed)
  );

  // Provider-side prompt enhancement.
  params.set(
    "enhance",
    "true"
  );

  // Request no provider logo where supported.
  params.set(
    "nologo",
    "true"
  );

  // Visual quality controls.
  params.set(
    "negative_prompt",
    NEGATIVE_PROMPT
  );

  return (
    `${base}${encodedPrompt}?` +
    params.toString()
  );
}


// ============================================================
// MAIN API HANDLER
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
  //
  // Generated image requests should not be cached by
  // intermediate systems.
  //

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  // ----------------------------------------------------------
  // PREFLIGHT
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


  // ----------------------------------------------------------
  // REQUEST PROCESSING
  // ----------------------------------------------------------

  try {

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
    // SIZE
    // --------------------------------------------------------

    let width = int(
      body.width,
      1024
    );

    let height = int(
      body.height,
      1024
    );


    // Only permit known safe/provider-supported sizes.
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
    // If the frontend supplies a valid seed,
    // preserve it.
    //
    // Otherwise create a fresh random variation.
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
    // BUILD FINAL PROMPT
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
    // SUCCESS RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({

      success: true,

      imageUrl,

      // Keep original user prompt for the frontend/history.
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
    // SERVER ERROR
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
