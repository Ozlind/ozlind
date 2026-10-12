import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/login?error=server_configuration");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      redirect("/login");
    }

    return (
      <AppShell
        user={{
          id: user.id,
          email: user.email ?? "",
          displayName: user.user_metadata?.display_name ?? "",
        }}
      >
        {children}
      </AppShell>
    );
  } catch {
    redirect("/login?error=server_configuration");
  }
}
