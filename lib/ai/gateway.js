/**
 * OZLIND AI Gateway
 *
 * Stable application boundary for model execution.
 * Provider-specific routing stays isolated from API routes.
 */
import { streamFromProviders } from "@/lib/providers";

export async function generateChatResponse(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("AI gateway input is required.");
  }

  const {
    messages,
    mode = "auto",
    vision = false,
    systemPrompt = "",
    providers,
    signal,
    onProvider,
    onDelta,
  } = input;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError("AI gateway requires at least one message.");
  }

  if (typeof onDelta !== "function") {
    throw new TypeError("AI gateway requires an onDelta callback.");
  }

  return streamFromProviders({
    messages,
    mode,
    vision,
    systemPrompt: String(systemPrompt),
    providers: Array.isArray(providers) ? providers : undefined,
    signal,
    onProvider,
    onDelta,
  });
}
