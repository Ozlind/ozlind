import { createClient } from '@supabase/supabase-js';

function getUserClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const client = getUserClient(req);
  if (!client) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });

    if (req.method === 'GET') {
      const conversationId = req.query.conversation_id;
      if (!conversationId) return res.status(400).json({ error: 'conversation_id is required.' });
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { conversation_id, role, content, metadata } = req.body || {};
      if (!conversation_id || !role || typeof content !== 'string') {
        return res.status(400).json({ error: 'conversation_id, role and content are required.' });
      }
      if (role !== 'user' && role !== 'assistant') return res.status(400).json({ error: 'Invalid role.' });
      const { data, error } = await client
        .from('messages')
        .insert({ conversation_id, role, content: content.slice(0, 20000), metadata: metadata || {} })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required.' });
      const { error } = await client.from('messages').delete().in('id', ids);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('messages error:', err?.message);
    return res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  }
}
