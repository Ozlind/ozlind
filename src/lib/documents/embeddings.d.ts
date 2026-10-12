export interface EmbeddingOptions {
  taskType?: string | null;
  title?: string | null;
}

export interface BatchEmbeddingOptions {
  taskType?: string | null;
  titles?: string[];
}

export function createEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;
export function createEmbeddings(texts: string[], options?: BatchEmbeddingOptions): Promise<number[][]>;
export function embeddingDimensions(): number;
