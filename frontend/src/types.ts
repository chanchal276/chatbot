export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  confidence?: number;
  sources?: string[];
  follow_up_suggestions?: string[];
}

export interface ThreadSummary {
  id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  pinned: boolean;
  tags: string[];
}

export interface ThreadResponse {
  thread: ThreadSummary;
  messages: ChatMessage[];
}

export interface ChatResponse {
  thread_id: string;
  answer: string;
  confidence: number;
  sources: string[];
  follow_up_suggestions: string[];
}

export interface DocumentItem {
  filename: string;
  chunks?: number;
  uploaded_at?: string;
  file_size?: number;
}

export interface AppSettings {
  userId: string;
  autoCreateThread: boolean;
  maxMessagesPerThread: number;
  webSearchEnabled: boolean;
  maxNeo4jResults: number;
  maxWebResults: number;
  fontSize: "small" | "medium" | "large";
  showConfidence: boolean;
  showSources: boolean;
  defaultThreadId: string;
  apiKey: string;
}

export interface AuthUser {
  email: string;
  full_name: string;
  created_at?: string;
  updated_at?: string;
}
