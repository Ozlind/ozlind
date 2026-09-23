const LIMITS = {
  messages: 20,
  text: 12000,
  customInstructions: 5000,
  imageChars: 12000000,
  researchQuery: 500,
};

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateMessages(input) {
  if (!Array.isArray(input) || !input.length) {
    throw new Error("At least one message is required.");
  }

  const messages = input.slice(-LIMITS.messages).map((message) => {
    if (!message || !["user", "assistant", "system"].includes(message.role)) {
      throw new Error("Invalid message role.");
    }

    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: clean(message.content, LIMITS.text),
      };
    }

    if (Array.isArray(message.content)) {
      const content = message.content
        .map((part) => {
          if (part?.type === "text") {
            return { type: "text", text: clean(part.text, LIMITS.text) };
          }

          if (
            part?.type === "image_url" &&
            typeof part.image_url?.url === "string" &&
            part.image_url.url.startsWith("data:image/")
          ) {
            if (part.image_url.url.length > LIMITS.imageChars) {
              throw new Error("Image attachment is too large.");
            }
            return { type: "image_url", image_url: { url: part.image_url.url } };
          }

          return null;
        })
        .filter(Boolean);

      return { role: message.role, content };
    }

    throw new Error("Invalid message content.");
  });

  const filtered = messages.filter((message) => message.role !== "system");
  let lastUser = -1;

  for (let index = filtered.length - 1; index >= 0; index -= 1) {
    if (filtered[index].role === "user") {
      lastUser = index;
      break;
    }
  }

  if (lastUser < 0) throw new Error("A user message is required.");
  return filtered.slice(0, lastUser + 1);
}

export function latestUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    if (typeof message.content === "string") return message.content;

    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join(" ");
  }

  return "";
}

export function hasVision(messages) {
  return messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === "image_url")
  );
}

export function shouldResearch(body, query) {
  return (
    body.research === true ||
    body.mode === "research" ||
    /\b(latest|current|today|now|recent|news|weather|price|stock|search|research|sources?|what happened|where is|when is)\b/i.test(
      query
    )
  );
}

export function systemPrompt(body, research) {
  const length = ["short", "medium", "long"].includes(body.responseLength)
    ? body.responseLength
    : "medium";
  const style = ["balanced", "professional", "friendly", "direct"].includes(
    body.responseStyle
  )
    ? body.responseStyle
    : "balanced";
  const custom = clean(body.customInstructions, LIMITS.customInstructions);

  const researchText = research
    ? `\nCURRENT WEB RESEARCH:\n${
        research.answer ? `Summary: ${research.answer}\n` : ""
      }${research.results
        .map(
          (source, index) =>
            `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.content}`
        )
        .join("\n\n")}\nUse these sources for current facts. Do not invent details.`
    : "";

  return `You are OZLIND AI, the official assistant of the OZLIND AI platform.
Answer the exact question first. Be concise, natural and useful. Simple questions normally need 1–3 sentences. Do not pad, repeat, or expose backend/provider details. Use bullets only when they improve clarity. If uncertain, say so.
Response length: ${length}.
Response style: ${style}.
Memory: ${
    body.memory === false
      ? "Use only the supplied current context."
      : "Use relevant supplied conversation context."
  }.
${custom ? `Custom instructions:\n${custom}` : ""}${researchText}`;
}

export function safeError(error) {
  const message = String(error?.message || "Unable to complete the request.");
  return message.length > 220 ? `${message.slice(0, 220)}…` : message;
}

export function limits() {
  return LIMITS;
}
