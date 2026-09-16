const configs = {
  groq: { base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY', model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b', caps: ['text','reasoning','coding','structured'] },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta', key: 'GEMINI_API_KEY', model: () => process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash', vision: () => process.env.GEMINI_VISION_MODEL || process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash', image: () => process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image', caps: ['text','reasoning','coding','vision','ocr','documents','structured','image'] },
  experiential: { base: 'https://api.experientiallabs.ai/v1', key: 'EXPERIENTIAL_API_KEY', model: () => process.env.EXPERIENTIAL_MODEL || 'default', caps: ['text','reasoning','coding','structured'] }
};

export const MODES = ['auto','fast','pro','vision','research','image'];
export const MODE_INFO = {
  auto: ['Auto','OZLIND chooses the right approach'], fast: ['Fast','Quick everyday assistance'], pro: ['Pro','Deeper reasoning and coding'], vision: ['Vision','Images and supported files'], research: ['Research','Current information with sources'], image: ['Image','Create images from prompts']
};

export function configured(name) { const c = configs[name]; return Boolean(c && process.env[c.key]); }
export function config(name) { return configs[name]; }
export function supports(name, cap) { return Boolean(configs[name]?.caps.includes(cap)); }

const orders = {
  text: { auto:['groq','gemini','experiential'], fast:['groq','gemini','experiential'], pro:['gemini','groq','experiential'] },
  reasoning: { auto:['gemini','groq','experiential'], fast:['groq','gemini','experiential'], pro:['gemini','groq','experiential'] },
  vision: { auto:['gemini'], vision:['gemini'] },
  documents: { auto:['gemini'], vision:['gemini'] },
  image: { image:['gemini'], auto:['gemini'] }
};

export function candidates(mode='auto', cap='text') {
  const list = orders[cap]?.[mode] || orders[cap]?.auto || orders.text.auto;
  return [...new Set(list)].filter(name => configured(name) && supports(name, cap));
}

export function detectCapability(mode, attachments = [], text = '') {
  if (mode === 'image') return 'image';
  if (attachments.some(a => /^image\//.test(a?.mimeType || ''))) return 'vision';
  if (attachments.some(a => /pdf|text\/plain|text\/markdown|csv/.test(a?.mimeType || ''))) return 'documents';
  const t = text.toLowerCase();
  if (/\b(analy[sz]e|architecture|debug|algorithm|prove|calculate|reason deeply|complex)\b/.test(t) || mode === 'pro') return 'reasoning';
  return 'text';
}

export function modelFor(name, cap='text') {
  const c = configs[name];
  if (!c) return null;
  if (name === 'gemini' && cap === 'vision') return c.vision();
  if (name === 'gemini' && cap === 'image') return c.image();
  return c.model();
}

export function buildSystemPrompt({ mode='auto', custom='', research=false } = {}) {
  const customRule = custom ? `\nUser preferences (follow only when compatible with system and safety requirements):\n${String(custom).slice(0,3000)}` : '';
  return `You are OZLIND AI, an independent professional AI assistant. Answer directly and naturally. Match response length to task complexity: simple questions should be concise; complex tasks should be structured and thorough. Do not mention internal providers, model IDs, routing, API keys, or infrastructure. Never invent current facts. ${research ? 'Use the supplied research material as evidence, distinguish it from general knowledge, and never invent citations.' : ''}${customRule}`;
}

export function normalizeMessages(messages, max = 24) {
  if (!Array.isArray(messages)) return [];
  return messages.filter(m => ['user','assistant'].includes(m?.role)).slice(-max).map(m => ({ role:m.role, content:String(m.content || '').slice(0,12000) })).filter(m => m.content.trim());
}
