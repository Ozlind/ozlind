import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const defaultUserId = 'athul-owner';

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', defaultUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('User settings fetch warning:', error.message);
      }

      if (!data) {
        return res.status(200).json({
          user_id: defaultUserId,
          display_name: 'Athul',
          custom_instructions: 'You are OZLIND AI, owned and created by Athul. Provide insightful, mathematically sound, production-ready responses with high executive clarity and clean technical examples.',
          ai_tone: 'executive'
        });
      }

      return res.status(200).json(data);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { display_name, custom_instructions, ai_tone } = req.body || {};

      // Check if row exists
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', defaultUserId)
        .maybeSingle();

      let result;
      if (existing?.id) {
        const { data, error } = await supabase
          .from('user_settings')
          .update({
            display_name: display_name || 'Athul',
            custom_instructions: custom_instructions || '',
            ai_tone: ai_tone || 'executive',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('user_settings')
          .insert({
            user_id: defaultUserId,
            display_name: display_name || 'Athul',
            custom_instructions: custom_instructions || '',
            ai_tone: ai_tone || 'executive',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      return res.status(200).json(result);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('User Settings API error:', err);
    res.status(500).json({ error: err.message });
  }
}
