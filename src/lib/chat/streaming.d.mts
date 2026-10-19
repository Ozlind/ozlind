export const CHAT_UI_FLUSH_INTERVAL_MS: 32;
export function shouldFlushVisibleText(
  pendingText: string,
  now: number,
  lastFlush: number,
  force?: boolean,
): boolean;
