import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/supabase/config",
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );
}

function copyCookies(fromResponse, toResponse) {
  fromResponse.cookies.getAll().forEach((cookie) => {
    toResponse.cookies.set(cookie);
  });

  return toResponse;
}

export async function middleware(request) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  /*
   * If Supabase is not configured, don't turn
   * every request into a middleware crash.
   */
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
            ({ name, value }) => {
              request.cookies.set(
                name,
                value
              );
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

  let user = null;

  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    user = currentUser ?? null;
  } catch (error) {
    console.error(
      "Supabase middleware session check failed:",
      error
    );

    user = null;
  }

  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  /*
   * Authenticated users should not return to the
   * login screen unless they explicitly signed out.
   */
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();

    homeUrl.pathname = "/";
    homeUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(homeUrl);

    return copyCookies(
      response,
      redirectResponse
    );
  }

  /*
   * Public routes remain accessible without
   * authentication.
   */
  if (publicPath) {
    return response;
  }

  /*
   * Every protected page and API route requires
   * an authenticated Supabase user.
   */
  if (!user) {
    if (pathname.startsWith("/api/")) {
      const apiResponse =
        NextResponse.json(
          {
            error:
              "Authentication required.",
          },
          {
            status: 401,
          }
        );

      return copyCookies(
        response,
        apiResponse
      );
    }

    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(loginUrl);

    /*
     * Critical:
     * Preserve cookies refreshed by Supabase
     * before redirecting.
     */
    return copyCookies(
      response,
      redirectResponse
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};