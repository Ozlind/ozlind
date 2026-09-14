"use strict";

const { setApiHeaders, applyCors, rejectUnexpectedOrigin } = require("./_security");

const ALLOWED_SIZES = new Set(["512x512", "768x768", "1024x1024", "1024x768", "768x1024", "1536x1024", "1024x1536"]);

function cleanPrompt(value) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, 4000); }
function sizeFor(width, height) {
  const pair = `${Number(width) || 1024}x${Number(height) || 1024}`;
  return ALLOWED_SIZES.has(pair) ? pair : "1024x1024";
}

module.exports = async function handler(req, res) {
  setApiHeaders(res);
  applyCors(req, res);
  if (rejectUnexpectedOrigin(req, res)) return;
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }

  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key) return res.status(503).json({ error: "Gemini image generation is not configured." });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = cleanPrompt(body.prompt);
    if (!prompt) return res.status(400).json({ error: "Describe the image you want OZLIND to create." });
    if (String(body.prompt || "").length > 4000) return res.status(400).json({ error: "Image prompt is too long. Keep it under 4000 characters." });

    const model = String(process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").trim();
    const imageSize = sizeFor(body.width, body.height).split("x")[0] === "512" ? "1K" : "1K";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const payload = {
      contents: [{ parts: [{ text: `Create an image exactly matching this user request. Do not add unrelated subjects or objects. User request: ${prompt}` }] }],
      generationConfig: { responseFormat: { image: { aspectRatio: "1:1", imageSize } } }
    };
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data?.error?.message || "Gemini image generation failed.").slice(0, 220);
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({ error: detail });
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p?.inlineData?.data);
    if (!imagePart) return res.status(502).json({ error: "Gemini returned no image. Check GEMINI_IMAGE_MODEL and API access." });
    const mime = imagePart.inlineData.mimeType || "image/png";
    const imageUrl = `data:${mime};base64,${imagePart.inlineData.data}`;
    return res.status(200).json({ success: true, imageUrl, prompt, width: 1024, height: 1024, model, provider: "Gemini" });
  } catch (error) {
    console.error("OZLIND Gemini image generation error:", error);
    return res.status(500).json({ error: "OZLIND could not create the image right now. Please try again." });
  }
};
