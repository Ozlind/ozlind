"use client";

import { createBrowserClient } from "@supabase/ssr";

let supabaseClient;

export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY."
    );
  }

  supabaseClient = createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
  );

  return supabaseClient;
}