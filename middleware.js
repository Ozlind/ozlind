import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  // If Supabase environment variables are missing,
  // don't create a redirect loop.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh and validate the Supabase session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes required for authentication.
  const isLoginPage = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isSupabaseConfig = pathname === "/api/supabase/config";

  // Keep authentication routes accessible.
  if (isLoginPage || isAuthCallback || isSupabaseConfig) {
    // If already authenticated, don't show the login page again.
    if (isLoginPage && user) {
      const url = request.nextUrl.clone();

      url.pathname = "/";
      url.search = "";

      return NextResponse.redirect(url);
    }

    return response;
  }

  // Protect the application.
  if (!user) {
    const url = request.nextUrl.clone();

    url.pathname = "/login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};