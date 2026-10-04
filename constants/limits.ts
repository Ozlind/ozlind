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

  /** Free daily messages. profiles.daily_limit overrides this per user. */
  dailyMessages: 30,

  /** Documents and retrieval (RAG). */
  maxUploadBytes: 10 * 1024 * 1024,
  maxDocumentsPerUser: 20,
  ragChunkChars: 1_200,
  ragChunkOverlap: 150,
  ragTopK: 6,
  /** Must match vector(768) in supabase/schema.sql. */
  embeddingDimensions: 768,

  /** Chat search and organisation. */
  searchMinChars: 2,
  searchResultLimit: 30,
  folderNameMaxChars: 40,
  maxTagsPerChat: 5,
  feedbackMaxChars: 2_000,
} as const;

export const TEXT_FILE_PATTERN =
  /\.(txt|md|csv|json|log|py|js|jsx|ts|tsx|html|css|sql|xml|yml|yaml)$/i;

/** Must stay in sync with TEXT_FILE_PATTERN. Images and plain-text files only. */
export const ATTACHMENT_ACCEPT =
  "image/*,.txt,.md,.csv,.json,.log,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.xml,.yml,.yaml";