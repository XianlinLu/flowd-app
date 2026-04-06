import { Message } from '@/types/chat';

export interface Session {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    workspaceName?: string;
    cardCount?: number;
    openQuestions?: number;
  };
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private maxMessages: number = 50;
  private sessionTimeout: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.startCleanupInterval();
  }

  createSession(metadata?: Session['metadata']): Session {
    const session: Session = {
      id: this.generateSessionId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.updatedAt = Date.now();
    }
    return session;
  }

  addMessage(sessionId: string, message: Message): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    
    if (session.messages.length > this.maxMessages) {
      const systemMessages = session.messages.filter(m => m.role === 'system');
      const nonSystemMessages = session.messages.filter(m => m.role !== 'system');
      const recentMessages = nonSystemMessages.slice(-(this.maxMessages - systemMessages.length));
      session.messages = [...systemMessages, ...recentMessages];
    }

    session.updatedAt = Date.now();
    return session;
  }

  getMessages(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  updateMetadata(sessionId: string, metadata: Partial<Session['metadata']>): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.metadata = { ...session.metadata, ...metadata };
    session.updatedAt = Date.now();
    return session;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.updatedAt > this.sessionTimeout) {
          this.sessions.delete(id);
        }
      }
    }, 60 * 60 * 1000); // Clean up every hour
  }

  getStats(): { totalSessions: number; totalMessages: number } {
    let totalMessages = 0;
    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
    }
    return {
      totalSessions: this.sessions.size,
      totalMessages,
    };
  }
}

export const sessionManager = new SessionManager();
