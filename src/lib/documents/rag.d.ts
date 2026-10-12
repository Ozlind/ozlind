export interface DocumentInput {
  name: string;
  mime: string;
  sizeBytes: number;
  content: string;
}

export interface DocumentSearchResult {
  id: string;
  documentId: string;
  name: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export function ingestDocument(input: DocumentInput): Promise<Record<string, unknown>>;
export function searchDocuments(query: string, options?: { matchThreshold?: number; matchCount?: number }): Promise<DocumentSearchResult[]>;
export function deleteDocument(documentId: string): Promise<void>;
