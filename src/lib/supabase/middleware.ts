import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function passthrough(request: NextRequest) {
  return { response: NextResponse.next({ request }), user: null };
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  // Never let a missing production configuration turn every page request into
  // a server exception. Protected routes will still be handled as unauthenticated.
  if (!supabaseUrl || !publishableKey) {
    console.error(
      "[supabase] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY"
    );
    return passthrough(request);
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("[supabase] Session lookup failed:", error.message);
      return { response, user: null };
    }

    return { response, user };
  } catch (error) {
    console.error("[supabase] Middleware session error:", error);
    return { response, user: null };
  }
}
