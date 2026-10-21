import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;
const schema = z.object({
  id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["text", "code", "markdown", "json"]),
  content: z.string().max(100000),
  version: z.number().int().positive().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const { data, error } = await supabase
      .from("artifacts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return Response.json({ artifacts: data ?? [] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: { code: "ARTIFACTS_UNAVAILABLE" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    let body: unknown;
    try {
      body = await readJsonBody(request, MAX_BODY_BYTES);
    } catch (error) {
      return Response.json({
        error: { code: error instanceof PayloadTooLargeError ? "PAYLOAD_TOO_LARGE" : "INVALID_INPUT" },
      }, { status: error instanceof PayloadTooLargeError ? 413 : 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });

    const input = parsed.data;
    const row = {
      user_id: user.id,
      conversation_id: input.conversation_id ?? null,
      title: input.title,
      kind: input.kind,
      content: input.content,
      version: input.version ?? 1,
    };
    const query = input.id
      ? supabase.from("artifacts").update({ ...row, version: (input.version ?? 1) + 1 }).eq("id", input.id).eq("user_id", user.id)
      : supabase.from("artifacts").insert(row);
    const { data, error } = await query.select("*").single();
    if (error) throw error;

    return Response.json({ artifact: data }, { status: input.id ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: { code: "ARTIFACT_SAVE_FAILED" } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
    if (!id.success) return Response.json({ error: { code: "INVALID_ID" } }, { status: 400 });

    const { error } = await supabase.from("artifacts").delete().eq("id", id.data).eq("user_id", user.id);
    if (error) throw error;
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "ARTIFACT_DELETE_FAILED" } }, { status: 500 });
  }
}
