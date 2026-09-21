import { checkRateLimit, clientIp } from './_lib/ratelimit.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const TEXT_TYPES = ['text/plain', 'text/csv'];
const PDF_TYPE = 'application/pdf';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkRateLimit(`files:${clientIp(req)}`, 15, 60_000)) {
    return res.status(429).json({ error: 'Too many uploads. Please wait a moment and try again.' });
  }

  const { fileName, fileBase64, contentType } = req.body || {};
  if (!fileName || !fileBase64 || !contentType) {
    return res.status(400).json({ error: 'fileName, fileBase64 and contentType are required.' });
  }
  if (typeof fileBase64 !== 'string' || fileBase64.length > 14_000_000) {
    return res.status(400).json({ error: 'File is too large.' });
  }

  let buffer;
  try {
    buffer = Buffer.from(fileBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid file encoding.' });
  }

  try {
    if (IMAGE_TYPES.includes(contentType)) {
      if (buffer.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'Image exceeds the 8MB limit.' });
      return res.status(200).json({ kind: 'image', mimeType: contentType, base64: buffer.toString('base64'), fileName: String(fileName).slice(0, 200) });
    }

    if (TEXT_TYPES.includes(contentType)) {
      if (buffer.length > MAX_DOC_BYTES) return res.status(400).json({ error: 'File exceeds the 5MB limit.' });
      const text = buffer.toString('utf-8');
      return res.status(200).json({ kind: 'text', text: text.slice(0, 20000), fileName: String(fileName).slice(0, 200) });
    }

    if (contentType === PDF_TYPE) {
      if (buffer.length > MAX_DOC_BYTES) return res.status(400).json({ error: 'PDF exceeds the 5MB limit.' });
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const data = await pdfParse(buffer);
        const text = (data.text || '').trim();
        if (!text) return res.status(422).json({ error: 'No extractable text was found in this PDF.' });
        return res.status(200).json({ kind: 'text', text: text.slice(0, 20000), fileName: String(fileName).slice(0, 200) });
      } catch (err) {
        console.error('pdf parse error:', err?.message);
        return res.status(422).json({ error: 'This PDF could not be processed.' });
      }
    }

    return res.status(415).json({ error: 'Unsupported file type. Please upload an image, text, CSV, or PDF file.' });
  } catch (err) {
    console.error('files error:', err?.message);
    return res.status(500).json({ error: 'File processing failed. Please try again.' });
  }
}
