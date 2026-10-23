/**
 * Append a new assistant response, or replace the current answer to the latest
 * user turn when the user retries/regenerates it.
 */
export function appendOrReplaceLatestAssistant(messages, nextAssistant, replaceLatest) {
  const current = Array.isArray(messages) ? messages : [];
  if (!replaceLatest) return [...current, nextAssistant];

  let latestUserIndex = -1;
  let latestAssistantIndex = -1;
  for (let index = current.length - 1; index >= 0; index -= 1) {
    if (current[index]?.role === "assistant" && latestAssistantIndex === -1) {
      latestAssistantIndex = index;
    }
    if (current[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }

  // Only replace a response that belongs to the most recent user turn.
  // If there isn't one yet, append rather than deleting an older answer.
  if (latestAssistantIndex <= latestUserIndex || latestAssistantIndex === -1) {
    return [...current, nextAssistant];
  }

  return current.map((message, index) =>
    index === latestAssistantIndex ? nextAssistant : message,
  );
}
