import supabase from './db-client.js';

async function verifyAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv', 'text/plain', 'text/markdown'];
const MAX_SIZE_MB = 10;

function magicBytesCheck(buffer, mimeType) {
  if (mimeType.startsWith('image/png')) {
    return buffer[0] === 0x89 && buffer[1] === 0x50;
  }
  if (mimeType.startsWith('image/jpeg')) {
    return buffer[0] === 0xFF && buffer[1] === 0xD8;
  }
  if (mimeType.startsWith('image/webp')) {
    return buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'application/pdf') {
    return buffer.slice(0, 5).toString('ascii') === '%PDF-';
  }
  return true; // text files don't have magic bytes
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { fileName, fileBase64, contentType } = req.body;
    if (!fileName || !fileBase64 || !contentType) {
      return res.status(400).json({ error: 'fileName, fileBase64, contentType required' });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > MAX_SIZE_MB * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large' });
    }

    if (!magicBytesCheck(buffer, contentType)) {
      return res.status(400).json({ error: 'File content does not match declared type' });
    }

    const path = `${user.id}/${Date.now()}_${fileName}`;
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(path, buffer, { contentType, upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
    return res.status(200).json({
      url: urlData.publicUrl,
      path,
      name: fileName,
      type: contentType,
      size: buffer.length,
    });
  } catch (err) {
    console.error('Upload API error:', err);
    res.status(500).json({ error: err.message });
  }
}
