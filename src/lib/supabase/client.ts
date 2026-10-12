import { createBrowserClient } from "@supabase/ssr";

const CONFIG_ERROR = "OZLIND_SUPABASE_CONFIG_MISSING";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    // Do not log or expose credentials. This message is intentionally stable
    // so the UI can show a safe, actionable configuration error.
    throw new Error(CONFIG_ERROR);
  }

  return createBrowserClient(url, anonKey);
}
