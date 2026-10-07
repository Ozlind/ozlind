import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(name, value, options);
              }
            );
          } catch {
            // Server Components may not be able to write cookies.
          }
        },
      },
    }
  );
}

/*
 * Server-only privileged client.
 * Never import this helper from client components.
 * It uses the Supabase secret key and therefore bypasses RLS intentionally
 * for narrow server-side ownership/integrity checks.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY.",
    );
  }

  return createSupabaseClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
