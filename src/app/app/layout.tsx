import type { Metadata } from "next";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: { default: "Ozlind AI workspace", template: "%s | Ozlind AI" },
  description: "Your private Ozlind AI workspace by Ozlind Enterprises for conversations, saved work, and documents.",
};

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

  let user: User | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    // Authentication lookup failed; redirect below without swallowing Next.js redirects.
  }

  if (!user) {
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
}
