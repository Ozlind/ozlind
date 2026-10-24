export type ExportableMessage = {
  role: "user" | "assistant";
  content: string;
  images?: Array<{ name?: string }>;
};

export function suggestArtifactTitle(
  messages: ExportableMessage[],
  prefix?: string,
): string;

export function buildConversationMarkdown(
  messages: ExportableMessage[],
  title?: string,
): string;
