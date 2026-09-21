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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      const { conversation_id, role, content, attachments } = req.body;
      if (!conversation_id || !role || !content) {
        return res.status(400).json({ error: 'conversation_id, role, content required' });
      }

      // Verify ownership
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversation_id)
        .eq('user_id', user.id)
        .single();
      if (!conv) return res.status(403).json({ error: 'Not your conversation' });

      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id, role, content, attachments: attachments || [] })
        .select()
        .single();
      if (error) throw error;

      // Update conversation updated_at
      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation_id);

      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required' });

      const { data: msg } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('id', id)
        .single();
      if (!msg) return res.status(404).json({ error: 'Message not found' });

      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', msg.conversation_id)
        .eq('user_id', user.id)
        .single();
      if (!conv) return res.status(403).json({ error: 'Not your message' });

      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Messages API error:', err);
    res.status(500).json({ error: err.message });
  }
}
