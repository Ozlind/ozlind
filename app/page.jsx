import { redirect } from "next/navigation";

import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const metadata =
    user.user_metadata ?? {};

  const initialUser = {
    id: user.id,
    email: user.email ?? "",
    user_metadata: {
      full_name:
        typeof metadata.full_name ===
        "string"
          ? metadata.full_name
          : "",
      name:
        typeof metadata.name ===
        "string"
          ? metadata.name
          : "",
      avatar_url:
        typeof metadata.avatar_url ===
        "string"
          ? metadata.avatar_url
          : "",
      picture:
        typeof metadata.picture ===
        "string"
          ? metadata.picture
          : "",
    },
  };

  return (
    <OzlindApp
      initialUser={initialUser}
    />
  );
}