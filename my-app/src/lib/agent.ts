import { Message, ModelType, ChatRequest } from '@/types/chat';

export interface AgentResponse {
  content: string;
  messageId: string;
  sessionId: string;
}

export interface StreamCallbacks {
  onStart?: (messageId: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: string) => void;
}

class FlowdAgent {
  private sessionId: string | null = null;
  private currentModel: ModelType = 'deepseek-chat';
  private abortController: AbortController | null = null;

  async sendMessage(
    content: string,
    callbacks?: StreamCallbacks,
    options?: {
      model?: ModelType;
      stream?: boolean;
    }
  ): Promise<AgentResponse> {
    const model = options?.model || this.currentModel;
    const stream = options?.stream ?? true;

    this.abortController = new AbortController();

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const requestBody: ChatRequest = {
      messages: [userMessage],
      model,
      stream,
      sessionId: this.sessionId || undefined,
    };

    try {
      const response = await fetch('/api/chat/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to send message');
      }

      if (stream && response.headers.get('content-type')?.includes('text/event-stream')) {
        return this.handleStreamResponse(response, callbacks);
      } else {
        const data = await response.json();
        if (data.sessionId) {
          this.sessionId = data.sessionId;
        }
        return {
          content: data.message.content,
          messageId: data.message.id,
          sessionId: data.sessionId,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }

  private async handleStreamResponse(
    response: Response,
    callbacks?: StreamCallbacks
  ): Promise<AgentResponse> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    let fullContent = '';
    let messageId = '';
    let sessionId = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);

              switch (parsed.type) {
                case 'start':
                  messageId = parsed.messageId;
                  sessionId = parsed.sessionId;
                  this.sessionId = sessionId;
                  callbacks?.onStart?.(messageId);
                  break;

                case 'chunk':
                  fullContent += parsed.content;
                  callbacks?.onChunk?.(parsed.content);
                  break;

                case 'done':
                  callbacks?.onComplete?.(fullContent);
                  break;

                case 'error':
                  callbacks?.onError?.(parsed.error);
                  throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Unknown error') {
                console.error('Failed to parse stream data:', e);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullContent,
      messageId,
      sessionId,
    };
  }

  async getSessionHistory(): Promise<Message[]> {
    if (!this.sessionId) {
      return [];
    }

    const response = await fetch(`/api/chat/llm?sessionId=${this.sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get session history');
    }

    const data = await response.json();
    return data.messages || [];
  }

  async clearSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const response = await fetch(`/api/chat/llm?sessionId=${this.sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear session');
    }

    this.sessionId = null;
  }

  setSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setModel(model: ModelType) {
    this.currentModel = model;
  }

  getModel(): ModelType {
    return this.currentModel;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isStreaming(): boolean {
    return this.abortController !== null;
  }
}

export const flowdAgent = new FlowdAgent();

export function createAgent(): FlowdAgent {
  return new FlowdAgent();
}
