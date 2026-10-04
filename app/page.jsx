import dynamicImport from "next/dynamic";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const OzlindApp = dynamicImport(
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

    if (!conversations.error) {
      initialHistory = (conversations.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: Date.parse(row.updated_at) || Date.now(),
      }));
    }

    if (
      !settings.error &&
      settings.data?.settings &&
      typeof settings.data.settings === "object"
    ) {
      initialSettings = settings.data.settings;
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