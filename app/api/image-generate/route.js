import { cleanText, json, originAllowed, rateLimit } from '../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const aspectMap = {
  square: '1:1', landscape: '16:9', portrait: '9:16', wide: '16:9'
};

export async function POST(request) {
  try {
    if (!originAllowed(request)) return json({ error: 'Origin rejected' }, { status: 403 });
    const limit = rateLimit(request, { limit: 8, windowMs: 60_000 });
    if (!limit.ok) return json({ error: 'Image generation limit reached. Please wait.' }, { status: 429 });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return json({ error: 'Gemini image generation is not configured.' }, { status: 503 });
    const body = await request.json();
    const prompt = cleanText(body.prompt, 4000);
    if (!prompt) return json({ error: 'Image prompt is required.' }, { status: 400 });
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const aspectRatio = aspectMap[body.aspect] || '1:1';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Create an image exactly matching this request. Do not add unrelated people, nudity, logos, text or objects unless requested. Preserve the requested composition, subject and style.\n\n${prompt}` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } }
      }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      throw new Error(`Gemini image API returned ${response.status}: ${detail}`);
    }
    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) throw new Error('Gemini did not return image data. Image generation may require billing or model access.');
    const mime = part.inlineData.mimeType || 'image/png';
    return json({ success: true, imageUrl: `data:${mime};base64,${part.inlineData.data}`, model, provider: 'Gemini', aspectRatio });
  } catch (error) {
    console.error('[ozlind/image]', error);
    return json({ error: 'Image generation failed. Check Gemini image-model access/billing and try again.' }, { status: 502 });
  }
}
