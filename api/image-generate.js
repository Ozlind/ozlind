"use strict";

/*
 * OZLIND AI PLATFORM
 * /api/image-generate.js
 *
 * Stable version for the current OZLIND chatbot.js
 */

const DEFAULT_MODEL = "flux";

const ALLOWED_MODELS = [
  "flux",
  "zimage",
  "gptimage",
  "gpt-image-2",
  "nanobanana-2"
];

function clean(value, max = 5000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function number(value, fallback, min, max) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, Math.round(n))
  );
}

function getSeed(value) {
  const n = Number(value);

  if (
    Number.isFinite(n) &&
    n >= 1 &&
    n <= 2147483647
  ) {
    return Math.round(n);
  }

  return Math.floor(
    Math.random() * 2147483646
  ) + 1;
}

/*
 * Keep the user's actual prompt intact.
 *
 * The instructions are short so they don't overpower
 * the creative request.
 */
function improvePrompt(prompt) {
  return [
    prompt,

    "Create exactly what was requested.",

    "Preserve the exact number of people and important objects.",

    "Preserve the requested identity, appearance, pose, clothing, objects, location, composition and relationships.",

    "Use accurate anatomy, natural hands and fingers, realistic proportions, coherent perspective and physically consistent lighting.",

    "Do not add unrelated people or objects.",

    "Do not add text, captions, logos, signatures or watermarks."
  ].join(" ");
}

function buildUrl({
  prompt,
  model,
  width,
  height,
  seed
}) {
  const base =
    "https://image.pollinations.ai/prompt/";

  const encoded =
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
   * Keep provider parameters compatible
   * with the endpoint that was already working.
   */
  params.set(
    "nologo",
    "true"
  );

  params.set(
    "enhance",
    "true"
  );

  return (
    `${base}${encoded}?${params.toString()}`
  );
}

module.exports = async function handler(req, res) {

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

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  try {
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : {};

    /*
     * IMPORTANT:
     * Current chatbot.js sends `prompt`.
     */
    const prompt = clean(
      body.prompt ||
      body.description ||
      body.text
    );

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error:
          "Please describe the image you want to create."
      });
    }

    /*
     * Use the requested model only if supported.
     */
    const requestedModel =
      clean(body.model, 50).toLowerCase();

    const model =
      ALLOWED_MODELS.includes(requestedModel)
        ? requestedModel
        : DEFAULT_MODEL;

    /*
     * Current chatbot.js normally sends 1024x1024.
     */
    const width =
      number(
        body.width,
        1024,
        512,
        1536
      );

    const height =
      number(
        body.height,
        1024,
        512,
        1536
      );

    const seed =
      getSeed(body.seed);

    const finalPrompt =
      improvePrompt(prompt);

    const imageUrl =
      buildUrl({
        prompt: finalPrompt,
        model,
        width,
        height,
        seed
      });

    /*
     * IMPORTANT:
     * chatbot.js expects `imageUrl`.
     */
    return res.status(200).json({
      ok: true,
      imageUrl,
      model,
      width,
      height,
      seed,
      provider: "OZLIND Image Engine"
    });

  } catch (error) {

    console.error(
      "OZLIND IMAGE ERROR:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        "OZLIND could not generate the image. Please try again."
    });
  }
};
