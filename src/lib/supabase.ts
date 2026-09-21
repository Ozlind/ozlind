import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ebfkwuvjvekckzqhzmnn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5e5v2F4mEQ1N7hljyuETnQ_c2JSepQh';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
