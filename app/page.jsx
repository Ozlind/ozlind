import { redirect } from "next/navigation";
import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  let user = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (error) {
    console.error("Session check failed:", error?.message);
  }

  if (!user) {
    redirect("/login");
  }

  // Pass only the fields the UI needs.
  const initialUser = {
    id: user.id,
    email: user.email || "",
    user_metadata: {
      full_name: user.user_metadata?.full_name || "",
      name: user.user_metadata?.name || "",
      avatar_url: user.user_metadata?.avatar_url || "",
      picture: user.user_metadata?.picture || "",
    },
  };

  return <OzlindApp initialUser={initialUser} />;
}
