import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getOrigin(request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") || "https";

  if (process.env.NODE_ENV === "production" && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export async function GET(request) {
  const origin = getOrigin(request);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase OAuth callback error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=oauth_callback`);
    }

    return NextResponse.redirect(`${origin}/`);
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}
