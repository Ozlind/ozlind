import { createClient as createAdminClient } from "@supabase/supabase-js";

import { json, safeError } from "@/lib/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently deletes the signed-in user's account.
 * Conversations, messages and settings are removed by database cascade.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(
        { error: "Your session has expired. Please sign in again." },
        401,
      );
    }

    let body = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    if (body?.confirm !== "DELETE") {
      return json({ error: "Confirmation is required." }, 400);
    }

    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
      return json(
        { error: "Account deletion is not available right now." },
        503,
      );
    }

    const admin = createAdminClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      throw error;
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // The account is already gone; the client signs out as well.
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: safeError(error) }, 500);
  }
}