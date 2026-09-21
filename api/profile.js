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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const client = getUserClient(req);
  if (!client) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });
    const user = userData.user;

    const { data, error } = await client
      .from('profiles')
      .upsert({ id: user.id, display_name: user.email?.split('@')[0] || 'User' }, { onConflict: 'id', ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;
    return res.status(200).json(data || { id: user.id });
  } catch (err) {
    console.error('profile error:', err?.message);
    return res.status(500).json({ error: 'Could not sync profile.' });
  }
}
