import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/*
 * OZLIND's interactive workspace is intentionally loaded as a
 * separate client chunk.
 *
 * This keeps the authenticated server route lightweight while
 * preserving server-side authentication and initial data loading.
 */
const OzlindApp = dynamic(
  () => import("@/components/OzlindApp"),
  {
    loading: () => (
      <main className="ozlind-loading" aria-label="Loading OZLIND AI">
        <div className="ozlind-loading-mark" aria-hidden="true">
          <span className="ozlind-loading-dot" />
        </div>

        <div className="ozlind-loading-content" aria-hidden="true">
          <div className="ozlind-loading-line ozlind-loading-line-lg" />
          <div className="ozlind-loading-line ozlind-loading-line-sm" />
        </div>

        <span className="sr-only">Loading OZLIND AI</span>
      </main>
    ),
  },
);

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
   * Load the conversation list and saved settings on the server so
   * authenticated data is available as soon as the interactive
   * workspace hydrates.
   *
   * Only lightweight conversation metadata is selected here.
   * Full messages continue to be loaded only when required.
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
    console.error(
      "OZLIND could not load cloud data:",
      loadError,
    );
  }

  return (
    <OzlindApp
      initialUser={initialUser}
      initialHistory={initialHistory}
      initialSettings={initialSettings}
    />
  );
}