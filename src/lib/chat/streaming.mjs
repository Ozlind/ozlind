export const CHAT_UI_FLUSH_INTERVAL_MS = 32;

/** Decide when buffered stream text should be committed to React state. */
export function shouldFlushVisibleText(pendingText, now, lastFlush, force = false) {
  if (typeof pendingText !== "string" || pendingText.length === 0) return false;
  if (force) return true;
  return now - lastFlush >= CHAT_UI_FLUSH_INTERVAL_MS;
}
