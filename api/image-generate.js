// OZLIND Image Generation API — V1
// Provider: Pollinations (no API key required for this prototype)
//
// This endpoint validates the request server-side and returns a provider URL.
// Keep this provider behind this route so OZLIND can switch providers later
// without changing the frontend.

const ALLOWED_MODELS = new Set(["flux", "turbo"]);
const ALLOWED_SIZES = new Set([
  "512x512",
  "768x768",
  "1024x1024",
  "1024x768",
  "768x1024",
  "1536x1024",
  "1024x1536",
]);

function clampInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isAllowedSize(width, height) {
  return ALLOWED_SIZES.has(`${width}x${height}`);
}

function cleanPrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = cleanPrompt(body.prompt);

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (prompt.length > 1200) {
      return res.status(400).json({
        error: "Prompt is too long. Keep it under 1200 characters.",
      });
    }

    let width = clampInt(body.width, 1024);
    let height = clampInt(body.height, 1024);

    if (!isAllowedSize(width, height)) {
      width = 1024;
      height = 1024;
    }

    const model = ALLOWED_MODELS.has(String(body.model))
      ? String(body.model)
      : "flux";

    const seed = Math.floor(Math.random() * 1000000000);
    const encodedPrompt = encodeURIComponent(prompt);

    const imageUrl =
      `https://image.pollinations.ai/prompt/${encodedPrompt}` +
      `?width=${width}` +
      `&height=${height}` +
      `&model=${encodeURIComponent(model)}` +
      `&seed=${seed}` +
      `&nologo=true`;

    return res.status(200).json({
      success: true,
      imageUrl,
      prompt,
      width,
      height,
      model,
    });
  } catch (error) {
    console.error("OZLIND image generation error:", error);
    return res.status(500).json({
      error: "OZLIND could not prepare the image request.",
    });
  }
}
