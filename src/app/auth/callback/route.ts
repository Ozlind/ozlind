import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeRedirect(next: string | null, origin: string): URL {
  // A leading slash alone is not sufficient: URLs beginning with "//" are
  // protocol-relative and can redirect the browser to another origin.
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return new URL("/app", origin);
  }

  const destination = new URL(next, origin);
  return destination.origin === origin ? destination : new URL("/app", origin);
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
    return NextResponse.redirect(new URL("/login?error=server_configuration", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin));
  }

  return NextResponse.redirect(getSafeRedirect(next, url.origin));
}
