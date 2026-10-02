export const LIMITS = {
  /** Newest N messages sent per request. */
  maxMessagesPerRequest: 20,
  maxTextChars: 12_000,
  maxCustomInstructionChars: 5_000,
  maxResearchQueryChars: 500,

  /** Server rejects image data URLs longer than this. */
  maxImageDataUrlChars: 12_000_000,
  /** Client refuses to send images larger than this after optimising. */
  maxOptimizedImageChars: 4_000_000,

  maxImageBytes: 12 * 1024 * 1024,
  maxTextFileBytes: 2 * 1024 * 1024,
  maxTextFileChars: 8_000,

  titleMaxChars: 52,
} as const;

export const TEXT_FILE_PATTERN =
  /\.(txt|md|csv|json|log|py|js|jsx|ts|tsx|html|css|sql|xml|yml|yaml)$/i;

/** Must stay in sync with TEXT_FILE_PATTERN. Images and plain-text files only. */
export const ATTACHMENT_ACCEPT =
  "image/*,.txt,.md,.csv,.json,.log,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.xml,.yml,.yaml";