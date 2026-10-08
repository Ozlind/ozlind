import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaults = {
  theme: "system",
  accent: "#E26F4A",
  language: "en",
  density: "comfortable",
  code_theme: "default",
  layout: "standard",
  default_model: "groq:llama-3.3-70b-versatile",
  enter_to_send: true,
  auto_scroll: true,
  show_reasoning: false,
  research_enabled: false,
} as const;

const schema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  language: z.enum(["en", "ml"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  code_theme: z.string().min(1).max(80).optional(),
  layout: z.enum(["standard", "wide"]).optional(),
  default_model: z.enum([
    "groq:llama-3.3-70b-versatile",
    "groq:deepseek-r1-distill-llama-70b",
    "google:gemini-2.0-flash",
  ]).optional(),
  enter_to_send: z.boolean().optional(),
  auto_scroll: z.boolean().optional(),
  show_reasoning: z.boolean().optional(),
  research_enabled: z.boolean().optional(),
});

async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return Response.json({ error: { code: "PREFERENCES_LOAD_FAILED" } }, { status: 500 });

    return Response.json({ preferences: { ...defaults, ...(data ?? {}) } }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: { code: "SERVER_CONFIGURATION_ERROR" } }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getUser();
    if (!user) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT" } }, { status: 400 });

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) return Response.json({ error: { code: "PREFERENCES_SAVE_FAILED" } }, { status: 500 });

    return Response.json({ preferences: data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: { code: "SERVER_CONFIGURATION_ERROR" } }, { status: 503 });
  }
}
