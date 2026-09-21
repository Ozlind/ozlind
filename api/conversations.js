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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const client = getUserClient(req);
  if (!client) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });
    const userId = userData.user.id;

    if (req.method === 'GET') {
      const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { title } = req.body || {};
      const { data, error } = await client
        .from('conversations')
        .insert({ title: String(title || 'New chat').slice(0, 120), user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, title } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const update = { updated_at: new Date().toISOString() };
      if (typeof title === 'string') update.title = title.slice(0, 120);
      const { data, error } = await client.from('conversations').update(update).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const { error } = await client.from('conversations').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('conversations error:', err?.message);
    return res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  }
}
