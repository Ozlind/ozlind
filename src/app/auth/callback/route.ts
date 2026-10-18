import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(next: string | null, origin: string): string {
  if (!next) return "/app";

  try {
    const destination = new URL(next, origin);
    if (destination.origin !== origin) return "/app";

    // Redirect only to a same-origin path, never an arbitrary URL.
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/app";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("[supabase] OAuth callback configuration error:", error);
    return NextResponse.redirect(
      new URL("/login?error=server_configuration", url.origin),
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin));
  }

  return NextResponse.redirect(
    new URL(getSafeNextPath(next, url.origin), url.origin),
  );
}
