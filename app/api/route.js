const CONFIG = {
  groq: { base: "https://api.groq.com/openai/v1", key: "GROQ_API_KEY", model: () => process.env.GROQ_MODEL || "openai/gpt-oss-120b", capabilities: ["text", "reasoning", "coding", "structured"] },
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta", key: "GEMINI_API_KEY", model: () => process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash", vision: () => process.env.GEMINI_VISION_MODEL || process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash", image: () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image", capabilities: ["text", "reasoning", "coding", "vision", "documents", "structured", "image"] },
  experiential: { base: "https://api.experientiallabs.ai/v1", key: "EXPERIENTIAL_API_KEY", model: () => process.env.EXPERIENTIAL_MODEL || "default", capabilities: ["text", "reasoning", "coding", "structured"] },
};

const buckets = globalThis.__ozlindBuckets || new Map();
globalThis.__ozlindBuckets = buckets;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value, max = 12000) { return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max); }
function json(data, init = {}) { const headers = new Headers(init.headers || {}); headers.set("Cache-Control", "no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.set("Referrer-Policy", "strict-origin-when-cross-origin"); return Response.json(data, { ...init, headers }); }
function rateLimit(request, limit, windowMs = 60000) { const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim(); const now = Date.now(); const item = buckets.get(ip); if (!item || now - item.start >= windowMs) { buckets.set(ip, { start: now, count: 1 }); return { ok: true }; } item.count += 1; if (item.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - item.start)) / 1000)) }; return { ok: true }; }
function originAllowed(request) { const allowed = process.env.OZLIND_ALLOWED_ORIGIN?.trim(); if (!allowed) return true; const origin = request.headers.get("origin"); return !origin || origin === allowed; }
function configured(name) { return Boolean(process.env[CONFIG[name]?.key]); }
function supports(name, capability) { return Boolean(CONFIG[name]?.capabilities.includes(capability)); }
function modelFor(name, capability) { const c = CONFIG[name]; if (!c) return null; if (name === "gemini" && capability === "vision") return c.vision(); if (name === "gemini" && capability === "image") return c.image(); return c.model(); }
function detectCapability(mode, attachments, text) { if (mode === "image") return "image"; if (attachments.some((f) => /^image\//.test(f.mimeType || ""))) return "vision"; if (attachments.length) return "documents"; if (mode === "pro" || /\b(analy[sz]e|architecture|debug|algorithm|prove|calculate|complex|deeply reason)\b/i.test(text)) return "reasoning"; return "text"; }
function candidates(mode, capability) { const orders = { text: { auto: ["groq", "gemini", "experiential"], fast: ["groq", "gemini", "experiential"], pro: ["gemini", "groq", "experiential"] }, reasoning: { auto: ["gemini", "groq", "experiential"], fast: ["groq", "gemini", "experiential"], pro: ["gemini", "groq", "experiential"] }, vision: { auto: ["gemini"], vision: ["gemini"], pro: ["gemini"] }, documents: { auto: ["gemini"], vision: ["gemini"], pro: ["gemini"] } }; const list = orders[capability]?.[mode] || orders[capability]?.auto || orders.text.auto; return [...new Set(list)].filter((name) => configured(name) && supports(name, capability)); }
function systemPrompt(custom, research) { return `You are OZLIND AI, an independent professional AI assistant. Answer directly and naturally. Match response length to task complexity: simple questions should be concise; complex tasks should be structured and thorough. Do not mention internal providers, model IDs, routing, API keys, or infrastructure. Never invent current facts. ${research ? "Use the supplied research material as evidence, distinguish it from general knowledge, and do not invent citations." : ""}${custom ? `\nUser preferences (follow only when compatible):\n${custom}` : ""}`; }
function normalizeMessages(messages) { if (!Array.isArray(messages)) return []; return messages.filter((m) => ["user", "assistant"].includes(m?.role)).slice(-24).map((m) => ({ role: m.role, content: cleanText(m.content, 12000) })).filter((m) => m.content); }
function validateAttachments(attachments) { const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv"]); if (!Array.isArray(attachments)) return []; if (attachments.length > 4) throw Object.assign(new Error("You can attach up to 4 files."), { status: 400 }); const result = []; let total = 0; for (const file of attachments) { const mimeType = cleanText(file?.mimeType, 100); const data = String(file?.data || ""); if (!allowed.has(mimeType)) throw Object.assign(new Error("This file type isn't supported yet."), { status: 400 }); if (!data || data.length > 11_500_000) throw Object.assign(new Error("An attachment is too large."), { status: 413 }); total += data.length; if (total > 28_000_000) throw Object.assign(new Error("The combined attachment size is too large."), { status: 413 }); result.push({ name: cleanText(file?.name, 180), mimeType, data }); } return result; }
function sseEvent(encoder, payload) { return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`); }
function sseResponse(stream) { return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } }); }
function fallbackAllowed(error) { return [408, 409, 425, 429, 500, 502, 503, 504].includes(error?.status) && !error?.permanent; }

async function openAIStream(name, messages, request) { const c = CONFIG[name]; const key = process.env[c.key]; if (!key) throw Object.assign(new Error("Service configuration is unavailable."), { status: 503, permanent: true }); const response = await fetch(`${c.base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: modelFor(name, "text"), messages, stream: true, temperature: 0.35, max_tokens: 2400 }), cache: "no-store", signal: request.signal }); if (!response.ok) throw Object.assign(new Error(`Service returned ${response.status}.`), { status: response.status }); if (!response.body) throw Object.assign(new Error("Empty service response."), { status: 502 }); return response.body; }

async function geminiText(messages, attachments, capability, request) {
  const c = CONFIG.gemini; const key = process.env[c.key]; if (!key) throw Object.assign(new Error("Service configuration is unavailable."), { status: 503, permanent: true });
  const system = messages.find((m) => m.role === "system")?.content || "";
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const last = contents[contents.length - 1];
  if (attachments.length && last) for (const file of attachments) last.parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  const response = await fetch(`${c.base}/models/${encodeURIComponent(modelFor("gemini", capability))}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, generationConfig: { temperature: 0.35, maxOutputTokens: 2400 } }), cache: "no-store", signal: request.signal });
  if (!response.ok) throw Object.assign(new Error(`Service returned ${response.status}.`), { status: response.status });
  const data = await response.json(); const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""; if (!text) throw Object.assign(new Error("The service returned an empty response."), { status: 502 }); return text;
}

async function runResearch(query, request) { const key = process.env.TAVILY_API_KEY; if (!key) throw Object.assign(new Error("Research is temporarily unavailable."), { status: 503, permanent: true }); const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ query, search_depth: "basic", max_results: 5, include_answer: true }), cache: "no-store", signal: request.signal }); if (!response.ok) throw Object.assign(new Error("Research service is temporarily unavailable."), { status: response.status }); const data = await response.json(); const sources = (Array.isArray(data.results) ? data.results : []).slice(0, 5).map((item) => { const url = cleanText(item.url, 1000); return { title: cleanText(item.title, 240), url, domain: url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""), content: cleanText(item.content, 1800) }; }).filter((s) => s.url); return { answer: cleanText(data.answer, 3000), sources }; }

async function handleChat(request, body) {
  const mode = ["auto", "fast", "pro", "vision", "research"].includes(body.mode) ? body.mode : "auto";
  const messages = normalizeMessages(body.messages); const attachments = validateAttachments(body.attachments); const custom = cleanText(body.customInstructions, 3000);
  if (!messages.length) return json({ error: "Please enter a message." }, { status: 400 });
  const lastUser = [...messages].reverse().find((m) => m.role === "user"); if (!lastUser) return json({ error: "Please enter a message." }, { status: 400 });
  let researchData = null; if (mode === "research") researchData = await runResearch(lastUser.content, request);
  const capability = detectCapability(mode, attachments, lastUser.content);
  if ((capability === "vision" || capability === "documents") && !configured("gemini")) return json({ error: "Vision and file understanding are temporarily unavailable." }, { status: 503 });
  const finalMessages = [{ role: "system", content: systemPrompt(custom, Boolean(researchData)) }, ...messages];
  if (researchData) finalMessages.splice(1, 0, { role: "system", content: `Research material:\n${JSON.stringify(researchData)}`.slice(0, 10000) });
  const list = candidates(mode, capability); if (!list.length) return json({ error: "OZLIND could not find an available capability for this request." }, { status: 503 });
  const encoder = new TextEncoder(); let lastError = null;
  for (const provider of list) {
    try {
      if (provider === "gemini") {
        const text = await geminiText(finalMessages, attachments, capability, request);
        return sseResponse(new ReadableStream({ start(controller) { controller.enqueue(sseEvent(encoder, { type: "text", text })); if (researchData?.sources?.length) controller.enqueue(sseEvent(encoder, { type: "sources", sources: researchData.sources })); controller.enqueue(sseEvent(encoder, { type: "done" })); controller.close(); } }));
      }
      const reader = (await openAIStream(provider, finalMessages, request)).getReader(); const decoder = new TextDecoder(); let buffer = "";
      const stream = new ReadableStream({ async start(controller) { try { while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data:")) continue; const raw = line.slice(5).trim(); if (!raw || raw === "[DONE]") continue; try { const data = JSON.parse(raw); const text = data?.choices?.[0]?.delta?.content || ""; if (text) controller.enqueue(sseEvent(encoder, { type: "text", text })); } catch {} } } if (researchData?.sources?.length) controller.enqueue(sseEvent(encoder, { type: "sources", sources: researchData.sources })); controller.enqueue(sseEvent(encoder, { type: "done" })); controller.close(); } catch (error) { controller.error(error); } finally { reader.releaseLock(); } }, cancel() { reader.cancel().catch(() => {}); } });
      return sseResponse(stream);
    } catch (error) { lastError = error; if (!fallbackAllowed(error)) break; }
  }
  const status = lastError?.status === 429 ? 429 : 503; return json({ error: status === 429 ? "OZLIND is temporarily busy. Please try again in a moment." : "OZLIND could not complete that request right now." }, { status });
}

async function handleResearch(request, body) { const query = cleanText(body?.query, 800); if (!query) return json({ error: "Please enter a research question." }, { status: 400 }); return json({ researchUsed: true, ...(await runResearch(query, request)) }); }
async function handleImage(request, body) { const prompt = cleanText(body?.prompt, 3000); if (!prompt) return json({ error: "Please describe the image you want." }, { status: 400 }); const key = process.env.GEMINI_API_KEY; const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image"; if (!key) return json({ error: "Image generation is temporarily unavailable." }, { status: 503 }); const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }), cache: "no-store", signal: request.signal }); if (!response.ok) return json({ error: "OZLIND could not generate that image right now." }, { status: 503 }); const data = await response.json(); const image = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData; if (!image?.data) return json({ error: "The image service did not return an image." }, { status: 502 }); return json({ image: `data:${image.mimeType || "image/png"};base64,${image.data}` }); }

export async function POST(request) {
  if (!originAllowed(request)) return json({ error: "Request rejected." }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0); if (length > 32_000_000) return json({ error: "Request payload is too large." }, { status: 413 });
  const action = new URL(request.url).searchParams.get("action") || "chat"; const rl = rateLimit(request, action === "research" ? 12 : action === "image" ? 6 : 24); if (!rl.ok) return json({ error: "OZLIND is temporarily busy. Please try again in a moment.", retryAfter: rl.retryAfter }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, { status: 400 }); }
  try { if (action === "research") return await handleResearch(request, body); if (action === "image") return await handleImage(request, body); return await handleChat(request, body); } catch (error) { if (error?.name === "AbortError") throw error; const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 503; return json({ error: cleanText(error?.message, 240) || "OZLIND could not complete that request." }, { status: status === 500 ? 503 : status }); }
}
