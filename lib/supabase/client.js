"use client";

import { createBrowserClient } from "@supabase/ssr";

let supabaseClient = null;
let configPromise = null;

async function getSupabaseConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/supabase/config", {
      method: "GET",
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          "Unable to load Supabase configuration."
        );
      }

      const config = await response.json();

      if (!config.url || !config.publishableKey) {
        throw new Error(
          "Invalid Supabase configuration."
        );
      }

      return config;
    });
  }

  return configPromise;
}

export async function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = await getSupabaseConfig();

  supabaseClient = createBrowserClient(
    config.url,
    config.publishableKey
  );

  return supabaseClient;
}