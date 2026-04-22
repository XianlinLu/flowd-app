export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  cardContext?: {
    category: string;
    title: string;
  };
  attachment?: {
    name: string;
    type: string;
    size: number;
    url?: string;
  };
  isTemporary?: boolean; // For messages that should disappear automatically
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  stream?: boolean;
  sessionId?: string;
}

export interface ChatResponse {
  message: Message;
  sessionId: string;
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export type ModelType = 'deepseek-chat';

export interface ModelOption {
  id: ModelType;
  name: string;
  description: string;
}
