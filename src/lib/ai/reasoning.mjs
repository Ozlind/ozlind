const FAST_MODEL = "openai/gpt-oss-20b";
const PRO_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.8-27b";

function needsMoreReasoning(prompt) {
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!text) return false;

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const hasStructuredWork =
    /\`\`\`|\`[^\`\n]+\`|^\s*(?:[-*•]|\d+[.)])\s+/m.test(text) ||
    /[{}\[\];]|=>|<\/?[a-z][^>]*>/i.test(text);
  const hasMultipleQuestions = (text.match(/[?؟]/g) ?? []).length >= 2;

  // Structural signals work across languages; do not rely on English keywords.
  return text.length >= 220 || lines.length >= 3 || hasStructuredWork || hasMultipleQuestions;
}

export function getReasoningEffort(modelId, prompt) {
  if (modelId === FAST_MODEL) {
    return needsMoreReasoning(prompt) ? "medium" : "low";
  }

  if (modelId === PRO_MODEL) return "high";
  if (modelId === VISION_MODEL) return "medium";

  // Custom provider model IDs may not support this provider-specific option.
  return undefined;
}
