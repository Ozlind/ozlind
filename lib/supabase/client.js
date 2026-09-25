"use client";

import { createBrowserClient } from "@supabase/ssr";

let supabaseClient = null;

export function createClient(config = null) {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl =
    config?.url ||
    globalThis.__OZLIND_SUPABASE_CONFIG__?.url;

  const supabasePublishableKey =
    config?.publishableKey ||
    globalThis.__OZLIND_SUPABASE_CONFIG__?.publishableKey;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase browser configuration is missing."
    );
  }

  supabaseClient = createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
  );

  return supabaseClient;
}