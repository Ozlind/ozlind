export type Mode = 'auto' | 'fast' | 'pro' | 'vision' | 'research';

export type AttachmentDescriptor =
  | { kind: 'image'; mimeType: string; base64: string; fileName: string; previewUrl?: string }
  | { kind: 'text'; text: string; fileName: string };

export interface SourceCard {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: AttachmentDescriptor[];
  sources?: SourceCard[];
  mode?: string;
  status?: 'streaming' | 'done' | 'error' | 'stopped';
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type ResponseStyle = 'concise' | 'balanced' | 'detailed';
export type ResponseLength = 'short' | 'medium' | 'long';
export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  preferredMode: Mode;
  researchEnabled: boolean;
  memoryEnabled: boolean;
  responseStyle: ResponseStyle;
  responseLength: ResponseLength;
  customInstructions: string;
  theme: Theme;
}

export interface HealthServices {
  groq: boolean;
  gemini: boolean;
  experiential: boolean;
  tavily: boolean;
  supabase: boolean;
}
