import { isUuid } from "@/lib/server";
import { createClient } from "@/lib/supabase/server";

const USAGE_LOG_TIMEOUT_MS = 600;

function clampText(value, max) {
  return typeof value === "string"
    ? value.trim().slice(0, max) || null
    : null;
}

export function writeUsageLog({
  userId,
  conversationId = null,
  mode = null,
  provider = null,
  model = null,
  tokensIn = null,
  tokensOut = null,
  latencyMs = null,
  ok = true,
  error = null,
}) {
  if (!isUuid(userId)) {
    return Promise.resolve();
  }

  return (async () => {
    let timeoutHandle = null;

    try {
      const supabase = await createClient();

      const insert = supabase.from("usage_logs").insert({
        user_id: userId,
        conversation_id: isUuid(conversationId)
          ? conversationId
          : null,
        mode: clampText(mode, 32),
        provider: clampText(provider, 64),
        model: clampText(model, 160),
        tokens_in: Number.isFinite(Number(tokensIn))
          ? Math.max(0, Math.round(Number(tokensIn)))
          : null,
        tokens_out: Number.isFinite(Number(tokensOut))
          ? Math.max(0, Math.round(Number(tokensOut)))
          : null,
        latency_ms: Number.isFinite(Number(latencyMs))
          ? Math.max(0, Math.round(Number(latencyMs)))
          : null,
        ok: Boolean(ok),
        error: clampText(error, 1000),
      });

      await Promise.race([
        insert,
        new Promise((resolve) => {
          timeoutHandle = setTimeout(resolve, USAGE_LOG_TIMEOUT_MS);
        }),
      ]);
    } catch (logError) {
      console.error("OZLIND usage logging failed:", logError);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  })();
}
