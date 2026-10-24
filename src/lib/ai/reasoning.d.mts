export type ReasoningEffort = "low" | "medium" | "high";

/** Select a supported reasoning budget without penalizing simple prompts. */
export declare function getReasoningEffort(
  modelId: string,
  prompt: string,
): ReasoningEffort | undefined;
