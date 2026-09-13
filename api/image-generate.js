// api/image-generate.js

"use strict";

const ALLOWED_MODELS = new Set([
  "flux",
  "zimage",
  "gptimage",
  "gpt-image-2",
  "nanobanana-2"
]);

const DEFAULT_MODEL = "zimage";

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
  "cropped subject",
  "unnatural proportions",
  "bad perspective",
  "text artifacts",
  "random letters",
  "signature",
  "watermark",
  "logo",
  "frame"
].join(", ");

function cleanText(value, max = 4000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clamp(value, min, max, fallback) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.round(n)));
}

function buildPrompt(userPrompt) {
  const prompt = cleanText(userPrompt);

  if (!prompt) {
    throw new Error("Please describe the image you want to create.");
  }

  return [
    prompt,
    "",
    "Create exactly what the user described.",
    "Preserve every explicit subject, object, person, quantity, relationship, pose, clothing detail, environment, camera angle, lighting condition, and composition requirement.",
    "Do not invent unrelated subjects or objects.",
    "Maintain accurate anatomy, realistic proportions, coherent perspective, natural lighting, detailed textures, sharp focus, and professional image quality.",
    "If the user specifies a style, follow that style precisely.",
    "If the user specifies a number of people or objects, preserve that exact number.",
    "Do not add text, captions, logos, signatures, frames, or watermarks unless explicitly requested."
  ].join(" ");
}

function buildUrl(prompt, options) {
  const base = "https://image.pollinations.ai/prompt/";

  const encodedPrompt = encodeURIComponent(prompt);

  const params = new URLSearchParams();

  params.set("width", String(options.width));
  params.set("height", String(options.height));
  params.set("model", options.model);
  params.set("seed", String(options.seed));

  // Ask the provider for higher prompt adherence.
  params.set("enhance", "true");

  // Ask the provider not to add branding.
  params.set("nologo", "true");

  // Quality control.
  params.set("negative_prompt", NEGATIVE_PROMPT);

  return `${base}${encodedPrompt}?${params.toString()}`;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = req.body || {};

    const userPrompt = cleanText(
      body.prompt ||
      body.description ||
      body.text ||
      ""
    );

    if (!userPrompt) {
      return res.status(400).json({
        error: "Please describe the image you want OZLIND to create."
      });
    }

    const requestedModel = cleanText(
      body.model || DEFAULT_MODEL,
      50
    ).toLowerCase();

    const model = ALLOWED_MODELS.has(requestedModel)
      ? requestedModel
      : DEFAULT_MODEL;

    const width = clamp(
      body.width,
      512,
      1536,
      1024
    );

    const height = clamp(
      body.height,
      512,
      1536,
      1024
    );

    const seed = clamp(
      body.seed,
      1,
      2147483647,
      Math.floor(Math.random() * 2147483647)
    );

    const finalPrompt = buildPrompt(userPrompt);

    const imageUrl = buildUrl(finalPrompt, {
      model,
      width,
      height,
      seed
    });

    return res.status(200).json({
      ok: true,
      imageUrl,
      provider: "OZLIND Image Engine",
      model,
      width,
      height,
      seed
    });

  } catch (error) {
    console.error("OZLIND IMAGE GENERATION ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "OZLIND could not generate the image. Please try again."
    });
  }
};
