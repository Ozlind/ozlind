import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  // Supabase auth is optional until the environment
  // variables are configured.
  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              request.cookies.set(name, value);
            }
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/login";
  const isAuthCallback =
    pathname.startsWith("/auth/callback");

  const isPublicApi =
    pathname === "/api/supabase/config";

  // Public authentication/config routes.
  if (isLoginPage || isAuthCallback || isPublicApi) {
    if (user && isLoginPage) {
      const homeUrl = request.nextUrl.clone();

      homeUrl.pathname = "/";
      homeUrl.search = "";

      return NextResponse.redirect(homeUrl);
    }

    return response;
  }

  // Keep existing AI API routes available.
  // Individual API routes can perform their own
  // authentication checks when required.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Protect the main OZLIND application.
  if (!user) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};