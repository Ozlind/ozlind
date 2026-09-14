const fs = require("fs");
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const html = fs.readFileSync("index.html", "utf8");
const chat = fs.readFileSync("chatbot.js", "utf8");
const api = fs.readFileSync("api/chat.js", "utf8");
const image = fs.readFileSync("api/image-generate.js", "utf8");
const sprite = fs.readFileSync("ozlind-icons.svg", "utf8");

assert(!/openrouter/i.test(html + chat + api), "OpenRouter reference found");
assert(!/data-page=["']vision["']|data-view=["']vision["']/i.test(html), "Separate Image Generator page is still present");
assert(/\/api\/image-generate/.test(chat), "Chat image route is not wired");
assert(/length\s*>\s*4000|slice\(0,\s*4000\)/.test(image), "Long-prompt guard is missing");
assert(!/enhance=true|negative_prompt/i.test(image), "Unreliable image prompt modifiers are present");
assert(/safe.*true|true.*safe/i.test(image), "Image safety request is missing");
assert(/TAVILY_API_KEY/.test(api), "Tavily integration is missing");
assert(/GROQ_API_KEY/.test(api) && /GEMINI_API_KEY/.test(api), "Core AI providers are missing");
assert(/id=["']ozlindBoot["']/.test(html), "Opening experience is missing");

const ids = [...sprite.matchAll(/<symbol\s+id=["']([^"']+)["']/g)].map(x => x[1]);
assert(ids.length >= 50, `SVG sprite unexpectedly incomplete (${ids.length})`);

console.log(`OK: JS syntax/structure, provider wiring, in-chat image generation, long prompts, safety, boot experience, OpenRouter removal, SVG symbols (${ids.length})`);
