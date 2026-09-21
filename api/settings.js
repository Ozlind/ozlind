import supabase from './db-client.js';

async function verifyAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) {
        const { data: newSettings, error: createErr } = await supabase
          .from('settings')
          .insert({ user_id: user.id })
          .select()
          .single();
        if (createErr) throw createErr;
        return res.status(200).json(newSettings);
      }
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const { mode, research_enabled, memory_enabled, style, length, instructions, theme } = req.body;
      const updates = {};
      if (mode !== undefined) updates.mode = mode;
      if (research_enabled !== undefined) updates.research_enabled = research_enabled;
      if (memory_enabled !== undefined) updates.memory_enabled = memory_enabled;
      if (style !== undefined) updates.style = style;
      if (length !== undefined) updates.length = length;
      if (instructions !== undefined) updates.instructions = instructions;
      if (theme !== undefined) updates.theme = theme;

      const { data, error } = await supabase
        .from('settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings API error:', err);
    res.status(500).json({ error: err.message });
  }
}
