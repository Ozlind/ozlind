import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const conversationId = req.query.conversation_id;
      if (!conversationId) {
        return res.status(200).json([]);
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Messages query warning:', error.message);
        return res.status(200).json([]);
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { conversation_id, role, content, attachments = [], sources = [] } = req.body || {};
      if (!conversation_id || !content) {
        return res.status(400).json({ error: 'conversation_id and content are required' });
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id,
          role: role || 'user',
          content,
          attachments,
          sources,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update parent conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation_id);

      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { conversation_id, id } = req.body || req.query;
      if (id) {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (conversation_id) {
        const { error } = await supabase.from('messages').delete().eq('conversation_id', conversation_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Missing id or conversation_id' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Messages API error:', err);
    res.status(500).json({ error: err.message });
  }
}
