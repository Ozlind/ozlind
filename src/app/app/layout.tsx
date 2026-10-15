import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s | Ozlind" },
  description: "Your private Ozlind workspace.",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    redirect("/login?error=server_configuration");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) redirect("/login");
  } catch (error) {
    // Preserve Next.js redirect control flow rather than masking redirects.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/login?error=server_configuration");
  }

  return children;
}
