import { redirect } from "next/navigation";

import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function text(value) {
  return typeof value === "string" ? value : "";
}

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const metadata = user.user_metadata ?? {};

  const initialUser = {
    id: user.id,
    email: user.email ?? "",
    user_metadata: {
      full_name: text(metadata.full_name),
      name: text(metadata.name),
      avatar_url: text(metadata.avatar_url),
      picture: text(metadata.picture),
    },
  };

  /*
   * Load the conversation list and saved settings on the server so the
   * sidebar is ready on first paint. If the database tables are missing
   * or the query fails, both stay null and the app falls back to
   * on-device storage instead of breaking.
   */
  let initialHistory = null;
  let initialSettings = null;

  try {
    const [conversations, settings] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!conversations.error && !settings.error) {
      initialHistory = (conversations.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: Date.parse(row.updated_at) || Date.now(),
      }));

      if (
        settings.data?.settings &&
        typeof settings.data.settings === "object"
      ) {
        initialSettings = settings.data.settings;
      }
    }
  } catch (loadError) {
    console.error("OZLIND could not load cloud data:", loadError);
  }

  return (
    <OzlindApp
      initialUser={initialUser}
      initialHistory={initialHistory}
      initialSettings={initialSettings}
    />
  );
}