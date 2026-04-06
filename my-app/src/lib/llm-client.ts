import { Message, ModelType, LLMConfig } from '@/types/chat';
import { FLOWD_SYSTEM_PROMPT } from './prompts';

const MODEL_MAPPING: Record<ModelType, { provider: string; modelId: string }> = {
  'deepseek-chat': { provider: 'deepseek', modelId: 'deepseek-chat' },
};

interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    index: number;
    finish_reason: string;
  }>;
}

interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason: string | null;
  }>;
}

export class FlowdLLMClient {
  private config: LLMConfig;
  private apiKey: string;
  private baseURL: string;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = {
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      ...config,
    };

    this.apiKey = process.env.LLM_API_KEY || '';
    this.baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';

    // Debug logging
    console.log('[FlowdLLMClient] Base URL:', this.baseURL);
    console.log('[FlowdLLMClient] API Key exists:', !!this.apiKey);
    console.log('[FlowdLLMClient] API Key length:', this.apiKey.length);
    console.log('[FlowdLLMClient] API Key prefix:', this.apiKey.substring(0, 10) + '...');

    if (!this.apiKey) {
      console.warn('LLM_API_KEY environment variable is not set');
    }
  }

  private getHeaders(): HeadersInit {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
    console.log('[FlowdLLMClient] Request headers:', {
      ...headers,
      'Authorization': headers.Authorization.substring(0, 20) + '...'
    });
    return headers;
  }

  private formatMessages(messages: Message[]): Array<{ role: string; content: string }> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const result: Array<{ role: string; content: string }> = [];
    
    if (systemMessage) {
      result.push({
        role: 'system',
        content: systemMessage.content,
      });
    }

    chatMessages.forEach(m => {
      result.push({
        role: m.role,
        content: m.content,
      });
    });

    return result;
  }

  async chat(
    messages: Message[],
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const modelConfig = MODEL_MAPPING[this.config.model as ModelType] || { modelId: 'deepseek-chat' };
    const formattedMessages = this.formatMessages(messages);

    const requestBody: any = {
      model: modelConfig.modelId,
      messages: formattedMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    if (onStream) {
      requestBody.stream = true;
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API Error Details:');
        console.error('  Status:', response.status);
        console.error('  Status Text:', response.statusText);
        console.error('  Response Body:', errorText);
        console.error('  Request URL:', `${this.baseURL}/chat/completions`);
        console.error('  API Key (first 10 chars):', this.apiKey.substring(0, 10) + '...');
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      if (onStream && requestBody.stream) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed: StreamChunk = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  onStream(content);
                }
              } catch (e) {
                console.error('Failed to parse stream chunk:', e);
              }
            }
          }
        }

        return fullContent;
      } else {
        const data: LLMResponse = await response.json();
        return data.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      throw error;
    }
  }

  async* streamChat(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const modelConfig = MODEL_MAPPING[this.config.model as ModelType] || { modelId: 'deepseek-chat' };
    const formattedMessages = this.formatMessages(messages);

    const requestBody = {
      model: modelConfig.modelId,
      messages: formattedMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    };

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed: StreamChunk = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              yield content;
            }
          } catch (e) {
            console.error('Failed to parse stream chunk:', e);
          }
        }
      }
    }
  }

  setModel(model: ModelType) {
    this.config.model = model;
  }

  setConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
  }
}

let globalLLMClient: FlowdLLMClient | null = null;

export function getLLMClient(config?: Partial<LLMConfig>): FlowdLLMClient {
  if (!globalLLMClient || config) {
    globalLLMClient = new FlowdLLMClient(config);
  }
  return globalLLMClient;
}
