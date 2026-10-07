"use client";

import { createBrowserClient } from "@supabase/ssr";

type SupabaseConfig = { url: string; publishableKey: string };
let client: ReturnType<typeof createBrowserClient> | undefined;
let configPromise: Promise<SupabaseConfig> | undefined;

async function getConfig(): Promise<SupabaseConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/supabase/config", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load Supabase configuration.");
      const data = (await response.json()) as Partial<SupabaseConfig>;
      if (!data.url || !data.publishableKey) throw new Error("Invalid Supabase configuration.");
      return { url: data.url, publishableKey: data.publishableKey };
    });
  }
  return configPromise;
}

export async function createClient() {
  if (client) return client;
  const config = await getConfig();
  client = createBrowserClient(config.url, config.publishableKey);
  return client;
}
