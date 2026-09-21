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

const DEFAULTS = {
  memory_enabled: true,
  research_enabled: false,
  preferred_mode: 'auto',
  response_style: 'balanced',
  response_length: 'medium',
  custom_instructions: '',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const client = getUserClient(req);
  if (!client) return res.status(401).json({ error: 'Sign in required.' });

  try {
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });
    const userId = userData.user.id;

    if (req.method === 'GET') {
      const { data, error } = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: createErr } = await client
          .from('user_settings')
          .insert({ user_id: userId, ...DEFAULTS })
          .select()
          .single();
        if (createErr) throw createErr;
        return res.status(200).json(created);
      }
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const update = { updated_at: new Date().toISOString() };
      if (typeof body.memory_enabled === 'boolean') update.memory_enabled = body.memory_enabled;
      if (typeof body.research_enabled === 'boolean') update.research_enabled = body.research_enabled;
      if (typeof body.preferred_mode === 'string') update.preferred_mode = body.preferred_mode.slice(0, 20);
      if (typeof body.response_style === 'string') update.response_style = body.response_style.slice(0, 20);
      if (typeof body.response_length === 'string') update.response_length = body.response_length.slice(0, 20);
      if (typeof body.custom_instructions === 'string') update.custom_instructions = body.custom_instructions.slice(0, 2000);

      const { data, error } = await client
        .from('user_settings')
        .upsert({ user_id: userId, ...update }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('settings error:', err?.message);
    return res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  }
}
