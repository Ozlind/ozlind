import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url)
    );
  }

  try {
    const supabase = await createClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "Supabase OAuth callback error:",
        error.message
      );

      return NextResponse.redirect(
        new URL("/login?error=oauth_callback", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/", request.url)
    );
  } catch (error) {
    console.error(
      "OAuth callback failed:",
      error
    );

    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url)
    );
  }
}