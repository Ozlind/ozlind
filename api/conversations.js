import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        // Fallback gracefully if table not yet initialized
        return res.status(200).json([]);
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { title = 'New Conversation', model_mode = 'smart', user_id = 'athul-owner' } = req.body || {};
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          title,
          model_mode,
          user_id,
          pinned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, title, pinned, model_mode } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing conversation id' });

      const updates = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (pinned !== undefined) updates.pinned = pinned;
      if (model_mode !== undefined) updates.model_mode = model_mode;

      const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Missing conversation id' });

      // First delete associated messages
      await supabase.from('messages').delete().eq('conversation_id', id);

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ ok: true, deletedId: id });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Conversations API error:', err);
    res.status(500).json({ error: err.message });
  }
}
