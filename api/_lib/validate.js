const ALLOWED_MODES = ['auto', 'fast', 'pro', 'vision', 'research'];
const ALLOWED_STYLES = ['concise', 'balanced', 'detailed'];
const ALLOWED_LENGTHS = ['short', 'medium', 'long'];

export function validateChatBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body.' };
  const { message, mode = 'auto', history, attachments, settings, sources } = body;

  if (typeof message !== 'string' || !message.trim()) return { ok: false, error: 'A message is required.' };
  if (message.length > 8000) return { ok: false, error: 'Message is too long (max 8000 characters).' };
  if (!ALLOWED_MODES.includes(mode)) return { ok: false, error: 'Invalid mode selected.' };

  let cleanHistory = [];
  if (Array.isArray(history)) {
    cleanHistory = history
      .filter((h) => h && typeof h.content === 'string' && (h.role === 'user' || h.role === 'assistant'))
      .slice(-20)
      .map((h) => ({ role: h.role, content: h.content.slice(0, 6000) }));
  }

  let cleanAttachments = [];
  if (Array.isArray(attachments)) {
    cleanAttachments = attachments
      .filter((a) => a && (a.kind === 'image' || a.kind === 'text'))
      .slice(0, 4)
      .map((a) => {
        if (a.kind === 'image') {
          return { kind: 'image', mimeType: String(a.mimeType || 'image/png').slice(0, 60), base64: String(a.base64 || '').slice(0, 12_000_000) };
        }
        return { kind: 'text', fileName: String(a.fileName || 'file.txt').slice(0, 200), text: String(a.text || '').slice(0, 20000) };
      });
  }

  let cleanSources;
  if (Array.isArray(sources)) {
    cleanSources = sources
      .filter((s) => s && typeof s.url === 'string')
      .slice(0, 6)
      .map((s) => ({
        title: String(s.title || s.url).slice(0, 200),
        url: String(s.url).slice(0, 500),
        domain: String(s.domain || '').slice(0, 120),
        excerpt: String(s.excerpt || '').slice(0, 500),
      }));
  }

  const cleanSettings = {
    style: ALLOWED_STYLES.includes(settings?.style) ? settings.style : 'balanced',
    length: ALLOWED_LENGTHS.includes(settings?.length) ? settings.length : 'medium',
    customInstructions: typeof settings?.customInstructions === 'string' ? settings.customInstructions.slice(0, 2000) : '',
    researchEnabled: !!settings?.researchEnabled,
  };

  return {
    ok: true,
    value: { message: message.trim(), mode, history: cleanHistory, attachments: cleanAttachments, settings: cleanSettings, sources: cleanSources },
  };
}
