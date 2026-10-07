import { createClient } from "@/lib/supabase/server";

/**
 * Single server-side authentication boundary for API/service code.
 * Uses Supabase Auth's verified session/JWT rather than trusting client fields.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      user: null,
      error,
      supabase,
    };
  }

  return {
    user: user || null,
    error: null,
    supabase,
  };
}

export async function requireAuthenticatedUser() {
  const result = await getAuthenticatedUser();

  if (!result.user) {
    const error = new Error("Authentication required.");
    error.code = "AUTH_REQUIRED";
    error.status = 401;
    throw error;
  }

  return result;
}

/**
 * Roles are read only from trusted Supabase app_metadata.
 * user_metadata is intentionally not accepted for authorization because
 * end users can normally change their own user metadata.
 */
export function hasRole(user, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const role = user?.app_metadata?.role;

  return typeof role === "string" && allowed.includes(role);
}
