import { redirect } from "next/navigation";

import DocumentLibrary from "@/components/DocumentLibrary";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents — OZLIND AI",
  description: "Manage your private OZLIND AI document library.",
};

export default async function DocumentsPage() {
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
    name:
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "OZLIND User",
    email: user.email || "",
  };

  return (
    <DocumentLibrary
      initialUser={initialUser}
    />
  );
}