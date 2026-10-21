import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request.mjs";
import { checkUserRateLimit, rateLimitErrorResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  system_prompt: z.string().max(12000),
  model: z.enum([
    "groq:llama-3.3-70b-versatile",
    "groq:deepseek-r1-distill-llama-70b",
    "google:gemini-2.0-flash",
  ]),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const { data, error } = await supabase.from("presets").select("*")
      .eq("user_id", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json({ presets: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: { code: "PRESETS_UNAVAILABLE" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const requestId = crypto.randomUUID();
    const rateLimit = await checkUserRateLimit();
    const rateLimitResponse = rateLimitErrorResponse(rateLimit, requestId);
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await readJsonBody(request, MAX_BODY_BYTES);
    } catch (error) {
      const oversized = error instanceof PayloadTooLargeError;
      return Response.json({ error: { code: oversized ? "PAYLOAD_TOO_LARGE" : "INVALID_INPUT" } }, { status: oversized ? 413 : 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });

    const input = parsed.data;
    const row = { user_id: user.id, name: input.name, system_prompt: input.system_prompt, model: input.model };
    const query = input.id
      ? supabase.from("presets").update(row).eq("id", input.id).eq("user_id", user.id)
      : supabase.from("presets").insert(row);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return Response.json({ preset: data }, { status: input.id ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: { code: "PRESET_SAVE_FAILED" } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
    if (!id.success) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });

    const { error } = await supabase.from("presets").delete().eq("id", id.data).eq("user_id", user.id);
    if (error) throw error;
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "PRESET_DELETE_FAILED" } }, { status: 500 });
  }
}
